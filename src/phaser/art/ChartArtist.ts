import type * as Phaser from 'phaser';
import { PALETTE } from '../theme';
import { PixelBuffer } from './PixelBuffer';
import { FRESH } from './terrain/colors';
import { bayer, createNoise } from './terrain/noise';
import { insidePolygon, profileAt, WORLD, type WorldData } from '../map/WorldMap';

export const CHART_KEY = 'sea-chart';
export const CHART_SIZE = { width: 200, height: 136 } as const;
/** Map area the chart shows, in map units. */
export const CHART_VIEW = { west: -36, east: 50, north: -18, south: 82 } as const;
export const BANNER_SIZE = { width: 108, height: 34 } as const;
export const bannerKey = (biome: string) => `banner-${biome}`;

const INK = 0x6b3a18;
const PAPER = { base: 0xf2dcac, shade: 0xe2c690 };
const LAND = { base: 0xc8c48a, dark: 0xa8a46a, rim: 0xe6cf98 };
const CLIFF = { light: 0xc9a46a, dark: 0x9a7444 };
const SEA = { base: 0x9cc8c8, deep: 0x7ab0b8, foam: 0xe8f6f2 };
const PINE = 0x5a7a3a;
const ROOF = 0xb8432a;
/** The chart is drawn like the game: x per map unit, y at half that (2:1 isometric). */
const SCALE_X = CHART_SIZE.width / (CHART_VIEW.east - CHART_VIEW.west);
const SCALE_Y = SCALE_X / 2;
/** Land stands this many chart pixels above the sea, islands a little less. */
const LIFT = { land: 6, island: 4 } as const;
const TOP = LIFT.land + 6;
/** Map units between the inked trees. */
const TREE_STEP = 5;
const RIM_WIDTH = 0.9;
const FOAM_WIDTH = 0.9;
const DEEP_FROM = 10;
const FARM = { u: 0, v: 8.4 } as const;
/** The farm's build grid as a diamond in map units, inked as striped fields. */
const FIELDS = { south: 40, stripe: 2, colors: [0xb8a86a, 0xd2c286] } as const;
const FIELD_EDGE = 0.8;

const ground = (u: number, v: number) => ({
  x: (u - CHART_VIEW.west) * SCALE_X,
  y: TOP + (v - CHART_VIEW.north) * SCALE_Y,
});

/** Chart pixel of a map point; points on land sit on the raised land. */
export function chartPoint(
  u: number,
  v: number,
  world: WorldData = WORLD,
): { x: number; y: number } {
  const at = ground(u, v);
  const onLand = v < profileAt(world.coast.points, u);
  return { x: at.x, y: at.y - (onLand ? LIFT.land : 0) };
}

// A hand-inked chart drawn in the game's isometric view: the valley is a raised slab with
// cliffs to the sea, dotted with little pines; islands stand out of the water.
export function bakeChart(scene: Phaser.Scene, world: WorldData): void {
  if (scene.textures.exists(CHART_KEY)) return;
  const { width, height } = CHART_SIZE;
  const noise = createNoise(5);
  const buffer = new PixelBuffer(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = CHART_VIEW.west + x / SCALE_X;
      const vAt = (lift: number) => CHART_VIEW.north + (y + lift - TOP) / SCALE_Y;
      const coast = profileAt(world.coast.points, u);
      const grain = noise.hash(x, y);
      buffer.set(x, y, landOrSea(world, u, vAt, coast, x, y, grain));
    }
  }
  inkRiver(buffer, world);
  inkTrees(buffer, world);
  inkLandmarks(buffer, world);
  frame(buffer);
  buffer.toTexture(scene, CHART_KEY);
}

function landOrSea(
  world: WorldData,
  u: number,
  vAt: (lift: number) => number,
  coast: number,
  x: number,
  y: number,
  grain: number,
): number {
  const top = vAt(LIFT.land);
  if (top < coast) {
    if (coast - top < RIM_WIDTH) return LAND.rim;
    const field = fieldAt(u, top);
    if (field !== null) return field;
    const wooded = world.forests.some((forest) => insidePolygon(forest.polygon, u, top));
    if (wooded) return grain < 0.1 ? INK : LAND.dark;
    return grain < 0.03 ? LAND.dark : LAND.base;
  }
  const sea = vAt(0);
  if (sea < coast) {
    if (coast - sea < 0.35) return INK;
    return bayer(x, y) > 0.55 ? CLIFF.dark : CLIFF.light;
  }
  const island = islandAt(world, u, vAt);
  if (island !== null) return island;
  if (sea - coast < FOAM_WIDTH) return SEA.foam;
  if ((x * 3 + y * 7) % 41 === 0 && bayer(x, y) > 0.5) return INK;
  const depth = sea - coast - DEEP_FROM;
  return depth > 0 && bayer(x, y) < depth / 20 ? SEA.deep : SEA.base;
}

