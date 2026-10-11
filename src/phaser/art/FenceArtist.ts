import type * as Phaser from 'phaser';
import type { IsoGrid, Point } from '../iso/IsoGrid';
import { PALETTE } from '../theme';
import { bake } from './paint';
import { seasonalKey, SEASON_LOOKS } from './seasonLooks';
import { createNoise } from './terrain/noise';

export const FENCE_TEXTURES = { wood: 'fence', white: 'fence-white', hedge: 'hedge' } as const;

const POST_HEIGHT_RATIO = 0.22;
const HEDGE_HEIGHT_RATIO = 0.15;
const RAIL_HEIGHTS = [0.4, 0.78] as const;
const PAD = 3;
const HEDGE_LAYERS = [-1, 0, 1];
const HEDGE_ROUND = 2;
const LEAF = { light: 0.8, dark: 0.18 } as const;
const PICKET = { white: 0xf4f2ea, shade: 0xc9c4b6, rail: 0xa8a294, outline: 0x7a7468 } as const;
const noise = createNoise(23);

type HedgeColors = [number, number, number, number];
const HEDGE_SUMMER: HedgeColors = [0x2b5f2e, 0x3f8a3e, 0x5ea844, 0x79bf4c];
const HEDGE: Record<string, HedgeColors> = {
  spring: [0x3f7a2c, 0x5e9a34, 0x7cc04a, 0xa8dd6a],
  summer: HEDGE_SUMMER,
  autumn: [0x5e5a24, 0x7a7a30, 0x9a9440, 0xc0b050],
  winter: [0x3f5f3a, 0x557048, 0x6a8458, 0xf4f8fc],
};

export interface FenceShape {
  width: number;
  height: number;
  /** Where the run starts, in the texture's own pixels (used to draw it). */
  anchor: Point;
  /** The run's midpoint, in the texture's own pixels (used to centre it on a tile). */
  center: Point;
}

// A fence runs through the middle of its tile on the same diagonal a grid edge follows
// (half a cell's edge each side of centre), so a row of them reads as one broken line
// along that axis. Turning the object (rotate/flipX) mirrors it onto the other diagonal.
export function fenceShape(grid: IsoGrid): FenceShape {
  const { tileW: w } = grid.art;
  const hedgeH = Math.round(w * HEDGE_HEIGHT_RATIO);
  const lift = Math.max(Math.round(w * POST_HEIGHT_RATIO), hedgeH + 2) + PAD;
  const run = w / 2;
  const anchor = { x: PAD, y: lift };
  return {
    width: w / 2 + PAD * 2,
    height: grid.art.tileH / 2 + lift + PAD,
    anchor,
    center: { x: anchor.x + run / 2, y: anchor.y + run / 4 },
  };
}

export function generateFenceTextures(scene: Phaser.Scene, grid: IsoGrid): void {
  const shape = fenceShape(grid);
  const postHeight = Math.round(grid.art.tileW * POST_HEIGHT_RATIO);
  const run = grid.art.tileW / 2;
  const px = Math.max(1, Math.round(grid.art.tileW / 40));
  const hedgeH = Math.round(grid.art.tileW * HEDGE_HEIGHT_RATIO);
  const at = (i: number): Point => ({
    x: shape.anchor.x + i,
    y: shape.anchor.y + Math.floor(i / 2),
  });
  bake(scene, FENCE_TEXTURES.wood, shape.width, shape.height, (g) =>
    drawWoodFence(g, at, run, postHeight, px),
  );
  bake(scene, FENCE_TEXTURES.white, shape.width, shape.height, (g) =>
    drawPicket(g, at, run, postHeight, px),
  );
  bake(scene, FENCE_TEXTURES.hedge, shape.width, shape.height, (g) =>
    drawHedge(g, at, run, HEDGE_SUMMER, px, hedgeH),
  );
  for (const seasonId of Object.keys(SEASON_LOOKS)) {
    const colors = HEDGE[seasonId];
    if (!colors) continue;
    const key = seasonalKey(FENCE_TEXTURES.hedge, seasonId);
    bake(scene, key, shape.width, shape.height, (g) => drawHedge(g, at, run, colors, px, hedgeH));
  }
}

