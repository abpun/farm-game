import type * as Phaser from 'phaser';
import type { Point } from '../iso/IsoGrid';
import type { IsoGrid } from '../iso/IsoGrid';
import { PALETTE } from '../theme';
import { flat, lerpPoint, shift, up } from './geometry';
import {
  alignShape,
  AUTUMN_ROOF,
  drawHouse,
  houseShape,
  houseStyle,
  ROOF_BY_SEASON,
  type HouseFootprint,
  type HouseShape,
  type HouseStyle,
  type RoofDressing,
} from './HouseArtist';
import { bake, fillPoly, shade } from './paint';
import { seasonalKey } from './seasonLooks';

/** Footprint area the building art covers, matching the cottage's inset. */
export const BUILDING_ART: HouseFootprint = { cols: 2, rows: 1.6 };
export const BUILDING_ROW_INSET = 0.2;

/** Yard inside a housing footprint, in footprint-relative grid units. */
export const YARD = { col0: 0, col1: 2, row0: 1.0, row1: 1.8 } as const;
const SHED: HouseFootprint = { cols: 2, rows: YARD.row0 - BUILDING_ROW_INSET };
const SHED_WALL_RATIO = 0.3;
const FENCE_POST = 6;
const POST_SPACING = 0.25;

interface ProductionLook {
  kind: 'production';
  style: HouseStyle;
}

interface HousingLook {
  kind: 'housing';
  style: HouseStyle;
  yard: number;
}

type BuildingLook = ProductionLook | HousingLook;

const production = (style: HouseStyle): ProductionLook => ({ kind: 'production', style });
const housing = (style: HouseStyle, yard: number): HousingLook => ({
  kind: 'housing',
  style: { ...style, wallRatio: SHED_WALL_RATIO },
  yard,
});

// Each building reads at a glance from its walls, roof and one feature (sails, chimney, yard).
const LOOKS: Record<string, BuildingLook> = {
  'building-feed-mill': production(houseStyle(0xc08a52, 0xb8432a, { sails: true })),
  'building-grain-mill': production(houseStyle(0xe8dcc0, PALETTE.thatch, { sails: true })),
  'building-juice-press': production(houseStyle(0xd8e8b0, 0xe07b2a)),
  'building-dairy': production(houseStyle(0xf4f0e6, 0x3b6fb6)),
  'building-bakery': production(houseStyle(0xc8704a, PALETTE.thatchDark, { chimney: true })),
  'building-jam-kitchen': production(houseStyle(0xf4d0d8, 0x8a4fa8)),
  'building-kitchen': production(houseStyle(0xd6cfc2, 0x5e9a34, { chimney: true })),
  'building-forge': production(houseStyle(0x8f8a80, 0x4a3a3a, { chimney: true })),
  'building-coop': housing(houseStyle(0xc4471e, PALETTE.thatch), 0xd9b25a),
  'building-cowshed': housing(houseStyle(0xa8382a, 0x6e4423), 0xb08a50),
  'building-sheep-pen': housing(houseStyle(0xc08a52, PALETTE.thatch), PALETTE.grassDark),
  'building-goat-shelter': housing(houseStyle(0xb8b0a0, 0x8a5a32), PALETTE.grassDark),
  'building-pigsty': housing(houseStyle(0xd8a080, PALETTE.thatchDark), 0x7a5a3a),
};

/** Texture key of a housing building's front fence, drawn over its animals. */
export const frontFenceKey = (art: string) => `${art}-front`;

export const isHousingArt = (art: string) => LOOKS[art]?.kind === 'housing';

export function buildingAnchor(grid: IsoGrid): Point {
  return houseShape(grid, BUILDING_ART).T;
}

export function generateBuildingTextures(scene: Phaser.Scene, grid: IsoGrid): void {
  const main = houseShape(grid, BUILDING_ART);
  for (const [key, look] of Object.entries(LOOKS)) {
    const bakeVariant = (textureKey: string, roof: RoofDressing) =>
      bake(scene, textureKey, main.width, main.height, (g) =>
        drawBuilding(g, grid, main, look, roof),
      );
    bakeVariant(key, AUTUMN_ROOF);
    for (const [seasonId, roof] of Object.entries(ROOF_BY_SEASON)) {
      bakeVariant(seasonalKey(key, seasonId), roof);
    }
    if (look.kind === 'housing') {
      bake(scene, frontFenceKey(key), main.width, main.height, (g) =>
        drawFrontFence(g, grid, main.T),
      );
    }
  }
}

function drawBuilding(
  g: Phaser.GameObjects.Graphics,
  grid: IsoGrid,
  main: HouseShape,
  look: BuildingLook,
  roof: RoofDressing,
): void {
  if (look.kind === 'production') {
    drawHouse(g, main, roof, look.style);
    return;
  }
  const shed = alignShape(houseShape(grid, SHED, SHED_WALL_RATIO), main.T);
  drawHouse(g, shed, roof, look.style);
  const at = yardPoint(grid, main.T);
  g.fillStyle(look.yard);
  fillPoly(
    g,
    flat(
      at(YARD.col0, YARD.row0),
      at(YARD.col1, YARD.row0),
      at(YARD.col1, YARD.row1),
      at(YARD.col0, YARD.row1),
    ),
  );
  g.fillStyle(shade(look.yard, 0.85));
  for (let i = 0; i < 18; i++) {
    const p = at(0.2 + ((i * 7) % 17) / 10, YARD.row0 + 0.1 + ((i * 3) % 7) / 10);
    g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
  }
  drawFence(g, at(YARD.col0, YARD.row0), at(YARD.col0, YARD.row1));
}

function drawFrontFence(g: Phaser.GameObjects.Graphics, grid: IsoGrid, anchor: Point): void {
  const at = yardPoint(grid, anchor);
  drawFence(g, at(YARD.col0, YARD.row1), at(YARD.col1, YARD.row1));
  drawFence(g, at(YARD.col1, YARD.row0), at(YARD.col1, YARD.row1));
}

/** Converts footprint-relative grid units to art pixels in the building texture. */
function yardPoint(grid: IsoGrid, anchor: Point) {
  const hw = grid.art.tileW / 2;
  const hh = grid.art.tileH / 2;
  return (col: number, row: number): Point => {
    const r = row - BUILDING_ROW_INSET;
    return shift(anchor, (col - r) * hw, (col + r) * hh);
  };
}

function drawFence(g: Phaser.GameObjects.Graphics, from: Point, to: Point): void {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const posts = Math.max(2, Math.round(length / (POST_SPACING * 40)) + 1);
  g.lineStyle(1, PALETTE.woodDark);
  g.lineBetween(from.x, from.y - 2, to.x, to.y - 2);
  g.lineStyle(1, PALETTE.woodLight);
  g.lineBetween(from.x, from.y - 4, to.x, to.y - 4);
  for (let i = 0; i < posts; i++) {
    const p = lerpPoint(from, to, i / (posts - 1));
    const top = up(p, FENCE_POST);
    g.fillStyle(PALETTE.wood).fillRect(Math.round(top.x), Math.round(top.y), 1, FENCE_POST);
    g.fillStyle(PALETTE.woodLight).fillRect(Math.round(top.x), Math.round(top.y), 1, 1);
  }
}