// The farm is the grid diamond (0,0)-(20,20): stripes follow its columns, inked at the edge.
function fieldAt(u: number, v: number): number | null {
  const inset = Math.min(v - Math.abs(u), FIELDS.south - v - Math.abs(u));
  if (inset < 0) return null;
  if (inset < FIELD_EDGE) return INK;
  const col = (v + u) / 2;
  return FIELDS.colors[Math.floor(col / FIELDS.stripe) % 2] ?? LAND.base;
}

// Islands are little raised mounds: a sandy rim around a green crown, cliffs below.
function islandAt(world: WorldData, u: number, vAt: (lift: number) => number): number | null {
  for (const island of world.islands) {
    const radius = 2 + island.size;
    const top = Math.hypot(u - island.u, (vAt(LIFT.island) - island.v) / 2) * 2;
    if (top < radius) return top < radius * 0.55 ? LAND.dark : LAND.rim;
    const side = Math.hypot(u - island.u, (vAt(0) - island.v) / 2) * 2;
    if (side < radius) return CLIFF.dark;
  }
  return null;
}

function inkRiver(buffer: PixelBuffer, world: WorldData): void {
  const points = world.river.points.map(([u, v]) => chartPoint(u, v, world));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(a.x + ((b.x - a.x) * s) / steps);
      const y = Math.round(a.y + ((b.y - a.y) * s) / steps);
      buffer.set(x, y, FRESH.base);
      buffer.set(x + 1, y, FRESH.light);
    }
  }
  const pond = chartPoint(world.river.pond.u, world.river.pond.v, world);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if ((dx / 4.5) ** 2 + (dy / 2.5) ** 2 > 1) continue;
      buffer.set(
        Math.round(pond.x + dx),
        Math.round(pond.y + dy),
        dy < 0 ? FRESH.base : FRESH.light,
      );
    }
  }
}

// Little upright pines over the woods, back to front so nearer ones overlap.
function inkTrees(buffer: PixelBuffer, world: WorldData): void {
  const { west, east, north, south } = CHART_VIEW;
  for (let v = north + TREE_STEP / 2; v < south; v += TREE_STEP / 2) {
    const offset = (Math.round(v / (TREE_STEP / 2)) % 2) * (TREE_STEP / 2);
    for (let u = west + offset; u < east; u += TREE_STEP) {
      if (v >= profileAt(world.coast.points, u) - RIM_WIDTH * 2) continue;
      if (!world.forests.some((forest) => insidePolygon(forest.polygon, u, v))) continue;
      const at = chartPoint(u, v, world);
      pine(buffer, Math.round(at.x), Math.round(at.y));
    }
  }
}

const PINE_ROWS = ['..i..', '.ipi.', '.ppi.', 'ippii', '..t..'] as const;

function pine(buffer: PixelBuffer, x: number, y: number): void {
  PINE_ROWS.forEach((row, dy) =>
    [...row].forEach((char, dx) => {
      if (char === '.') return;
      buffer.set(x + dx - 2, y + dy - PINE_ROWS.length + 1, char === 'p' ? PINE : INK);
    }),
  );
}

// The farmhouse, the lighthouse and the pier, so the chart reads at a glance.
function inkLandmarks(buffer: PixelBuffer, world: WorldData): void {
  const farm = chartPoint(FARM.u, FARM.v, world);
  const fx = Math.round(farm.x);
  const fy = Math.round(farm.y);
  for (let dx = -3; dx <= 3; dx++) buffer.set(fx + dx, fy - 3 + Math.abs(dx) / 2, ROOF);
  for (let dy = -2; dy <= 0; dy++)
    for (let dx = -2; dx <= 2; dx++) buffer.set(fx + dx, fy + dy, PAPER.base);
  buffer.set(fx, fy, INK);
  const light = world.features.find((f) => f.kind === 'lighthouse');
  if (light) {
    const at = chartPoint(light.u, light.v, world);
    for (let dy = 0; dy < 6; dy++)
      buffer.set(Math.round(at.x), Math.round(at.y) - dy, dy % 2 ? ROOF : PAPER.base);
    buffer.set(Math.round(at.x), Math.round(at.y) - 6, 0xffd75e);
  }
  const harbor = world.features.find((f) => f.kind === 'harbor');
  if (!harbor) return;
  const from = chartPoint(harbor.u, harbor.v, world);
  for (let step = 0; step < PIER_DOTS; step++) {
    buffer.set(Math.round(from.x - step * SCALE_X), Math.round(from.y + step * SCALE_Y), INK);
  }
}

