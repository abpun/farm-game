import type * as Phaser from 'phaser';
import type { IsoGrid, Point } from '../iso/IsoGrid';
import { PALETTE } from '../theme';
import { flat, lerpPoint, shift, up, wallQuad } from './geometry';
import { bake, fillPoly, seededRandom, shade, SHADOW } from './paint';
import { seasonalKey, SNOW } from './seasonLooks';

export const HOUSE_TEXTURE = 'house-cottage';

export interface HouseFootprint {
  cols: number;
  rows: number;
}

/** Colours and features that tell one building from another. */
export interface HouseStyle {
  wall: number;
  wallShade: number;
  roof: number;
  roofDark: number;
  roofLight: number;
  timber: number;
  chimney: boolean;
  /** Windmill sails on the front gable. */
  sails?: boolean;
  /** Wall height as a fraction of tile width. */
  wallRatio?: number;
}

export const COTTAGE_STYLE: HouseStyle = {
  wall: PALETTE.wall,
  wallShade: PALETTE.wallShade,
  roof: PALETTE.thatch,
  roofDark: PALETTE.thatchDark,
  roofLight: PALETTE.thatchLight,
  timber: PALETTE.timber,
  chimney: true,
};

/** A style from a wall and roof colour; shades come from hue-preserving darkening. */
export function houseStyle(
  wall: number,
  roof: number,
  extra: Partial<HouseStyle> = {},
): HouseStyle {
  return {
    wall,
    wallShade: shade(wall, 0.86),
    roof,
    roofDark: shade(roof, 0.75),
    roofLight: shade(roof, 1.2),
    timber: PALETTE.timber,
    chimney: false,
    ...extra,
  };
}

const PAD = 4;
const OVERHANG = 3;
const WALL_RATIO = 0.38;
const ROOF_RATIO = 0.3;
const CHIMNEY_HEIGHT = 8;
const STONE_BASE = 3;
const ROOF_LEAVES = 14;

export interface HouseShape {
  T: Point;
  R: Point;
  B: Point;
  L: Point;
  wall: number;
  ridgeBack: Point;
  ridgeFront: Point;
  width: number;
  height: number;
}

// Local art-pixel geometry; T (footprint's back corner) is the placement anchor.
export function houseShape(
  grid: IsoGrid,
  footprint: HouseFootprint,
  wallRatio = WALL_RATIO,
): HouseShape {
  const hw = grid.art.tileW / 2;
  const hh = grid.art.tileH / 2;
  const { cols: a, rows: b } = footprint;
  const wall = Math.round(grid.art.tileW * wallRatio);
  const roof = Math.round(grid.art.tileW * ROOF_RATIO);
  const T = { x: b * hw + PAD + OVERHANG, y: wall + roof + CHIMNEY_HEIGHT + PAD };
  const R = shift(T, a * hw, a * hh);
  const L = shift(T, -b * hw, b * hh);
  const B = shift(T, (a - b) * hw, (a + b) * hh);
  return {
    T,
    R,
    B,
    L,
    wall,
    ridgeBack: up(lerpPoint(T, L, 0.5), wall + roof),
    ridgeFront: up(lerpPoint(R, B, 0.5), wall + roof),
    width: R.x + PAD + OVERHANG,
    height: B.y + PAD,
  };
}

/** Moves a shape so its anchor T lands on `anchor`. */
export function alignShape(shape: HouseShape, anchor: Point): HouseShape {
  const dx = anchor.x - shape.T.x;
  const dy = anchor.y - shape.T.y;
  const move = (p: Point) => shift(p, dx, dy);
  return {
    ...shape,
    T: move(shape.T),
    R: move(shape.R),
    B: move(shape.B),
    L: move(shape.L),
    ridgeBack: move(shape.ridgeBack),
    ridgeFront: move(shape.ridgeFront),
  };
}

export function generateHouseTexture(
  scene: Phaser.Scene,
  grid: IsoGrid,
  footprint: HouseFootprint,
): void {
  const shape = houseShape(grid, footprint);
  bake(scene, HOUSE_TEXTURE, shape.width, shape.height, (g) =>
    drawHouse(g, shape, AUTUMN_ROOF, COTTAGE_STYLE),
  );
  for (const [seasonId, roof] of Object.entries(ROOF_BY_SEASON)) {
    bake(scene, seasonalKey(HOUSE_TEXTURE, seasonId), shape.width, shape.height, (g) =>
      drawHouse(g, shape, roof, COTTAGE_STYLE),
    );
  }
}

export interface RoofDressing {
  leaves: boolean;
  snow: boolean;
}

