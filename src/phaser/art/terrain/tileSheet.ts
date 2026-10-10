import { CODE, FULL_MASK, TERRAINS, type TerrainCode } from '../../map/terrain';
import { PALETTE } from '../../theme';
import { PixelBuffer } from '../PixelBuffer';
import { lookFor, type SeasonLook } from '../seasonLooks';
import { NEEDLES } from './colors';
import { seededRandom } from './noise';
import { paintLayerTile } from './tilePainter';

/**
 * Layout of a terrain tileset PNG (one per season, `public/assets/tiles/terrain-<season>.png`):
 * row = terrain (TERRAINS order), column = corner mask (N=1, E=2, S=4, W=8; 15 = full),
 * columns 16+ are extra plain variants. Rows after the terrains hold the second animation
 * frame for the terrains in ANIMATED. Every cell is a 40×20 diamond with a 2 px gutter.
 */
export const SHEET = {
  tile: { w: 40, h: 20 },
  gutter: 2,
  masks: 16,
  variants: 4,
  animated: [CODE.sea, CODE.fresh] as readonly TerrainCode[],
} as const;

export const SHEET_COLUMNS = SHEET.masks + SHEET.variants - 1;
export const SHEET_ROWS = TERRAINS.length + SHEET.animated.length;
export const SHEET_SIZE = {
  width: SHEET_COLUMNS * (SHEET.tile.w + SHEET.gutter) + SHEET.gutter,
  height: SHEET_ROWS * (SHEET.tile.h + SHEET.gutter) + SHEET.gutter,
};
export const SHEET_FRAMES = 2;

/** Column of a tile: its mask, or an extra column for plain variants beyond the first. */
export const sheetColumn = (mask: number, variant = 0) =>
  mask === FULL_MASK && variant > 0 ? SHEET.masks + variant - 1 : mask;

/** Row of a terrain in the given animation frame. */
export function sheetRow(code: TerrainCode, frame = 0): number {
  const animated = SHEET.animated.indexOf(code);
  return frame > 0 && animated >= 0 ? TERRAINS.length + animated : code;
}

export const sheetIndex = (code: TerrainCode, mask: number, variant = 0) =>
  sheetRow(code) * SHEET_COLUMNS + sheetColumn(mask, variant);

export const cellOrigin = (row: number, column: number) => ({
  x: SHEET.gutter + column * (SHEET.tile.w + SHEET.gutter),
  y: SHEET.gutter + row * (SHEET.tile.h + SHEET.gutter),
});

/** Paints a whole season's tileset, both frames, ready to save as PNG or upload. */
export function paintSheet(seasonId: string): PixelBuffer {
  const look = lookFor(seasonId);
  const buffer = new PixelBuffer(SHEET_SIZE.width, SHEET_SIZE.height);
  for (let frame = 0; frame < SHEET_FRAMES; frame++) {
    for (let code = 0; code < TERRAINS.length; code++) {
      if (frame > 0 && !SHEET.animated.includes(code)) continue;
      const row = sheetRow(code, frame);
      for (let mask = 1; mask <= FULL_MASK; mask++) {
        const at = cellOrigin(row, sheetColumn(mask));
        paintLayerTile(buffer, at.x, at.y, SHEET.tile, code, mask, { look, frame });
      }
      for (let variant = 0; variant < SHEET.variants; variant++) {
        const at = cellOrigin(row, sheetColumn(FULL_MASK, variant));
        if (variant > 0) {
          paintLayerTile(buffer, at.x, at.y, SHEET.tile, code, FULL_MASK, { look, frame });
        }
        decorate(buffer, at.x, at.y, code, variant, look);
      }
    }
  }
  return buffer;
}

const STAMP_INSET = 0.12;
const STAMPS = {
  tuftA: ['L.L', 'GLG'],
  tuftB: ['.L..L', 'LGL.G', 'G.GLG'],
  accent: ['AA'],
  pebble: ['pP'],
  needles: ['n.n', '.n.'],
  flower: ['A', 'G'],
} as const;
const DETAILS: Partial<Record<number, Array<{ stamp: keyof typeof STAMPS; count: number }>>> = {
  [CODE.grass]: [
    { stamp: 'tuftA', count: 1 },
    { stamp: 'tuftB', count: 1 },
  ],
  [CODE.woods]: [{ stamp: 'needles', count: 2 }],
  [CODE.sand]: [{ stamp: 'pebble', count: 1 }],
};

// Variants of a plain tile differ only in their scattered tufts, flowers and pebbles.
function decorate(
  buffer: PixelBuffer,
  ox: number,
  oy: number,
  code: TerrainCode,
  variant: number,
  look: SeasonLook,
): void {
  const random = seededRandom(code * 97 + variant * 13 + 1);
  const size = SHEET.tile;
  const colors: Record<string, number | undefined> = {
    L: look.grass.light,
    G: look.grass.shadow,
    p: PALETTE.sandDark,
    P: PALETTE.sandShade,
    n: look.snow ? undefined : NEEDLES,
  };
  const place = (rows: readonly string[], accent?: number) => {
    const x = Math.floor(random() * size.w);
    const y = Math.floor(random() * size.h);
    const right = x + Math.max(...rows.map((row) => row.length)) - 1;
    const bottom = y + rows.length - 1;
    const corners = [
      [x, y],
      [right, y],
      [x, bottom],
      [right, bottom],
    ];
    if (!corners.every(([cx = 0, cy = 0]) => inside(cx, cy))) return;
    rows.forEach((row, dy) =>
      [...row].forEach((char, dx) => {
        const color = char === 'A' ? accent : colors[char];
        if (color !== undefined) buffer.set(ox + x + dx, oy + y + dy, color);
      }),
    );
  };
  for (const { stamp, count } of DETAILS[code] ?? []) {
    for (let i = 0; i < count; i++) place(STAMPS[stamp]);
  }
  if (code !== CODE.grass) return;
  const pick = (palette: number[]) => palette[Math.floor(random() * palette.length)];
  const area = size.w * size.h;
  if (random() < area * look.accentDensity) place(STAMPS.accent, pick(look.groundAccents));
  if (random() < area * look.flowerDensity * 3) place(STAMPS.flower, pick(look.flowers));
}

function inside(x: number, y: number): boolean {
  const { w, h } = SHEET.tile;
  const dx = (x + 0.5 - w / 2) / (w / 2);
  const dy = (y + 0.5) / (h / 2);
  const a = (dx + dy) / 2;
  const b = (dy - dx) / 2;
  return a > STAMP_INSET && a < 1 - STAMP_INSET && b > STAMP_INSET && b < 1 - STAMP_INSET;
}
