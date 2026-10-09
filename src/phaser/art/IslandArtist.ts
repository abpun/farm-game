import type * as Phaser from 'phaser';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';
import { PALETTE } from '../theme';
import { addArt, bake, seededRandom } from './paint';
import { lookFor, seasonalKey, type SeasonLook } from './seasonLooks';
import type { IslandShape } from './terrain/IslandShape';
import { bayer } from './terrain/noise';

export const GROUND_TEXTURES = {
  sea: 'ground-sea',
  island: 'ground-island',
  foamA: 'ground-foam-a',
  foamB: 'ground-foam-b',
  glint: 'ground-glint',
} as const;

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEPTH = { sea: -2000, glints: -1900, foam: -1600, island: -1500 } as const;
const MAX_BANK = 6;
const SHORE_LIFT = 3;
const FOAM_BANDS = { a: [0, 0.07], b: [0.035, 0.11] } as const;
const SHALLOW_WIDTH = 0.5;
const FOAM_PULSE_MS = 900;
const GLINTS = 26;
const WAVE_AREA_PER_DASH = 700;
const STAMP_DENSITY = { tufts: 1 / 90, pebbles: 1 / 500 };

type Grid = { col: number; row: number };

// Writes straight into ImageData so every terrain pixel is deliberate (no vector anti-aliasing).
class PixelBuffer {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  set(x: number, y: number, color: number, alpha = 255): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = (color >> 16) & 0xff;
    this.data[i + 1] = (color >> 8) & 0xff;
    this.data[i + 2] = color & 0xff;
    this.data[i + 3] = alpha;
  }

  toTexture(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const texture = scene.textures.createCanvas(key, this.width, this.height);
    if (!texture) throw new Error(`Could not create ${key}`);
    const ctx = texture.getContext();
    const image = ctx.createImageData(this.width, this.height);
    image.data.set(this.data);
    ctx.putImageData(image, 0, 0);
    texture.refresh();
  }
}

export function placeSea(scene: Phaser.Scene, area: Bounds): void {
  const w = Math.ceil(area.width / PIXEL_SCALE);
  const h = Math.ceil(area.height / PIXEL_SCALE);
  bake(scene, GROUND_TEXTURES.sea, w, h, (g) => {
    g.fillStyle(PALETTE.sea).fillRect(0, 0, w, h);
    const random = seededRandom(3);
    for (let i = 0; i < (w * h) / WAVE_AREA_PER_DASH; i++) {
      g.fillStyle(random() > 0.35 ? PALETTE.seaLight : PALETTE.seaDark);
      const width = 2 + Math.floor(random() * 4);
      g.fillRect(Math.floor(random() * w), Math.floor(random() * h), width, 1);
    }
  });
  addArt(scene, area.x, area.y, GROUND_TEXTURES.sea).setDepth(DEPTH.sea);
}

/** Bakes the island for a season (once) and returns its texture key. */
export function ensureIslandTexture(
  scene: Phaser.Scene,
  grid: IsoGrid,
  shape: IslandShape,
  seasonId: string,
): string {
  const key = seasonalKey(GROUND_TEXTURES.island, seasonId);
  if (scene.textures.exists(key)) return key;
  const look = lookFor(seasonId);
  const { width, height, toGrid } = islandRaster(grid, shape);
  const island = new PixelBuffer(width, height);
  const center = { col: shape.options.columns / 2, row: shape.options.rows / 2 };

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const at = toGrid(px, py);
      const surface = shape.surface(at.col, at.row);
      if (surface !== 'water') {
        island.set(px, py, landColor(shape, look, surface, at, px, py));
        continue;
      }
      const bank = bankColor(shape, look, px, py, toGrid, center);
      if (bank !== null) {
        island.set(px, py, bank);
        continue;
      }
      const distance = liftedShoreDistance(shape, toGrid, px, py);
      if (distance < SHALLOW_WIDTH) {
        const t = distance / SHALLOW_WIDTH;
        const color = bayer(px, py) > t ? PALETTE.shallowLight : PALETTE.shallow;
        island.set(px, py, color, t > 0.8 ? 160 : 255);
      }
    }
  }
  stampDetails(island, shape, look, toGrid);
  island.toTexture(scene, key);
  return key;
}

