import type * as Phaser from 'phaser';
import type { CropDef } from '@core/entities/types';
import { diamondPoint, type IsoGrid } from '../iso/IsoGrid';
import { PALETTE } from '../theme';
import { FURROW_ROWS } from './BedArtist';
import {
  drawBerry,
  drawBulb,
  drawCane,
  drawStalk,
  drawTrellis,
  drawVine,
  type Plant,
} from './cropShapes';
import { bake, hex, lineWidth, shade, SHADOW } from './paint';
import { drawFruitTree, drawPalm, TREE_DESIGN_WIDTH, TREE_HEADROOM_RATIO } from './treeShapes';

type PlantDrawer = (g: Phaser.GameObjects.Graphics, plant: Plant) => void;

// New crop looks: add a drawer here, then reference its kind from crops.json.
const DRAWERS: Record<string, PlantDrawer> = {
  root: drawRoot,
  bush: drawBushCrop,
  grain: drawGrain,
  head: drawHead,
  stalk: drawStalk,
  berry: drawBerry,
  bulb: drawBulb,
  cane: drawCane,
  vine: drawVine,
  trellis: drawTrellis,
};

// Trees fill a whole orchard tile with one plant and stand taller than bed crops.
const TREE_DRAWERS: Record<string, PlantDrawer> = { tree: drawFruitTree, palm: drawPalm };
const TREE_ICON_SCALE = 0.6;

const PLANT_COLUMNS = [0.22, 0.5, 0.78] as const;
const BASE_TILE_WIDTH = 128;
const PLANT_SCALE = 1.15;
const ICON = { width: 24, height: 26, baseY: 23, scale: 0.65 } as const;

export const cropTextureKey = (cropId: string, stage: number) => `crop-${cropId}-${stage}`;
export const cropIconKey = (cropId: string) => `crop-icon-${cropId}`;

export function generateCropTextures(scene: Phaser.Scene, crops: CropDef[], grid: IsoGrid): void {
  const { tileW: w, tileH: h, cropHeadroom } = grid.art;
  const s = (w / BASE_TILE_WIDTH) * PLANT_SCALE;
  const spots = FURROW_ROWS.flatMap((v) => PLANT_COLUMNS.map((u) => ({ u, v }))).sort(
    (a, b) => a.u + a.v - (b.u + b.v),
  );

  for (const crop of crops) {
    if (crop.visual.kind in TREE_DRAWERS) {
      generateTreeTextures(scene, crop, grid);
      continue;
    }
    const drawer = DRAWERS[crop.visual.kind];
    if (!drawer) throw new Error(`${crop.id}: unknown visual kind "${crop.visual.kind}"`);
    const leaf = hex(crop.visual.leaf);
    const produce = hex(crop.visual.produce);

    bake(scene, cropIconKey(crop.id), ICON.width, ICON.height, (g) =>
      drawer(g, { x: ICON.width / 2, y: ICON.baseY, s: ICON.scale, t: 1, leaf, produce }),
    );

    for (let stage = 0; stage < crop.stages; stage++) {
      const t = stage / (crop.stages - 1);
      bake(scene, cropTextureKey(crop.id, stage), w, h + cropHeadroom, (g) => {
        for (const { u, v } of spots) {
          const p = diamondPoint(u, v, w, h);
          const plant = {
            x: Math.round(p.x),
            y: Math.round(p.y + cropHeadroom),
            s,
            t,
            leaf,
            produce,
          };
          drawShadow(g, plant);
          if (t === 0) drawSeed(g, plant);
          else drawer(g, plant);
        }
      });
    }
  }
}

function generateTreeTextures(scene: Phaser.Scene, crop: CropDef, grid: IsoGrid): void {
  const draw = TREE_DRAWERS[crop.visual.kind] as PlantDrawer;
  const { tileW: w, tileH: h } = grid.art;
  const headroom = Math.round(w * TREE_HEADROOM_RATIO);
  const s = w / TREE_DESIGN_WIDTH;
  const leaf = hex(crop.visual.leaf);
  const produce = hex(crop.visual.produce);
  bake(scene, cropIconKey(crop.id), ICON.width, ICON.height, (g) =>
    draw(g, { x: ICON.width / 2, y: ICON.baseY, s: TREE_ICON_SCALE, t: 1, leaf, produce }),
  );
  for (let stage = 0; stage < crop.stages; stage++) {
    const t = stage / (crop.stages - 1);
    bake(scene, cropTextureKey(crop.id, stage), w, h + headroom, (g) =>
      draw(g, { x: Math.round(w / 2), y: Math.round(h / 2 + headroom), s, t, leaf, produce }),
    );
  }
}

function drawShadow(g: Phaser.GameObjects.Graphics, { x, y, s, t }: Plant): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(x, y + s, (8 + 10 * t) * s, 5 * s);
}