type Along = (i: number) => Point;

function drawWoodFence(
  g: Phaser.GameObjects.Graphics,
  at: Along,
  run: number,
  height: number,
  px: number,
) {
  for (const ratio of RAIL_HEIGHTS) {
    const lift = Math.round(height * ratio);
    for (let i = 0; i <= run; i++) {
      const p = at(i);
      g.fillStyle(PALETTE.woodLight).fillRect(p.x, p.y - lift - px, px, px);
      g.fillStyle(PALETTE.woodDark).fillRect(p.x, p.y - lift, px, px);
    }
  }
  for (const i of [0, run]) drawPost(g, at(i), height, px);
}

function drawPost(g: Phaser.GameObjects.Graphics, base: Point, height: number, px: number): void {
  const w = px * 3;
  g.fillStyle(PALETTE.woodDarker).fillRect(base.x - px, base.y - height, w, height + px);
  g.fillStyle(PALETTE.wood).fillRect(base.x - px, base.y - height, w - px, height);
  g.fillStyle(PALETTE.woodLight).fillRect(base.x - px, base.y - height, w - px, px);
}

function drawPicket(
  g: Phaser.GameObjects.Graphics,
  at: Along,
  run: number,
  height: number,
  px: number,
) {
  const rail = Math.round(height * RAIL_HEIGHTS[0]);
  const gap = Math.max(2, px * 2);
  for (let i = 0; i <= run; i++) {
    const p = at(i);
    g.fillStyle(PICKET.rail).fillRect(p.x, p.y - rail - px, px, px * 2);
  }
  for (let i = px; i < run; i += gap) {
    const p = at(i);
    const board = Math.floor(i / gap) % 2 < 1 ? PICKET.white : PICKET.shade;
    g.fillStyle(PICKET.outline).fillRect(p.x, p.y - height + px, px, height);
    g.fillStyle(board).fillRect(p.x, p.y - height + px * 2, px, height - px * 3);
  }
  for (const i of [0, run]) {
    const p = at(i);
    const w = px * 3;
    g.fillStyle(PICKET.outline).fillRect(p.x - px, p.y - height - px, w, height + px * 2);
    g.fillStyle(PICKET.white).fillRect(p.x - px, p.y - height, w - px, height);
  }
}

function drawHedge(
  g: Phaser.GameObjects.Graphics,
  at: Along,
  run: number,
  [dark, base, light, top]: HedgeColors,
  px: number,
  hedgeH: number,
) {
  for (const k of HEDGE_LAYERS) {
    for (let i = 0; i <= run; i++) {
      const edge = at(i);
      const p = { x: edge.x - 2 * k * px, y: edge.y + k * px };
      hedgeColumn(g, p, i, run, k === 1, [dark, base, light, top], px, hedgeH);
    }
  }
}

function hedgeColumn(
  g: Phaser.GameObjects.Graphics,
  p: Point,
  i: number,
  run: number,
  front: boolean,
  [dark, base, light, top]: HedgeColors,
  px: number,
  hedgeH: number,
) {
  const fromEnd = Math.min(i, run - i);
  const round = Math.round(HEDGE_ROUND * px);
  const height = hedgeH - Math.max(0, round - fromEnd) * px;
  for (let dy = 0; dy <= height; dy += px) {
    const leaf = noise.hash(i * 3, Math.floor(dy / px) * 5 + p.y);
    let color = leaf > LEAF.light ? light : leaf < LEAF.dark ? dark : base;
    if (dy >= height - px) color = top;
    else if (dy <= px && front) color = dark;
    g.fillStyle(color).fillRect(p.x, p.y - dy, px, px);
  }
}