/** Places the island for a season plus the pulsing foam line; returns the island sprite. */
export function placeIsland(
  scene: Phaser.Scene,
  grid: IsoGrid,
  shape: IslandShape,
  seasonId: string,
): Phaser.GameObjects.Image {
  const extent = grid.extent(shape.reach);
  bakeFoam(scene, grid, shape);
  const key = ensureIslandTexture(scene, grid, shape, seasonId);
  const island = addArt(scene, extent.x, extent.y, key).setDepth(DEPTH.island);
  const a = addArt(scene, extent.x, extent.y, GROUND_TEXTURES.foamA).setDepth(DEPTH.foam);
  const b = addArt(scene, extent.x, extent.y, GROUND_TEXTURES.foamB)
    .setDepth(DEPTH.foam)
    .setAlpha(0);
  scene.tweens.add({ targets: a, alpha: 0.2, duration: FOAM_PULSE_MS, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: b, alpha: 1, duration: FOAM_PULSE_MS, yoyo: true, repeat: -1 });
  return island;
}

function islandRaster(grid: IsoGrid, shape: IslandShape) {
  const extent = grid.extent(shape.reach);
  return {
    width: Math.ceil(extent.width / PIXEL_SCALE),
    height: Math.ceil(extent.height / PIXEL_SCALE) + MAX_BANK,
    toGrid: (px: number, py: number): Grid =>
      grid.toGrid(extent.x + (px + 0.5) * PIXEL_SCALE, extent.y + (py + 0.5) * PIXEL_SCALE),
  };
}

// Water distance measured from the foot of the bank rather than the land edge above it.
function liftedShoreDistance(
  shape: IslandShape,
  toGrid: (px: number, py: number) => Grid,
  px: number,
  py: number,
): number {
  const lifted = toGrid(px, py - SHORE_LIFT);
  return shape.shoreDistance(lifted.col, lifted.row);
}

function bakeFoam(scene: Phaser.Scene, grid: IsoGrid, shape: IslandShape): void {
  if (scene.textures.exists(GROUND_TEXTURES.foamA)) return;
  const { width, height, toGrid } = islandRaster(grid, shape);
  const foamA = new PixelBuffer(width, height);
  const foamB = new PixelBuffer(width, height);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const at = toGrid(px, py);
      if (shape.surface(at.col, at.row) !== 'water') continue;
      const distance = liftedShoreDistance(shape, toGrid, px, py);
      if (inBand(distance, FOAM_BANDS.a)) foamA.set(px, py, PALETTE.foam);
      if (inBand(distance, FOAM_BANDS.b)) foamB.set(px, py, PALETTE.foam);
    }
  }
  foamA.toTexture(scene, GROUND_TEXTURES.foamA);
  foamB.toTexture(scene, GROUND_TEXTURES.foamB);
}

// Twinkling highlights on open water, re-seated somewhere new each time they fade out.
export function placeSeaGlints(
  scene: Phaser.Scene,
  area: Bounds,
  isOpenWater: (x: number, y: number) => boolean,
): void {
  bake(scene, GROUND_TEXTURES.glint, 3, 1, (g) => g.fillStyle(PALETTE.foam).fillRect(0, 0, 3, 1));
  const random = seededRandom(19);
  const snap = (value: number) => Math.round(value / PIXEL_SCALE) * PIXEL_SCALE;
  const reseat = (glint: Phaser.GameObjects.Image) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = area.x + random() * area.width;
      const y = area.y + random() * area.height;
      if (!isOpenWater(x, y)) continue;
      glint.setPosition(snap(x), snap(y));
      return;
    }
  };
  for (let i = 0; i < GLINTS; i++) {
    const glint = addArt(scene, 0, 0, GROUND_TEXTURES.glint).setDepth(DEPTH.glints).setAlpha(0);
    reseat(glint);
    scene.tweens.add({
      targets: glint,
      alpha: 0.85,
      duration: 700 + random() * 600,
      delay: random() * 4000,
      hold: 200,
      yoyo: true,
      repeat: -1,
      repeatDelay: 1500 + random() * 3000,
      onRepeat: () => reseat(glint),
    });
  }
}

const inBand = (value: number, [from, to]: readonly [number, number]) =>
  value >= from && value < to;

function landColor(
  shape: IslandShape,
  look: SeasonLook,
  surface: 'grass' | 'sand',
  at: Grid,
  px: number,
  py: number,
): number {
  const { noise } = shape;
  const grain = noise.hash(px, py);
  if (surface === 'sand') {
    if (shape.shoreDistance(at.col, at.row) > -0.1) return PALETTE.wetSand;
    const v = noise.fbm(at.col * 1.6 + 7, at.row * 1.6) + (bayer(px, py) - 0.5) * 0.15;
    if (grain < 0.04) return PALETTE.sandDark;
    return v < 0.42 ? PALETTE.sandShade : v < 0.62 ? PALETTE.sand : PALETTE.sandLight;
  }
  if (shape.isPath(at.col, at.row)) {
    if (grain < 0.1) return PALETTE.pathDark;
    return grain > 0.93 ? PALETTE.pathLight : PALETTE.path;
  }
  const v = noise.fbm(at.col * 0.85, at.row * 0.85) + (bayer(px, py) - 0.5) * 0.12;
  const grass = look.grass;
  if (grain < 0.025) return grass.shadow;
  if (grain > 0.985) return grass.highlight;
  return v < 0.4 ? grass.dark : v < 0.6 ? grass.base : grass.light;
}