export const AUTUMN_ROOF: RoofDressing = { leaves: true, snow: false };
export const ROOF_BY_SEASON: Record<string, RoofDressing> = {
  spring: { leaves: false, snow: false },
  summer: { leaves: false, snow: false },
  autumn: AUTUMN_ROOF,
  winter: { leaves: false, snow: true },
};

export function drawHouse(
  g: Phaser.GameObjects.Graphics,
  shape: HouseShape,
  roof: RoofDressing,
  style: HouseStyle,
): void {
  const { T, R, B, L, wall, ridgeBack, ridgeFront } = shape;
  const along = { x: (R.x - T.x) / 20, y: (R.y - T.y) / 20 };
  const extend = (p: Point, sign: number) => shift(p, along.x * sign, along.y * sign);

  g.fillStyle(SHADOW.color, SHADOW.alpha);
  fillPoly(g, flat(shift(T, 3, 1), shift(R, 3, 1), shift(B, 3, 1), shift(L, 3, 1)));

  g.fillStyle(style.roofDark);
  fillPoly(
    g,
    flat(
      extend(up(T, wall), -1),
      extend(up(R, wall), 1),
      extend(ridgeFront, 1),
      extend(ridgeBack, -1),
    ),
  );
  if (style.chimney) drawChimney(g, lerpPoint(ridgeBack, ridgeFront, 0.72));

  g.fillStyle(style.wall);
  fillPoly(g, flat(L, B, up(B, wall), up(L, wall)));
  g.fillStyle(style.wallShade);
  fillPoly(g, flat(B, R, up(R, wall), up(B, wall)));
  fillPoly(g, flat(up(B, wall), up(R, wall), ridgeFront));
  g.fillStyle(PALETTE.stone);
  fillPoly(g, flat(L, B, up(B, STONE_BASE), up(L, STONE_BASE)));
  g.fillStyle(shade(PALETTE.stone, 0.85));
  fillPoly(g, flat(B, R, up(R, STONE_BASE), up(B, STONE_BASE)));

  drawTimber(g, shape, style);
  drawOpenings(g, shape, style);
  drawFrontRoof(g, shape, extend, roof, style);
  if (style.sails) drawSails(g, shape);
}

function drawChimney(g: Phaser.GameObjects.Graphics, base: Point): void {
  g.fillStyle(PALETTE.stone).fillRect(base.x - 2, base.y - CHIMNEY_HEIGHT, 5, CHIMNEY_HEIGHT + 4);
  g.fillStyle(shade(PALETTE.stone, 0.75)).fillRect(
    base.x + 1,
    base.y - CHIMNEY_HEIGHT,
    2,
    CHIMNEY_HEIGHT + 4,
  );
  g.fillStyle(shade(PALETTE.stone, 0.6)).fillRect(base.x - 3, base.y - CHIMNEY_HEIGHT - 1, 7, 2);
}

function drawTimber(
  g: Phaser.GameObjects.Graphics,
  { R, B, L, wall, ridgeFront }: HouseShape,
  style: HouseStyle,
): void {
  g.lineStyle(2, style.timber);
  for (const corner of [L, B, R])
    g.lineBetween(corner.x, corner.y - STONE_BASE, corner.x, corner.y - wall);
  g.lineBetween(L.x, L.y - wall + 1, B.x, B.y - wall + 1);
  g.lineBetween(B.x, B.y - wall + 1, R.x, R.y - wall + 1);
  g.lineStyle(1, style.timber);
  g.lineBetween(B.x, B.y - wall, ridgeFront.x, ridgeFront.y);
  g.lineBetween(ridgeFront.x, ridgeFront.y, R.x, R.y - wall);
  const mid = lerpPoint(B, R, 0.5);
  g.lineBetween(mid.x, mid.y - wall, mid.x, ridgeFront.y + 2);
}

// The door sits a quarter of the way along the front wall, which lines up with tile col + 0.5.
export const DOOR_POSITION = 0.25;
const DOOR_HALF_WIDTH = 0.08;

