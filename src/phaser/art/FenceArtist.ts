import type * as Phaser from 'phaser';
import type { EdgeSide } from '@core/entities/types';
import type { IsoGrid, Point } from '../iso/IsoGrid';
import { PALETTE } from '../theme';
import { bake } from './paint';
import { seasonalKey, SEASON_LOOKS } from './seasonLooks';
import { createNoise } from './terrain/noise';

/** Item art drawn as a run along a tile edge rather than a standing sprite. */
export const EDGE_ARTS = ['fence', 'fence-white', 'hedge'] as const;
type EdgeArt = (typeof EDGE_ARTS)[number];

export const isEdgeArt = (art: string): art is EdgeArt =>
  (EDGE_ARTS as readonly string[]).includes(art);
export const edgeKey = (art: string, side: EdgeSide) => `edge-${art}-${side}`;

const POST_HEIGHT_RATIO = 0.22;
const HEDGE_HEIGHT = 9;
const RAIL_HEIGHTS = [0.4, 0.78] as const;
const PAD = 3;
/** The hedge is three leaf layers deep, stepped across the edge. */
const HEDGE_LAYERS = [-1, 0, 1];
const HEDGE_ROUND = 2;
const LEAF = { light: 0.8, dark: 0.18 } as const;
const PICKET = { white: 0xf4f2ea, shade: 0xc9c4b6, rail: 0xa8a294, outline: 0x7a7468 } as const;
const PICKET_GAP = 2;
const noise = createNoise(23);

// Box-hedge greens by season: [dark, base, light, top]; winter keeps them under snow.
const HEDGE: Record<string, [number, number, number, number]> = {
  spring: [0x3f7a2c, 0x5e9a34, 0x7cc04a, 0xa8dd6a],
  summer: [0x2b5f2e, 0x3f8a3e, 0x5ea844, 0x79bf4c],
  autumn: [0x5e5a24, 0x7a7a30, 0x9a9440, 0xc0b050],
  winter: [0x3f5f3a, 0x557048, 0x6a8458, 0xf4f8fc],
};

export interface EdgeShape {
  width: number;
  height: number;
  /** Where the edge's starting grid point (the cell's top corner) sits in the texture. */
  anchor: Record<EdgeSide, Point>;
}

/** Texture size and anchors shared by every edge run. */
export function edgeShape(grid: IsoGrid): EdgeShape {
  const { tileW: w } = grid.art;
  const lift = Math.max(Math.round(w * POST_HEIGHT_RATIO), HEDGE_HEIGHT + 2) + PAD;
  return {
    width: w / 2 + PAD * 2,
    height: grid.art.tileH / 2 + lift + PAD,
    anchor: { n: { x: PAD, y: lift }, w: { x: w / 2 + PAD, y: lift } },
  };
}

// The north edge runs down-right from the cell's top corner, the west edge down-left.
export function generateFenceTextures(scene: Phaser.Scene, grid: IsoGrid): void {
  const shape = edgeShape(grid);
  const postHeight = Math.round(grid.art.tileW * POST_HEIGHT_RATIO);
  const run = grid.art.tileW / 2;
  for (const side of ['n', 'w'] as const) {
    const start = shape.anchor[side];
    const dir = side === 'n' ? 1 : -1;
    const at = (i: number): Point => ({ x: start.x + dir * i, y: start.y + Math.floor(i / 2) });
    bake(scene, edgeKey('fence', side), shape.width, shape.height, (g) =>
      drawWoodFence(g, at, run, postHeight),
    );
    bake(scene, edgeKey('fence-white', side), shape.width, shape.height, (g) =>
      drawPicket(g, at, run, postHeight),
    );
    for (const seasonId of Object.keys(SEASON_LOOKS)) {
      const key = seasonalKey(edgeKey('hedge', side), seasonId);
      const colors = HEDGE[seasonId] ?? HEDGE.summer;
      if (colors) {
        bake(scene, key, shape.width, shape.height, (g) => drawHedge(g, at, run, dir, colors));
      }
    }
  }
}

type Along = (i: number) => Point;

function drawWoodFence(g: Phaser.GameObjects.Graphics, at: Along, run: number, height: number) {
  for (const ratio of RAIL_HEIGHTS) {
    const lift = Math.round(height * ratio);
    for (let i = 0; i <= run; i++) {
      const p = at(i);
      g.fillStyle(PALETTE.woodLight).fillRect(p.x, p.y - lift, 1, 1);
      g.fillStyle(PALETTE.woodDark).fillRect(p.x, p.y - lift + 1, 1, 1);
    }
  }
  for (const i of [0, run]) drawPost(g, at(i), height);
}

function drawPost(g: Phaser.GameObjects.Graphics, base: Point, height: number): void {
  g.fillStyle(PALETTE.woodDarker).fillRect(base.x - 1, base.y - height, 3, height + 1);
  g.fillStyle(PALETTE.wood).fillRect(base.x - 1, base.y - height, 2, height);
  g.fillStyle(PALETTE.woodLight).fillRect(base.x - 1, base.y - height, 2, 1);
}

// Pointed white pickets on a grey rail, every other board in shade.
function drawPicket(g: Phaser.GameObjects.Graphics, at: Along, run: number, height: number) {
  const rail = Math.round(height * RAIL_HEIGHTS[0]);
  for (let i = 0; i <= run; i++) {
    const p = at(i);
    g.fillStyle(PICKET.rail).fillRect(p.x, p.y - rail, 1, 1);
  }
  for (let i = 1; i < run; i += PICKET_GAP) {
    const p = at(i);
    const board = (i / PICKET_GAP) % 2 < 1 ? PICKET.white : PICKET.shade;
    g.fillStyle(PICKET.outline).fillRect(p.x, p.y - height + 1, 1, height);
    g.fillStyle(board).fillRect(p.x, p.y - height + 2, 1, height - 2);
  }
  for (const i of [0, run]) {
    const p = at(i);
    g.fillStyle(PICKET.outline).fillRect(p.x - 1, p.y - height - 1, 3, height + 2);
    g.fillStyle(PICKET.white).fillRect(p.x - 1, p.y - height, 2, height);
  }
}

// A clipped hedge: a leafy wall along the edge, lighter on top, rounded at the ends.
function drawHedge(
  g: Phaser.GameObjects.Graphics,
  at: Along,
  run: number,
  dir: number,
  [dark, base, light, top]: [number, number, number, number],
) {
  for (const k of HEDGE_LAYERS) {
    for (let i = 0; i <= run; i++) {
      const edge = at(i);
      const p = { x: edge.x - dir * 2 * k, y: edge.y + k };
      hedgeColumn(g, p, i, run, k === 1, [dark, base, light, top]);
    }
  }
}

function hedgeColumn(
  g: Phaser.GameObjects.Graphics,
  p: Point,
  i: number,
  run: number,
  front: boolean,
  [dark, base, light, top]: [number, number, number, number],
) {
  const fromEnd = Math.min(i, run - i);
  const height = HEDGE_HEIGHT - Math.max(0, HEDGE_ROUND - fromEnd);
  for (let dy = 0; dy <= height; dy++) {
    const leaf = noise.hash(i * 3, dy * 5 + p.y);
    let color = leaf > LEAF.light ? light : leaf < LEAF.dark ? dark : base;
    if (dy >= height - 1) color = top;
    else if (dy <= 1 && front) color = dark;
    g.fillStyle(color).fillRect(p.x, p.y - dy, 1, 1);
  }
}