// Vertical bank under the land edge, shaded by which way it faces; null if no land is above.
function bankColor(
  shape: IslandShape,
  look: SeasonLook,
  px: number,
  py: number,
  toGrid: (px: number, py: number) => Grid,
  center: Grid,
): number | null {
  for (let k = 1; k <= MAX_BANK; k++) {
    const above = toGrid(px, py - k);
    const surface = shape.surface(above.col, above.row);
    if (surface === 'water') continue;
    const height = shape.bankHeight(above.col, above.row);
    if (k > height) return null;
    if (k === 1) return surface === 'grass' ? look.grass.shadow : PALETTE.sandDark;
    if (k === height) return PALETTE.cliffDeep;
    const facesLeft = above.row - center.row > above.col - center.col;
    const face = facesLeft ? PALETTE.cliff : PALETTE.cliffDark;
    const base = surface === 'grass' ? face : PALETTE.wetSand;
    return shape.noise.hash(px, py + 9000) < 0.12 ? PALETTE.cliffDeep : base;
  }
  return null;
}

const STAMPS = {
  tuftA: ['L.L', 'GLG'],
  tuftB: ['.L..L', 'LGL.G', 'G.GLG'],
  accent: ['AA'],
  pebble: ['pP'],
} as const;

// Seeded detail pass: grass tufts, fallen leaves, beach pebbles and little flower clusters.
function stampDetails(
  buffer: PixelBuffer,
  shape: IslandShape,
  look: SeasonLook,
  toGrid: (px: number, py: number) => Grid,
): void {
  const random = seededRandom(shape.options.seed * 7 + 1);
  const area = buffer.width * buffer.height;
  const onSurface = (px: number, py: number, wanted: 'grass' | 'sand', wild: boolean) => {
    const at = toGrid(px, py);
    if (shape.surface(at.col, at.row) !== wanted || shape.isPath(at.col, at.row)) return false;
    return !wild || shape.gridDistance(at.col, at.row) > 0.3;
  };
  const colors: Record<string, number> = {
    L: look.grass.light,
    G: look.grass.shadow,
    p: PALETTE.sandDark,
    P: PALETTE.sandShade,
  };
  const stamp = (rows: readonly string[], x: number, y: number, accent?: number) =>
    rows.forEach((row, dy) =>
      [...row].forEach((char, dx) => {
        const color = char === 'A' ? accent : colors[char];
        if (color !== undefined) buffer.set(x + dx, y + dy, color);
      }),
    );
  const pick = (palette: number[]) => palette[Math.floor(random() * palette.length)];
  const scatter = (density: number, place: (x: number, y: number) => void) => {
    for (let i = 0; i < area * density; i++) {
      place(Math.floor(random() * buffer.width), Math.floor(random() * buffer.height));
    }
  };

  scatter(STAMP_DENSITY.tufts, (x, y) => {
    if (onSurface(x, y, 'grass', false)) stamp(random() > 0.5 ? STAMPS.tuftA : STAMPS.tuftB, x, y);
  });
  scatter(look.accentDensity, (x, y) => {
    if (onSurface(x, y, 'grass', false)) stamp(STAMPS.accent, x, y, pick(look.groundAccents));
  });
  scatter(STAMP_DENSITY.pebbles, (x, y) => {
    if (onSurface(x, y, 'sand', false)) stamp(STAMPS.pebble, x, y);
  });
  scatter(look.flowerDensity, (x, y) => {
    if (!onSurface(x, y, 'grass', true)) return;
    const color = pick(look.flowers) ?? PALETTE.flowerWhite;
    for (let petal = 0; petal < 5; petal++) {
      const fx = x + Math.floor(random() * 7) - 3;
      const fy = y + Math.floor(random() * 4) - 2;
      if (!onSurface(fx, fy, 'grass', true)) continue;
      buffer.set(fx, fy, color);
      buffer.set(fx, fy + 1, look.grass.shadow);
    }
  });
}