function drawOpenings(
  g: Phaser.GameObjects.Graphics,
  { R, B, L, wall }: HouseShape,
  style: HouseStyle,
): void {
  const doorTop = STONE_BASE + Math.round(wall * 0.62);
  const [door0, door1] = [DOOR_POSITION - DOOR_HALF_WIDTH, DOOR_POSITION + DOOR_HALF_WIDTH];
  g.fillStyle(style.timber);
  fillPoly(g, wallQuad(L, B, door0, door1, STONE_BASE, doorTop));
  g.fillStyle(shade(style.timber, 0.75));
  fillPoly(g, wallQuad(L, B, DOOR_POSITION - 0.01, DOOR_POSITION + 0.01, STONE_BASE, doorTop - 1));
  g.fillStyle(style.roofLight);
  fillPoly(g, wallQuad(L, B, door1 - 0.03, door1 - 0.015, STONE_BASE + 6, STONE_BASE + 7));

  const sill = Math.round(wall * 0.38);
  const lintel = Math.round(wall * 0.72);
  const windows: Array<[Point, Point, number, number]> = [
    [L, B, 0.48, 0.66],
    [L, B, 0.76, 0.94],
    [B, R, 0.32, 0.68],
  ];
  for (const [p0, p1, u0, u1] of windows) {
    g.fillStyle(style.timber);
    fillPoly(g, wallQuad(p0, p1, u0, u1, sill, lintel));
    g.fillStyle(PALETTE.glass);
    fillPoly(g, wallQuad(p0, p1, u0 + 0.025, u1 - 0.025, sill + 1, lintel - 1));
    g.fillStyle(style.timber);
    fillPoly(g, wallQuad(p0, p1, (u0 + u1) / 2 - 0.01, (u0 + u1) / 2 + 0.01, sill, lintel));
  }
}

function drawFrontRoof(
  g: Phaser.GameObjects.Graphics,
  { B, L, wall, ridgeBack, ridgeFront }: HouseShape,
  extend: (p: Point, sign: number) => Point,
  roof: RoofDressing,
  style: HouseStyle,
): void {
  const eaveBack = extend(shift(up(L, wall), 0, OVERHANG), -1);
  const eaveFront = extend(shift(up(B, wall), 0, OVERHANG), 1);
  const ridgeB = extend(ridgeBack, -1);
  const ridgeF = extend(ridgeFront, 1);

  g.fillStyle(style.roof);
  fillPoly(g, flat(eaveBack, eaveFront, ridgeF, ridgeB));
  g.lineStyle(1, style.roofDark);
  for (let k = 1; k < 5; k++) {
    const a = lerpPoint(eaveBack, ridgeB, k / 5);
    const b = lerpPoint(eaveFront, ridgeF, k / 5);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
  g.lineStyle(2, style.roofDark).lineBetween(eaveBack.x, eaveBack.y, eaveFront.x, eaveFront.y);
  g.lineStyle(2, style.roofLight).lineBetween(ridgeB.x, ridgeB.y, ridgeF.x, ridgeF.y);

  if (roof.snow) drawRoofSnow(g, eaveBack, eaveFront, ridgeF, ridgeB);
  if (!roof.leaves) return;
  const random = seededRandom(5);
  for (let i = 0; i < ROOF_LEAVES; i++) {
    const p = lerpPoint(
      lerpPoint(eaveBack, eaveFront, random()),
      lerpPoint(ridgeB, ridgeF, random()),
      0.15 + random() * 0.7,
    );
    g.fillStyle(random() > 0.5 ? PALETTE.leafOrange : PALETTE.leafRed).fillRect(p.x, p.y, 2, 1);
  }
}

// Four cloth sails crossing at a hub on the front gable.
function drawSails(g: Phaser.GameObjects.Graphics, { R, B, wall, ridgeFront }: HouseShape): void {
  const gable = lerpPoint(R, B, 0.5);
  const hub = { x: gable.x, y: Math.round((gable.y - wall + ridgeFront.y) / 2) };
  const length = Math.round(wall * 1.15);
  for (const [dx, dy] of [
    [1, -1],
    [-1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const tip = { x: hub.x + dx * length * 0.7, y: hub.y + dy * length * 0.7 };
    g.lineStyle(2, PALETTE.woodDark).lineBetween(hub.x, hub.y, tip.x, tip.y);
    g.lineStyle(3, PALETTE.wall);
    const mid = lerpPoint(hub, tip, 0.6);
    g.lineBetween(mid.x - dy * 2, mid.y + dx * 2, tip.x - dy * 2, tip.y + dx * 2);
  }
  g.fillStyle(PALETTE.woodDarker).fillRect(hub.x - 1, hub.y - 1, 3, 3);
}

// Snow blanket over the upper roof with a wavy, shaded lower edge.
function drawRoofSnow(
  g: Phaser.GameObjects.Graphics,
  eaveBack: Point,
  eaveFront: Point,
  ridgeFront: Point,
  ridgeBack: Point,
): void {
  const steps = 8;
  const edge: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const depth = 0.55 + (i % 2) * 0.12;
    edge.push(
      lerpPoint(lerpPoint(ridgeBack, ridgeFront, t), lerpPoint(eaveBack, eaveFront, t), depth),
    );
  }
  g.fillStyle(SNOW.light);
  fillPoly(g, flat(ridgeBack, ridgeFront, ...[...edge].reverse()));
  g.lineStyle(1, SNOW.shade);
  for (let i = 1; i < edge.length; i++) {
    const a = edge[i - 1] as Point;
    const b = edge[i] as Point;
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
}
