import type * as Phaser from 'phaser';
import type { WorldShape } from '../map/WorldShape';
import { PIXEL_SCALE } from '../layout';
import { PixelBuffer } from './PixelBuffer';
import { lookFor, seasonalKey, SNOW, type SeasonLook } from './seasonLooks';
import { bayer, createNoise, type Noise } from './terrain/noise';

export type RangeLayer = 'near' | 'mid' | 'far';

export interface Peak {
  /** Map east coordinate of the summit. */
  u: number;
  /** Summit height above the foot, in art pixels. */
  height: number;
  /** Half-width of the mountain's shoulders, in map units. */
  spread: number;
}

export interface RangeSpec {
  layer: RangeLayer;
  peaks: Peak[];
  /** Stretches of cliff (u from, u to) where the slope drops sheer to the foot. */
  cliffs: Array<[number, number]>;
  /** Raised above the near foot line, in art pixels (distant ranges sit higher). */
  baseLift: number;
  seed: number;
}

interface Palette {
  rockLight: number;
  rock: number;
  rockDark: number;
  rockDeep: number;
  slopeLight: number;
  slopeMid: number;
  slopeDark: number;
  pine: number;
  pineLight: number;
  snowLight: number;
  snowShade: number;
  outline: number;
}

const HAZE = { mid: 0.35, far: 0.62 } as const;
const SKY_TINT = 0xb8d8e8;
const JAG = { frequency: 0.09, amount: 9 };
const SNOWLINE: Record<string, number> = { winter: 0.3, autumn: 0.68, spring: 0.66, summer: 0.8 };
const TREELINE = 0.34;
const PINE_DENSITY = 1 / 26;
const CLIFF_HEIGHT = 0.42;
const SKIRT = 10;

export const rangeKey = (layer: RangeLayer, seasonId: string) =>
  seasonalKey(`mountains-${layer}`, seasonId);

export interface RangeGeometry {
  /** World x of the texture's left edge and its width/height in art pixels. */
  x: number;
  width: number;
  height: number;
  /** World y of the texture's top edge. */
  top: number;
}

// One wide texture per range. Each column's base follows the foot of the mountains, so the
// range meets the meadow exactly; the summit profile comes from authored peaks plus jag noise.
export function bakeRange(
  scene: Phaser.Scene,
  shape: WorldShape,
  spec: RangeSpec,
  seasonId: string,
  tile: { w: number; h: number },
): RangeGeometry {
  const { west, east } = shape.data.bounds;
  const x = (west * tile.w) / 2;
  const width = Math.ceil(((east - west) * tile.w) / 2 / PIXEL_SCALE);
  const tallest = Math.max(...spec.peaks.map((p) => p.height)) + JAG.amount * 2;
  const feet: number[] = [];
  for (let px = 0; px < width; px++) {
    const u = ((x + (px + 0.5) * PIXEL_SCALE) * 2) / tile.w;
    feet.push((shape.footAt(u) * tile.h) / 2 / PIXEL_SCALE - spec.baseLift);
  }
  const minFoot = Math.min(...feet);
  const maxFoot = Math.max(...feet);
  const height = Math.ceil(maxFoot - minFoot + tallest + SKIRT);
  const geometry = { x, width, height, top: (minFoot - tallest) * PIXEL_SCALE };
  const key = rangeKey(spec.layer, seasonId);
  if (scene.textures.exists(key)) return geometry;

  const look = lookFor(seasonId);
  const palette = paletteFor(spec.layer, look);
  const noise = createNoise(spec.seed);
  const buffer = new PixelBuffer(width, height);
  const snowline = SNOWLINE[seasonId] ?? SNOWLINE.autumn ?? 0.7;
  for (let px = 0; px < width; px++) {
    const u = ((x + (px + 0.5) * PIXEL_SCALE) * 2) / tile.w;
    const base = (feet[px] ?? 0) - (minFoot - tallest);
    const ridge = ridgeHeight(spec, noise, u);
    const slope = ridgeHeight(spec, noise, u + 0.4) - ridgeHeight(spec, noise, u - 0.4);
    const cliff = cliffShare(spec, u);
    const top = Math.round(base - ridge);
    for (let py = Math.max(0, top); py < Math.min(height, base + SKIRT); py++) {
      // The skirt dissolves into the ground below with an ordered-dither fade.
      if (py > base && bayer(px, py) < (py - base) / SKIRT) continue;
      const rise = (base - py) / Math.max(1, ridge);
      buffer.set(
        px,
        py,
        pixelColor(spec, palette, noise, {
          px,
          py,
          top,
          base,
          rise,
          slope,
          cliff,
          snowline,
          ridge,
        }),
      );
    }
  }
  if (spec.layer === 'near') sprinklePines(buffer, noise, palette, feet, minFoot - tallest, look);
  buffer.toTexture(scene, key);
  return geometry;
}

