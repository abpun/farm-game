import { blendCorners, CODE, type Blend, type Corners, type TerrainCode } from '../../map/terrain';
import { PALETTE } from '../../theme';
import type { PixelBuffer } from '../PixelBuffer';
import { SNOW, type SeasonLook } from '../seasonLooks';
import { FRESH, NEEDLES, ROCK } from './colors';
import { bayer, createNoise } from './noise';

/** Score noise at terrain edges so borders come out dithered. */
const EDGE_JITTER = 0.14;
const FOAM = [
  [0, 0.1],
  [0.06, 0.18],
] as const;
const SHALLOW = 0.32;
const SEA_TINT = 0.6;
const WET_SAND = 0.24;
const FRESH_EDGE = { shallow: 0.12, light: 0.3, deep: 0.72 };
const PATH_EDGE = 0.16;
const SPECKLE = { light: 0.9, dark: 0.08, highlight: 0.985, shadow: 0.02 };
const WAVE = { every: 0.965, length: 4 };
const BANK = { sea: 3, cliff: 5, fresh: 2 };
const noise = createNoise(41);

export interface TileContext {
  look: SeasonLook;
  /** Animation frame: sea foam and ripples shift between frames. */
  frame: number;
}

interface Pixel {
  px: number;
  py: number;
}

const isWater = (code: TerrainCode) => code === CODE.sea || code === CODE.fresh;

/** Paints one diamond tile (w×h art px) at (ox, oy) of the buffer. */
export function paintTile(
  buffer: PixelBuffer,
  ox: number,
  oy: number,
  size: { w: number; h: number },
  corners: Corners,
  ctx: TileContext,
  layer?: { code: TerrainCode; under: number | null },
): void {
  const at = (px: number, py: number, clamp: boolean) => {
    const dx = (px + 0.5 - size.w / 2) / (size.w / 2);
    const dy = (py + 0.5) / (size.h / 2);
    let a = (dx + dy) / 2;
    let b = (dy - dx) / 2;
    if (!clamp && (a < 0 || a > 1 || b < 0 || b > 1)) return null;
    a = Math.min(1, Math.max(0, a));
    b = Math.min(1, Math.max(0, b));
    const jitter = (code: TerrainCode) =>
      (noise.hash(px * 7 + code * 131, py * 13 + code) - 0.5) * EDGE_JITTER;
    return blendCorners(corners, a, b, jitter);
  };
  for (let py = 0; py < size.h; py++) {
    for (let px = 0; px < size.w; px++) {
      const blend = at(px, py, false);
      if (!blend) continue;
      const pixel = { px, py };
      if (layer && blend.top !== layer.code) {
        if (layer.under !== null) buffer.set(ox + px, oy + py, layer.under);
        continue;
      }
      const bank = isWater(blend.top) ? bankColor(blend.top, pixel, ctx, at) : null;
      buffer.set(ox + px, oy + py, bank ?? colorOf(blend, pixel, ctx));
    }
  }
}

/** Stacking order fallback: what a layer's tile is painted against outside its mask. */
const BELOW: Record<number, TerrainCode> = {
  [CODE.sea]: CODE.sand,
  [CODE.sand]: CODE.sea,
  [CODE.rock]: CODE.sea,
  [CODE.grass]: CODE.sand,
  [CODE.woods]: CODE.grass,
  [CODE.path]: CODE.grass,
  [CODE.fresh]: CODE.grass,
};
const MASK_BITS = [1, 2, 4, 8] as const;

/**
 * One cell of the stacked tileset: `code` on the corners in `mask`, transparent elsewhere.
 * Sea tiles stay opaque (shallows under the land) so the shore never shows a gap.
 */
export function paintLayerTile(
  buffer: PixelBuffer,
  ox: number,
  oy: number,
  size: { w: number; h: number },
  code: TerrainCode,
  mask: number,
  ctx: TileContext,
): void {
  const below = BELOW[code] ?? CODE.grass;
  const corner = (i: number) => ((mask & (MASK_BITS[i] ?? 0)) !== 0 ? code : below);
  const corners: Corners = [corner(0), corner(1), corner(2), corner(3)];
  const under = code === CODE.sea ? PALETTE.shallow : null;
  paintTile(buffer, ox, oy, size, corners, ctx, { code, under });
}

// A short earth or stone face where land drops into water, read from the pixels above.
function bankColor(
  water: TerrainCode,
  { px, py }: Pixel,
  { look }: TileContext,
  at: (px: number, py: number, clamp: boolean) => Blend | null,
): number | null {
  const reach = water === CODE.fresh ? BANK.fresh : BANK.cliff;
  for (let k = 1; k <= reach; k++) {
    const above = at(px, py - k, true)?.top ?? water;
    if (isWater(above)) continue;
    if (water === CODE.fresh) return k === 1 ? PALETTE.cliffDark : PALETTE.cliffDeep;
    if (above === CODE.sand) return k === 1 ? PALETTE.wetSand : null;
    const height = above === CODE.rock ? BANK.cliff : BANK.sea;
    if (k > height) return null;
    if (k === 1) return above === CODE.rock ? ROCK.light : look.grass.shadow;
    if (k === height) return PALETTE.cliffDeep;
    if (above === CODE.rock) return bayer(px, py) > 0.5 ? ROCK.dark : ROCK.deep;
    return bayer(px, py) > 0.3 ? PALETTE.cliff : PALETTE.cliffDark;
  }
  return null;
}

