import type * as Phaser from 'phaser';
import { PALETTE } from '../theme';
import { PixelBuffer } from './PixelBuffer';
import { FRESH } from './terrain/colors';
import { bayer, createNoise } from './terrain/noise';
import { insidePolygon, profileAt, type WorldData } from '../map/WorldMap';

export const CHART_KEY = 'sea-chart';
export const CHART_SIZE = { width: 200, height: 136 } as const;
/** Map area the chart shows, in map units. */
export const CHART_VIEW = { west: -54, east: 54, north: -14, south: 80 } as const;
export const BANNER_SIZE = { width: 108, height: 34 } as const;
export const bannerKey = (biome: string) => `banner-${biome}`;

const INK = 0x6b3a18;
const PAPER = { base: 0xf2dcac, shade: 0xe2c690 };
const LAND = { base: 0xc8c48a, dark: 0xa8a46a };
const SEA = { base: 0x9cc8c8, deep: 0x7ab0b8 };
/** Map units between the inked trees. */
const TREE_STEP = 6;

/** Chart pixel of a map point. */
export function chartPoint(u: number, v: number): { x: number; y: number } {
  const { west, east, north, south } = CHART_VIEW;
  return {
    x: ((u - west) / (east - west)) * CHART_SIZE.width,
    y: ((v - north) / (south - north)) * CHART_SIZE.height,
  };
}

// A hand-inked chart of the valley: land, woods, river and the open sea with islands.
export function bakeChart(scene: Phaser.Scene, world: WorldData): void {
  if (scene.textures.exists(CHART_KEY)) return;
  const { width, height } = CHART_SIZE;
  const noise = createNoise(5);
  const buffer = new PixelBuffer(width, height);
  const { west, east, north, south } = CHART_VIEW;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = west + (x / width) * (east - west);
      const v = north + (y / height) * (south - north);
      const coast = profileAt(world.coast.points, u);
      const wooded = world.forests.some((forest) => insidePolygon(forest.polygon, u, v));
      const grain = noise.hash(x, y) < 0.08;
      let color = v > coast ? SEA.base : LAND.base;
      if (v > coast + 12 && bayer(x, y) < (v - coast - 12) / 20) color = SEA.deep;
      if (v <= coast && wooded) color = grain ? INK : LAND.dark;
      if (Math.abs(v - coast) < 0.7) color = INK;
      const island = world.islands.some((i) => Math.hypot(u - i.u, (v - i.v) / 1.6) < 2 + i.size);
      if (island) color = LAND.base;
      buffer.set(x, y, color);
    }
  }
  inkRiver(buffer, world);
  inkTrees(buffer, world);
  frame(buffer);
  buffer.toTexture(scene, CHART_KEY);
}

function inkRiver(buffer: PixelBuffer, world: WorldData): void {
  const points = world.river.points.map(([u, v]) => chartPoint(u, v));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let s = 0; s <= steps; s++) {
      buffer.set(
        Math.round(a.x + ((b.x - a.x) * s) / steps),
        Math.round(a.y + ((b.y - a.y) * s) / steps),
        FRESH.base,
      );
    }
  }
  const pond = chartPoint(world.river.pond.u, world.river.pond.v);
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -3; dx <= 3; dx++)
      buffer.set(Math.round(pond.x + dx), Math.round(pond.y + dy), FRESH.base);
}

// Little inked pines dotted over the woods.
function inkTrees(buffer: PixelBuffer, world: WorldData): void {
  const { west, east, north, south } = CHART_VIEW;
  for (let v = north + TREE_STEP / 2; v < south; v += TREE_STEP) {
    for (let u = west + TREE_STEP / 2; u < east; u += TREE_STEP) {
      if (!world.forests.some((forest) => insidePolygon(forest.polygon, u, v))) continue;
      const at = chartPoint(u, v);
      const x = Math.round(at.x);
      const y = Math.round(at.y);
      buffer.set(x, y - 2, INK);
      for (let dx = -1; dx <= 1; dx++) buffer.set(x + dx, y - 1, INK);
      buffer.set(x, y, INK);
    }
  }
}

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
