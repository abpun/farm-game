import type * as Phaser from 'phaser';
import { diamondPoint, insetDiamond, type IsoGrid } from '../iso/IsoGrid';
import { PALETTE } from '../theme';
import { bake, fillPoly, shade, strokePoly } from './paint';

export const BED_TEXTURES = { bed: 'bed', outline: 'bed-outline' } as const;
export const FURROW_ROWS = [0.28, 0.72] as const;

const RIM_INSET = 0.96;
const SOIL_INSET = 0.9;
const FURROW_SPAN = [0.16, 0.84] as const;

// Tilled soil sunk flush into the grass: a trodden rim, shadowed top-left inner edge, lit far edge.
export function generateBedTextures(scene: Phaser.Scene, grid: IsoGrid): void {
  const { tileW: w, tileH: h } = grid.art;
  const rim = insetDiamond(w, h, RIM_INSET);
  const [tx, ty, rx, ry, bx, by, lx, ly] = insetDiamond(w, h, SOIL_INSET);

  bake(scene, BED_TEXTURES.bed, w, h, (g) => {
    g.fillStyle(PALETTE.grassShadow);
    fillPoly(g, rim);
    g.fillStyle(PALETTE.soil);
    fillPoly(g, [tx, ty, rx, ry, bx, by, lx, ly]);
    g.lineStyle(1, PALETTE.soilDark);
    g.lineBetween(lx, ly, tx, ty);
    g.lineBetween(tx, ty, rx, ry);
    g.lineStyle(1, shade(PALETTE.soil, 1.15));
    g.lineBetween(lx, ly, bx, by);
    g.lineBetween(bx, by, rx, ry);
    g.lineStyle(1, PALETTE.furrow);
    for (const v of FURROW_ROWS) {
      const from = diamondPoint(FURROW_SPAN[0], v, w, h);
      const to = diamondPoint(FURROW_SPAN[1], v, w, h);
      g.lineBetween(from.x, from.y, to.x, to.y);
    }
  });

  bake(scene, BED_TEXTURES.outline, w, h, (g) => {
    g.lineStyle(1, 0xffffff);
    strokePoly(g, insetDiamond(w, h, 0.98));
  });
}