function colorOf(blend: Blend, pixel: Pixel, ctx: TileContext): number {
  switch (blend.top) {
    case CODE.sea:
      return seaColor(blend, pixel, ctx.frame);
    case CODE.fresh:
      return freshColor(blend, pixel, ctx.frame);
    case CODE.sand:
      return sandColor(blend, pixel);
    case CODE.rock:
      return rockColor(pixel, ctx.look);
    case CODE.path:
      return pathColor(blend, pixel);
    case CODE.woods:
      return woodsColor(pixel, ctx.look);
    default:
      return grassColor(pixel, ctx.look);
  }
}

function seaColor({ margin, second }: Blend, { px, py }: Pixel, frame: number): number {
  const band = FOAM[frame % FOAM.length] ?? FOAM[0];
  if (second !== CODE.sea) {
    if (margin >= band[0] && margin < band[1]) return PALETTE.foam;
    if (margin < SHALLOW)
      return bayer(px, py) > margin / SHALLOW ? PALETTE.shallowLight : PALETTE.shallow;
    if (margin < SEA_TINT)
      return bayer(px, py) > (margin - SHALLOW) / (SEA_TINT - SHALLOW)
        ? PALETTE.shallow
        : PALETTE.sea;
  }
  const wave = noise.hash(Math.floor((px + frame * 2) / WAVE.length), py * 3);
  if (wave > WAVE.every) return PALETTE.seaLight;
  return wave < 1 - WAVE.every ? PALETTE.seaDark : PALETTE.sea;
}

function freshColor({ margin, second }: Blend, { px, py }: Pixel, frame: number): number {
  const edge = second !== CODE.fresh;
  if (edge && margin < FRESH_EDGE.shallow) return FRESH.shallow;
  if (edge && margin < FRESH_EDGE.light) return bayer(px, py) > 0.5 ? FRESH.light : FRESH.base;
  if (noise.hash(Math.floor((px + frame) / 3), py) > 0.97) return FRESH.light;
  if (!edge || margin > FRESH_EDGE.deep) return bayer(px, py) > 0.25 ? FRESH.deep : FRESH.base;
  return FRESH.base;
}

function sandColor({ margin, second }: Blend, { px, py }: Pixel): number {
  if (second === CODE.sea && margin < WET_SAND) return PALETTE.wetSand;
  const grain = noise.hash(px, py + 500);
  if (grain < SPECKLE.dark / 2) return PALETTE.sandDark;
  if (grain > SPECKLE.light) return PALETTE.sandLight;
  return bayer(px, py) > 0.8 ? PALETTE.sandShade : PALETTE.sand;
}

function rockColor({ px, py }: Pixel, look: SeasonLook): number {
  const grain = noise.hash(px + 40, py * 2);
  if (look.snow && grain > 0.35) return grain > 0.7 ? SNOW.light : SNOW.shade;
  if (grain < 0.08) return ROCK.deep;
  if (grain > 0.85) return ROCK.top;
  return bayer(px, py) > 0.5 ? ROCK.base : ROCK.dark;
}

function pathColor({ margin, second }: Blend, { px, py }: Pixel): number {
  if (second !== CODE.path && margin < PATH_EDGE) return PALETTE.pathDark;
  const grain = noise.hash(px + 900, py);
  if (grain < SPECKLE.dark) return PALETTE.pathDark;
  return grain > SPECKLE.light ? PALETTE.pathLight : PALETTE.path;
}

function grassColor({ px, py }: Pixel, look: SeasonLook): number {
  const grain = noise.hash(px, py);
  const { grass } = look;
  if (grain < SPECKLE.shadow) return grass.shadow;
  if (grain > SPECKLE.highlight) return grass.highlight;
  if (grain > SPECKLE.light) return grass.light;
  return grain < SPECKLE.dark ? grass.dark : grass.base;
}

// The forest floor: a step darker than meadow, strewn with needles.
function woodsColor({ px, py }: Pixel, look: SeasonLook): number {
  const grain = noise.hash(px + 300, py);
  const { grass } = look;
  if (look.snow) return grain < SPECKLE.dark ? grass.dark : grass.base;
  if (grain < SPECKLE.shadow * 3) return NEEDLES;
  if (grain < SPECKLE.dark * 2) return grass.shadow;
  return grain > SPECKLE.highlight ? grass.base : grass.dark;
}