function cliffShare(spec: RangeSpec, u: number): number {
  for (const [from, to] of spec.cliffs) {
    if (u < from || u > to) continue;
    const half = (to - from) / 2;
    return 1 - ((u - from - half) / half) ** 2;
  }
  return 0;
}

function ridgeHeight(spec: RangeSpec, noise: Noise, u: number): number {
  let best = 0;
  for (const peak of spec.peaks) {
    const t = Math.abs(u - peak.u) / peak.spread;
    if (t >= 1) continue;
    best = Math.max(best, peak.height * (1 - t ** 1.15));
  }
  const jag = (noise.fbm(u * JAG.frequency * 10, 3, 3) - 0.5) * 2 * JAG.amount;
  return Math.max(0, best + jag * Math.min(1, best / 40));
}

interface Texel {
  px: number;
  py: number;
  top: number;
  base: number;
  rise: number;
  slope: number;
  /** 0 outside cliffs, rising to 1 mid-cliff so faces taper at their ends. */
  cliff: number;
  snowline: number;
  ridge: number;
}

function pixelColor(spec: RangeSpec, c: Palette, noise: Noise, t: Texel): number {
  const lit = t.slope > 0;
  if (t.py === t.top) return lit ? c.rockLight : c.outline;
  if (t.py > t.base) return c.slopeDark;
  // Diagonal gullies break up each face the way erosion would.
  const gully = noise.fbm(t.px * 0.035 + t.py * 0.05, t.py * 0.02 + 50);
  const snowEdge = t.snowline + (noise.fbm(t.px * 0.08, t.py * 0.02 + 30) - 0.5) * 0.18;
  if (t.rise > snowEdge && t.ridge > 60) {
    if (gully > 0.64 && spec.layer !== 'far') return lit ? c.rock : c.rockDark;
    if (lit) return gully < 0.36 ? c.snowShade : c.snowLight;
    return gully > 0.58 ? c.snowLight : c.snowShade;
  }
  if (spec.layer === 'far') return lit ? c.rock : c.rockDark;
  if (t.rise < CLIFF_HEIGHT * t.cliff) {
    const ledge = (t.py + Math.floor(noise.hash(t.px >> 3, 9) * 6)) % 9 === 0;
    if (ledge) return c.rockLight;
    const seam = noise.hash(t.px >> 1, 7) > 0.82;
    return seam ? c.rockDeep : t.px % 5 === 0 ? c.rockDark : c.rock;
  }
  if (t.rise < TREELINE + (gully - 0.5) * 0.2) {
    return lit ? (gully > 0.55 ? c.slopeLight : c.slopeMid) : c.slopeDark;
  }
  const strata = noise.fbm(t.px * 0.05, t.py * 0.22 + 11);
  if (gully > 0.66) return lit ? c.rockDark : c.rockDeep;
  if (strata < 0.3) return lit ? c.rock : c.rockDeep;
  if (strata > 0.72) return lit ? c.rockLight : c.rock;
  return lit ? c.rock : c.rockDark;
}

function sprinklePines(
  buffer: PixelBuffer,
  noise: Noise,
  c: Palette,
  feet: number[],
  originY: number,
  look: SeasonLook,
): void {
  const count = Math.floor(buffer.width * buffer.height * PINE_DENSITY * 0.02);
  for (let i = 0; i < count; i++) {
    const px = Math.floor(noise.hash(i, 1) * buffer.width);
    const base = (feet[px] ?? 0) - originY;
    const py = Math.floor(base - noise.hash(i, 2) ** 2 * base * 0.32);
    if (py <= 0) continue;
    const size = 3 + Math.floor(noise.hash(i, 3) * 4);
    for (let row = 0; row < size; row++) {
      const half = Math.floor((row * 2) / 3);
      for (let dx = -half; dx <= half; dx++) {
        const color = dx < 0 ? c.pineLight : c.pine;
        buffer.set(px + dx, py - size + row, look.snow && row < 2 ? SNOW.light : color);
      }
    }
    buffer.set(px, py, c.rockDeep);
  }
}

function paletteFor(layer: RangeLayer, look: SeasonLook): Palette {
  const near: Palette = {
    rockLight: 0xb4ab9a,
    rock: 0x958c7e,
    rockDark: 0x726b62,
    rockDeep: 0x524c48,
    slopeLight: look.grass.base,
    slopeMid: look.grass.dark,
    slopeDark: look.snow ? 0x8a9cb4 : look.grass.shadow,
    pine: 0x2e5a3e,
    pineLight: 0x46784a,
    snowLight: SNOW.light,
    snowShade: 0xb4c4d8,
    outline: 0x463f3c,
  };
  if (layer === 'near') return near;
  const haze = HAZE[layer];
  return Object.fromEntries(
    Object.entries(near).map(([name, color]) => [name, mix(color, SKY_TINT, haze)]),
  ) as unknown as Palette;
}

function mix(a: number, b: number, t: number): number {
  const channel = (shift: number) =>
    Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t) << shift;
  return channel(16) | channel(8) | channel(0);
}