const PIER_DOTS = 8;

function frame(buffer: PixelBuffer): void {
  for (let x = 0; x < buffer.width; x++) {
    for (const y of [0, 1, buffer.height - 2, buffer.height - 1])
      buffer.set(x, y, y % 2 ? PAPER.shade : INK);
  }
  for (let y = 0; y < buffer.height; y++) {
    for (const x of [0, 1, buffer.width - 2, buffer.width - 1])
      buffer.set(x, y, x % 2 ? PAPER.shade : INK);
  }
}

type Painter = (x: number, y: number, h: number) => number | null;

const SKY = 0xbde0ee;
// Each destination's look, painted per pixel: v is the row from the top (0..1).
const BIOMES: Record<string, Painter> = {
  river: (x, y, h) => {
    const bank = Math.abs(y / h - 0.6 - Math.sin(x / 14) * 0.1);
    if (bank < 0.12) return bayer(x, y) > 0.8 ? FRESH.light : FRESH.base;
    if (y / h < 0.3) return 0x7cc04a;
    return bayer(x, y) > 0.9 ? 0x4f8f34 : 0x8cbf4a;
  },
  pond: (x, y, h) => {
    if (x > 50 && x < 60 && y / h < 0.65) return y % 3 === 0 ? 0xffffff : FRESH.light;
    if (y / h < 0.6) return bayer(x, y) > 0.7 ? 0x76716a : 0x958c7e;
    return y / h > 0.8 ? FRESH.deep : FRESH.base;
  },
  harbor: (x, y, h) => {
    if (x > 40 && x < 56 && y / h > 0.35) return y % 3 === 0 ? PALETTE.woodDark : PALETTE.wood;
    if (y / h < 0.35) return SKY;
    return bayer(x, y) > 0.92 ? 0xe8f6f2 : PALETTE.sea;
  },
  coast: (x, y, h) => {
    if (y / h < 0.3) return SKY;
    if (y / h < 0.38) return PALETTE.sandShade;
    return (x + y * 3) % 17 === 0 ? 0xe8f6f2 : PALETTE.sea;
  },
  rocks: (x, y, h) => {
    if (x < 50 - y / 2 && y / h > 0.2) return bayer(x, y) > 0.6 ? 0x5f5a54 : 0x76716a;
    if (y / h < 0.3) return SKY;
    return bayer(x, y) > 0.85 ? 0xffffff : PALETTE.seaDark;
  },
  reef: (x, y, h) => {
    const coral = (x * 7 + y * 13) % 23 < 3 && y / h > 0.55;
    if (coral) return x % 2 ? 0xf08a7a : 0xf4b6c8;
    return y / h > 0.7 ? 0x3fbcb4 : 0x6fd8cc;
  },
  deep: (x, y, h) => {
    if ((x - y) % 19 === 0 && y / h < 0.7) return 0x3a6a9a;
    return y / h > 0.5 ? 0x14284a : 0x1e3a66;
  },
  isle: (x, y, h) => {
    if (y / h < 0.45) return SKY;
    const hill = Math.hypot((x - 70) / 28, (y / h - 0.55) / 0.2) < 1;
    if (hill) return y / h < 0.5 ? 0x4f8f34 : PALETTE.sand;
    return PALETTE.sea;
  },
};

export function bakeBanners(scene: Phaser.Scene): void {
  for (const [biome, paint] of Object.entries(BIOMES)) {
    const key = bannerKey(biome);
    if (scene.textures.exists(key)) continue;
    const { width, height } = BANNER_SIZE;
    const buffer = new PixelBuffer(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
        const color = edge ? INK : paint(x, y, height);
        if (color !== null) buffer.set(x, y, color);
      }
    }
    buffer.toTexture(scene, key);
  }
}
