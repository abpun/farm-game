import type * as Phaser from 'phaser';
import type { IsoGrid, Point } from '../iso/IsoGrid';
import { PALETTE } from '../theme';
import { bake } from './paint';

/** Neighbour bits: which adjacent tiles also hold a fence. */
export const FENCE_LINK = { north: 1, east: 2, south: 4, west: 8 } as const;
export const FENCE_MASKS = 16;

export const fenceTextureKey = (mask: number) => `fence-${mask}`;

const POST_HEIGHT_RATIO = 0.22;
const RAIL_HEIGHTS = [0.4, 0.78] as const;
const PAD = 1;

export interface FenceShape {
  width: number;
  height: number;
  /** Art-pixel offset of the tile's top vertex inside the texture. */
  tileTop: Point;
}

export function fenceShape(grid: IsoGrid): FenceShape {
  const { tileW: w, tileH: h } = grid.art;
  const postHeight = Math.round(w * POST_HEIGHT_RATIO);
  return { width: w, height: h + postHeight + PAD, tileTop: { x: w / 2, y: postHeight + PAD } };
}

// One post in the tile centre plus two thin rails toward each linked neighbour, so you can see through.
export function generateFenceTextures(scene: Phaser.Scene, grid: IsoGrid): void {
  const { tileW: w, tileH: h } = grid.art;
  const shape = fenceShape(grid);
  const postHeight = shape.tileTop.y - PAD;
  const top = shape.tileTop.y;
  const center = { x: w / 2, y: top + h / 2 };
  const edge: Record<keyof typeof FENCE_LINK, Point> = {
    north: { x: (w * 3) / 4, y: top + h / 4 },
    west: { x: w / 4, y: top + h / 4 },
    east: { x: (w * 3) / 4, y: top + (h * 3) / 4 },
    south: { x: w / 4, y: top + (h * 3) / 4 },
  };

  for (let mask = 0; mask < FENCE_MASKS; mask++) {
    bake(scene, fenceTextureKey(mask), shape.width, shape.height, (g) => {
      const linked = (side: keyof typeof FENCE_LINK) => (mask & FENCE_LINK[side]) !== 0;
      for (const side of ['north', 'west'] as const) {
        if (linked(side)) drawRails(g, center, edge[side], postHeight);
      }
      drawPost(g, center, postHeight);
      for (const side of ['east', 'south'] as const) {
        if (linked(side)) drawRails(g, center, edge[side], postHeight);
      }
    });
  }
}

function drawRails(
  g: Phaser.GameObjects.Graphics,
  from: Point,
  to: Point,
  postHeight: number,
): void {
  for (const ratio of RAIL_HEIGHTS) {
    const lift = Math.round(postHeight * ratio);
    g.lineStyle(1, PALETTE.woodLight).lineBetween(from.x, from.y - lift, to.x, to.y - lift);
    g.lineStyle(1, PALETTE.woodDark).lineBetween(from.x, from.y - lift + 1, to.x, to.y - lift + 1);
  }
}

function drawPost(g: Phaser.GameObjects.Graphics, base: Point, postHeight: number): void {
  g.fillStyle(PALETTE.woodDarker).fillRect(base.x - 1, base.y - postHeight, 3, postHeight + 1);
  g.fillStyle(PALETTE.wood).fillRect(base.x - 1, base.y - postHeight, 2, postHeight);
  g.fillStyle(PALETTE.woodLight).fillRect(base.x - 1, base.y - postHeight, 2, 1);
}
