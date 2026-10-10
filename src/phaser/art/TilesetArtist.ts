import type * as Phaser from 'phaser';
import { CODE, isUniform, type Corners } from '../map/terrain';
import { PALETTE } from '../theme';
import { seededRandom } from './paint';
import { PixelBuffer } from './PixelBuffer';
import { lookFor, type SeasonLook } from './seasonLooks';
import { NEEDLES } from './terrain/colors';
import { paintTile } from './terrain/tilePainter';

export interface TileSpec {
  corners: Corners;
  variant: number;
}

export interface TileSize {
  w: number;
  h: number;
}

/** Sea foam and ripples alternate between this many baked frames. */
export const TILESET_FRAMES = 2;
/** Transparent gutter around every tile so neighbours never bleed in. */
export const TILE_GUTTER = 2;
const COLUMNS = 16;
/** Stamps stay this far inside the diamond so none are clipped at its edge. */
const STAMP_INSET = 0.12;

export const tilesetKey = (seasonId: string, frame: number) => `terrain-tiles@${seasonId}#${frame}`;

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

/** Bakes every tile the map uses, for one season and frame, into one texture. */
export function bakeTileset(
  scene: Phaser.Scene,
  specs: readonly TileSpec[],
  size: TileSize,
  seasonId: string,
  frame: number,
): string {
  const key = tilesetKey(seasonId, frame);
  if (scene.textures.exists(key)) return key;
  const look = lookFor(seasonId);
  const rows = Math.ceil(specs.length / COLUMNS);
  const stepX = size.w + TILE_GUTTER;
  const stepY = size.h + TILE_GUTTER;
  const buffer = new PixelBuffer(COLUMNS * stepX + TILE_GUTTER, rows * stepY + TILE_GUTTER);
  specs.forEach((spec, index) => {
    const ox = TILE_GUTTER + (index % COLUMNS) * stepX;
    const oy = TILE_GUTTER + Math.floor(index / COLUMNS) * stepY;
    paintTile(buffer, ox, oy, size, spec.corners, { look, frame });
    if (isUniform(spec.corners)) decorate(buffer, ox, oy, size, spec, look);
  });
  buffer.toTexture(scene, key);
  return key;
}

// Variants of a plain tile differ only in their scattered tufts, flowers and pebbles.
function decorate(
  buffer: PixelBuffer,
  ox: number,
  oy: number,
  size: TileSize,
  spec: TileSpec,
  look: SeasonLook,
): void {
  const code = spec.corners[0];
  const random = seededRandom(code * 97 + spec.variant * 13 + 1);
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
    const width = Math.max(...rows.map((row) => row.length));
    const right = x + width - 1;
    const bottom = y + rows.length - 1;
    const fits = [
      [x, y],
      [right, y],
      [x, bottom],
      [right, bottom],
    ].every(([cx = 0, cy = 0]) => inside(cx, cy, size));
    if (!fits) return;
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

function inside(x: number, y: number, size: TileSize): boolean {
  const dx = (x + 0.5 - size.w / 2) / (size.w / 2);
  const dy = (y + 0.5) / (size.h / 2);
  const a = (dx + dy) / 2;
  const b = (dy - dx) / 2;
  const low = STAMP_INSET;
  const high = 1 - STAMP_INSET;
  return a > low && a < high && b > low && b < high;
}