function drawSeed(g: Phaser.GameObjects.Graphics, { x, y, s, leaf }: Plant): void {
  g.fillStyle(PALETTE.mound).fillEllipse(x, y, 12 * s, 5 * s);
  g.fillStyle(leaf).fillRect(x, y - 2, 1, 1);
}

function drawRoot(g: Phaser.GameObjects.Graphics, { x, y, s, t, leaf, produce }: Plant): void {
  const height = (10 + 20 * t) * s;
  for (const offset of [-1, 1, 0]) {
    const tipX = x + offset * height * 0.45;
    const tipY = y - height * (offset === 0 ? 1 : 0.75);
    g.fillStyle(offset === 0 ? leaf : shade(leaf, 0.75));
    g.fillTriangle(x - 2 * s, y - s, x + 2 * s, y - s, tipX, tipY);
  }
  if (t < 1) return;
  g.fillStyle(produce).fillEllipse(x, y, 10 * s, 6 * s);
  g.fillStyle(shade(produce, 1.25)).fillRect(x - 2 * s, y - 2 * s, 2, 1);
}

function drawBushCrop(g: Phaser.GameObjects.Graphics, { x, y, s, t, leaf, produce }: Plant): void {
  if (t < 0.4) {
    g.fillStyle(leaf).fillEllipse(x - 3 * s, y - 3 * s, 7 * s, 4 * s);
    g.fillStyle(shade(leaf, 1.15)).fillEllipse(x + 3 * s, y - 4 * s, 7 * s, 4 * s);
    return;
  }
  const r = (4 + 5 * t) * s;
  g.lineStyle(lineWidth(1.5 * s), PALETTE.stake).lineBetween(
    x + r * 0.7,
    y,
    x + r * 0.7,
    y - r * 2.8,
  );
  g.fillStyle(shade(leaf, 0.7)).fillCircle(x, y - r, r);
  g.fillStyle(leaf).fillCircle(x - r * 0.6, y - r * 0.8, r * 0.8);
  g.fillStyle(leaf).fillCircle(x + r * 0.5, y - r * 1.3, r * 0.75);
  g.fillStyle(shade(leaf, 1.25)).fillCircle(x - r * 0.3, y - r * 1.4, r * 0.35);
  if (t < 0.6) return;

  const ripe = t >= 1;
  const fruitRadius = Math.max(1.2, r * (ripe ? 0.38 : 0.3));
  const fruits = [
    [x - r * 0.5, y - r * 0.7],
    [x + r * 0.4, y - r * 1.0],
    [x, y - r * 1.5],
  ] as const;
  g.fillStyle(ripe ? produce : shade(leaf, 1.45));
  for (const [fx, fy] of fruits) g.fillCircle(fx, fy, fruitRadius);
  g.fillStyle(0xffffff, 0.7);
  for (const [fx, fy] of fruits)
    g.fillRect(Math.round(fx - fruitRadius / 2), Math.round(fy - fruitRadius / 2), 1, 1);
}

function drawGrain(g: Phaser.GameObjects.Graphics, { x, y, s, t, leaf, produce }: Plant): void {
  const height = (8 + 28 * t) * s;
  const ripe = t >= 1;
  const stalk = ripe ? shade(produce, 0.8) : leaf;
  for (const offset of [-3, -1.5, 0, 1.5, 3]) {
    const tipX = x + offset * 1.6 * s;
    const tipY = y - height * (1 - Math.abs(offset) * 0.04);
    g.lineStyle(lineWidth(1.4 * s), stalk).lineBetween(x + offset * s, y, tipX, tipY);
    if (t < 0.5) continue;
    g.fillStyle(ripe ? produce : shade(leaf, 1.2)).fillEllipse(
      tipX,
      tipY,
      Math.max(2, 2.6 * s),
      7 * s,
    );
  }
}

function drawHead(g: Phaser.GameObjects.Graphics, { x, y, s, t, leaf, produce }: Plant): void {
  const spread = (5 + 6 * t) * s;
  g.fillStyle(shade(leaf, 0.75)).fillEllipse(
    x - spread * 0.6,
    y - spread * 0.3,
    spread * 1.2,
    spread * 0.7,
  );
  g.fillStyle(leaf).fillEllipse(x + spread * 0.6, y - spread * 0.35, spread * 1.2, spread * 0.7);
  if (t < 0.4) return;
  const radius = (2 + 4 * t) * s;
  g.fillStyle(t >= 1 ? produce : shade(produce, 0.85)).fillCircle(x, y - radius, radius);
  g.fillStyle(shade(produce, 1.15)).fillCircle(x - radius * 0.3, y - radius * 1.3, radius * 0.45);
  g.lineStyle(1, shade(leaf, 0.8)).lineBetween(x, y - radius * 2, x, y);
}
