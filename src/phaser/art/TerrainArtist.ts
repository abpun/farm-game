import type * as Phaser from 'phaser';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';
import type { Surface, WorldShape } from '../map/WorldShape';
import { PALETTE } from '../theme';
import { addArt, bake, seededRandom } from './paint';
import { PixelBuffer } from './PixelBuffer';
import { lookFor, seasonalKey, SNOW, type SeasonLook } from './seasonLooks';
import { bayer } from './terrain/noise';

export const TERRAIN_TEXTURES = {
  sea: 'ground-sea',
  land: 'ground-land',
  foamA: 'ground-foam-a',
  foamB: 'ground-foam-b',
} as const;

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TERRAIN_DEPTH = { sea: -2000, glints: -1900, foam: -1600, land: -1500 } as const;

export const FRESH = {
  deep: 0x2f7fa6,
  base: 0x3f97bf,
  light: 0x6fbad6,
  shallow: 0x8fd0d8,
} as const;
export const ROCK = {
  deep: 0x5f5a54,
  dark: 0x76716a,
  base: 0x8f8a80,
  light: 0xa8a294,
  top: 0xc0baa8,
};

const SURFACE_CODE: Record<Surface, number> = { water: 0, grass: 1, sand: 2, fresh: 3, rock: 4 };
const MAX_BANK = 13;
const SHORE_LIFT = 3;
const FOAM_BANDS = { a: [0, 0.07], b: [0.035, 0.11] } as const;
const SHALLOW_WIDTH = 0.5;
const FRESH_SHALLOW = 0.35;
const FOAM_PULSE_MS = 900;
const WAVE_AREA_PER_DASH = 700;
const STAMP_DENSITY = { tufts: 1 / 90, pebbles: 1 / 500, needles: 1 / 70, boulders: 1 / 260 };
const FOAM_MARGIN = 6;
/** North of the foot by more than this (v units) the ground is behind the mountains: left clear. */
const HIDDEN_DEPTH = 1.5;

type Grid = { col: number; row: number };

/** Raster covering the map bounds, one texel per art pixel. */
export interface TerrainRaster {
  x: number;
  y: number;
  width: number;
  height: number;
  toGrid: (px: number, py: number) => Grid;
  /** Raster row at a map v (south) coordinate. */
  rowOf: (v: number) => number;
}

export function terrainRaster(grid: IsoGrid, area: Bounds): TerrainRaster {
  return {
    x: area.x,
    y: area.y,
    width: Math.ceil(area.width / PIXEL_SCALE),
    height: Math.ceil(area.height / PIXEL_SCALE),
    toGrid: (px, py) =>
      grid.toGrid(area.x + (px + 0.5) * PIXEL_SCALE, area.y + (py + 0.5) * PIXEL_SCALE),
    rowOf: (v) => Math.floor(((v * grid.tileH) / 2 - area.y) / PIXEL_SCALE),
  };
}

// Surface of every texel, computed once and shared by the colour, bank and foam passes.
class SurfaceMap {
  readonly codes: Uint8Array;

  constructor(
    readonly raster: TerrainRaster,
    shape: WorldShape,
    rows: [number, number] = [0, raster.height],
  ) {
    this.codes = new Uint8Array(raster.width * raster.height);
    for (let py = rows[0]; py < rows[1]; py++) {
      for (let px = 0; px < raster.width; px++) {
        const at = raster.toGrid(px, py);
        this.codes[py * raster.width + px] = SURFACE_CODE[shape.surface(at.col, at.row)];
      }
    }
  }

  at(px: number, py: number): number {
    if (px < 0 || py < 0 || px >= this.raster.width || py >= this.raster.height) return 0;
    return this.codes[py * this.raster.width + px] ?? 0;
  }
}

export function placeSea(scene: Phaser.Scene, area: Bounds): void {
  const w = Math.ceil(area.width / PIXEL_SCALE);
  const h = Math.ceil(area.height / PIXEL_SCALE);
  bake(scene, TERRAIN_TEXTURES.sea, w, h, (g) => {
    g.fillStyle(PALETTE.sea).fillRect(0, 0, w, h);
    const random = seededRandom(3);
    for (let i = 0; i < (w * h) / WAVE_AREA_PER_DASH; i++) {
      g.fillStyle(random() > 0.35 ? PALETTE.seaLight : PALETTE.seaDark);
      const width = 2 + Math.floor(random() * 4);
      g.fillRect(Math.floor(random() * w), Math.floor(random() * h), width, 1);
    }
  });
  addArt(scene, area.x, area.y, TERRAIN_TEXTURES.sea).setDepth(TERRAIN_DEPTH.sea);
}

let surfaceCache: { shape: WorldShape; map: SurfaceMap } | null = null;

function surfacesFor(shape: WorldShape, raster: TerrainRaster): SurfaceMap {
  if (surfaceCache?.shape !== shape) surfaceCache = { shape, map: new SurfaceMap(raster, shape) };
  return surfaceCache.map;
}

/** Bakes the land for a season (once) and returns its texture key. */
export function ensureTerrainTexture(
  scene: Phaser.Scene,
  shape: WorldShape,
  raster: TerrainRaster,
  seasonId: string,
): string {
  const key = seasonalKey(TERRAIN_TEXTURES.land, seasonId);
  if (scene.textures.exists(key)) return key;
  const look = lookFor(seasonId);
  const surfaces = surfacesFor(shape, raster);
  const land = new PixelBuffer(raster.width, raster.height);
  for (let py = 0; py < raster.height; py++) {
    for (let px = 0; px < raster.width; px++) {
      const code = surfaces.at(px, py);
      const at = raster.toGrid(px, py);
      if (code === SURFACE_CODE.fresh) {
        land.set(px, py, freshColor(shape, surfaces, at, px, py));
        continue;
      }
      if (code !== SURFACE_CODE.water) {
        if (code === SURFACE_CODE.rock && shape.mountainDepth(at.col, at.row) > HIDDEN_DEPTH)
          continue;
        land.set(px, py, landColor(shape, look, code, at, px, py));
        continue;
      }
      const bank = bankColor(shape, look, surfaces, raster, px, py);
      if (bank !== null) {
        land.set(px, py, bank);
        continue;
      }
      const lifted = raster.toGrid(px, py - SHORE_LIFT);
      const distance = shape.shoreDistance(lifted.col, lifted.row);
      if (distance < SHALLOW_WIDTH) {
        const t = Math.max(0, distance) / SHALLOW_WIDTH;
        const color = bayer(px, py) > t ? PALETTE.shallowLight : PALETTE.shallow;
        land.set(px, py, color, t > 0.8 ? 160 : 255);
      }
    }
  }
  stampDetails(land, shape, look, surfaces, raster);
  land.toTexture(scene, key);
  return key;
}

/** Places the land for a season plus the pulsing foam line; returns the land sprite. */
export function placeTerrain(
  scene: Phaser.Scene,
  shape: WorldShape,
  raster: TerrainRaster,
  seasonId: string,
): Phaser.GameObjects.Image {
  const foamY = bakeFoam(scene, shape, raster);
  const key = ensureTerrainTexture(scene, shape, raster, seasonId);
  const land = addArt(scene, raster.x, raster.y, key).setDepth(TERRAIN_DEPTH.land);
  const y = raster.y + foamY * PIXEL_SCALE;
  const a = addArt(scene, raster.x, y, TERRAIN_TEXTURES.foamA).setDepth(TERRAIN_DEPTH.foam);
  const b = addArt(scene, raster.x, y, TERRAIN_TEXTURES.foamB)
    .setDepth(TERRAIN_DEPTH.foam)
    .setAlpha(0);
  scene.tweens.add({ targets: a, alpha: 0.2, duration: FOAM_PULSE_MS, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: b, alpha: 1, duration: FOAM_PULSE_MS, yoyo: true, repeat: -1 });
  return land;
}

// Foam only exists along the coast, so it is baked over that band of rows alone.
function bakeFoam(scene: Phaser.Scene, shape: WorldShape, raster: TerrainRaster): number {
  const surfaces = surfacesFor(shape, raster);
  const rows = coastRows(shape, raster);
  const height = Math.max(1, rows[1] - rows[0]);
  if (scene.textures.exists(TERRAIN_TEXTURES.foamA)) return rows[0];
  const foamA = new PixelBuffer(raster.width, height);
  const foamB = new PixelBuffer(raster.width, height);
  for (let py = rows[0]; py < rows[1]; py++) {
    for (let px = 0; px < raster.width; px++) {
      if (surfaces.at(px, py) !== SURFACE_CODE.water) continue;
      const lifted = raster.toGrid(px, py - SHORE_LIFT);
      const distance = shape.shoreDistance(lifted.col, lifted.row);
      if (inBand(distance, FOAM_BANDS.a)) foamA.set(px, py - rows[0], PALETTE.foam);
      if (inBand(distance, FOAM_BANDS.b)) foamB.set(px, py - rows[0], PALETTE.foam);
    }
  }
  foamA.toTexture(scene, TERRAIN_TEXTURES.foamA);
  foamB.toTexture(scene, TERRAIN_TEXTURES.foamB);
  return rows[0];
}

function coastRows(shape: WorldShape, raster: TerrainRaster): [number, number] {
  const vs = shape.data.coast.points.map(([, v]) => v);
  const top = Math.max(0, raster.rowOf(Math.min(...vs) - FOAM_MARGIN));
  const bottom = Math.min(raster.height, raster.rowOf(Math.max(...vs) + FOAM_MARGIN));
  return [top, bottom];
}

const inBand = (value: number, [from, to]: readonly [number, number]) =>
  value >= from && value < to;

function freshColor(
  shape: WorldShape,
  surfaces: SurfaceMap,
  at: Grid,
  px: number,
  py: number,
): number {
  // A dark rim right under the bank, lighter shallows, deeper water mid-stream.
  if (surfaces.at(px, py - 1) !== SURFACE_CODE.fresh && surfaces.at(px, py - 1) !== 0) {
    return PALETTE.cliffDeep;
  }
  const depth = -shape.freshDistance(at.col, at.row);
  if (depth < FRESH_SHALLOW)
    return bayer(px, py) > depth / FRESH_SHALLOW ? FRESH.shallow : FRESH.light;
  const ripple = shape.noise.hash(px >> 2, py);
  if (ripple > 0.97) return FRESH.light;
  return depth > 1.1 ? FRESH.deep : FRESH.base;
}

function landColor(
  shape: WorldShape,
  look: SeasonLook,
  code: number,
  at: Grid,
  px: number,
  py: number,
): number {
  const { noise } = shape;
  const grain = noise.hash(px, py);
  if (code === SURFACE_CODE.sand) {
    if (shape.shoreDistance(at.col, at.row) > -0.1) return PALETTE.wetSand;
    const v = noise.fbm(at.col * 1.6 + 7, at.row * 1.6) + (bayer(px, py) - 0.5) * 0.15;
    if (grain < 0.04) return PALETTE.sandDark;
    return v < 0.42 ? PALETTE.sandShade : v < 0.62 ? PALETTE.sand : PALETTE.sandLight;
  }
  if (shape.isPath(at.col, at.row)) {
    if (grain < 0.1) return PALETTE.pathDark;
    return grain > 0.93 ? PALETTE.pathLight : PALETTE.path;
  }
  if (code === SURFACE_CODE.rock) return rockColor(shape, look, at, px, py, grain);
  const v = noise.fbm(at.col * 0.85, at.row * 0.85) + (bayer(px, py) - 0.5) * 0.12;
  const grass = look.grass;
  // Under the canopy the floor stays a step darker.
  const shaded = shape.inForest(at.col, at.row) ? 0.18 : 0;
  if (grain < 0.025 + shaded / 4) return grass.shadow;
  if (grain > 0.985) return grass.highlight;
  const t = v - shaded;
  return t < 0.4 ? grass.dark : t < 0.6 ? grass.base : grass.light;
}

function rockColor(
  shape: WorldShape,
  look: SeasonLook,
  at: Grid,
  px: number,
  py: number,
  grain: number,
): number {
  const v = shape.noise.fbm(at.col * 1.3 + 60, at.row * 1.3) + (bayer(px, py) - 0.5) * 0.14;
  if (look.snow && v > 0.45) return v > 0.6 ? SNOW.light : SNOW.shade;
  const moss = shape.noise.fbm(at.col * 0.6 + 90, at.row * 0.6);
  if (moss > 0.6) return grain > 0.5 ? look.grass.dark : look.grass.shadow;
  if (grain < 0.04) return ROCK.deep;
  return v < 0.38 ? ROCK.dark : v < 0.58 ? ROCK.base : v < 0.7 ? ROCK.light : ROCK.top;
}

// Vertical bank under a land edge (or river bank), shaded by which way it faces.
function bankColor(
  shape: WorldShape,
  look: SeasonLook,
  surfaces: SurfaceMap,
  raster: TerrainRaster,
  px: number,
  py: number,
): number | null {
  for (let k = 1; k <= MAX_BANK; k++) {
    const code = surfaces.at(px, py - k);
    if (code === SURFACE_CODE.water) continue;
    if (code === SURFACE_CODE.fresh) return null;
    const above = raster.toGrid(px, py - k);
    const height = shape.bankHeight(above.col, above.row);
    if (k > height) return null;
    if (k === 1) {
      if (code === SURFACE_CODE.grass) return look.grass.shadow;
      return code === SURFACE_CODE.rock ? ROCK.light : PALETTE.sandDark;
    }
    if (k === height) return PALETTE.cliffDeep;
    const left = surfaces.at(px - 2, py - k) === SURFACE_CODE.water;
    const face = left ? PALETTE.cliff : PALETTE.cliffDark;
    const base =
      code === SURFACE_CODE.sand ? PALETTE.wetSand : code === SURFACE_CODE.rock ? ROCK.dark : face;
    return shape.noise.hash(px, py + 9000) < 0.12 ? PALETTE.cliffDeep : base;
  }
  return null;
}

const STAMPS = {
  tuftA: ['L.L', 'GLG'],
  tuftB: ['.L..L', 'LGL.G', 'G.GLG'],
  accent: ['AA'],
  pebble: ['pP'],
  needles: ['n.n', '.n.'],
  boulder: ['.RR.', 'RrrR', 'dddd'],
} as const;

// Seeded detail pass: grass tufts, forest needles, beach pebbles, scree boulders, flowers.
function stampDetails(
  buffer: PixelBuffer,
  shape: WorldShape,
  look: SeasonLook,
  surfaces: SurfaceMap,
  raster: TerrainRaster,
): void {
  const random = seededRandom(shape.data.seed * 7 + 1);
  const area = buffer.width * buffer.height;
  const isOn = (px: number, py: number, wanted: number, wild: boolean) => {
    if (surfaces.at(px, py) !== wanted) return false;
    const at = raster.toGrid(px, py);
    if (wanted === SURFACE_CODE.rock && shape.mountainDepth(at.col, at.row) > HIDDEN_DEPTH) {
      return false;
    }
    if (shape.isPath(at.col, at.row)) return false;
    return !wild || shape.gridDistance(at.col, at.row) > 0.3;
  };
  const colors: Record<string, number> = {
    L: look.grass.light,
    G: look.grass.shadow,
    p: PALETTE.sandDark,
    P: PALETTE.sandShade,
    n: 0x7a5a3a,
    R: ROCK.light,
    r: ROCK.base,
    d: ROCK.deep,
  };
  const stamp = (rows: readonly string[], x: number, y: number, accent?: number) =>
    rows.forEach((row, dy) =>
      [...row].forEach((char, dx) => {
        const color = char === 'A' ? accent : colors[char];
        if (color !== undefined) buffer.set(x + dx, y + dy, color);
      }),
    );
  const pick = (palette: number[]) => palette[Math.floor(random() * palette.length)];
  const scatter = (density: number, place: (x: number, y: number) => void) => {
    for (let i = 0; i < area * density; i++) {
      place(Math.floor(random() * buffer.width), Math.floor(random() * buffer.height));
    }
  };

  scatter(STAMP_DENSITY.tufts, (x, y) => {
    if (isOn(x, y, SURFACE_CODE.grass, false)) {
      stamp(random() > 0.5 ? STAMPS.tuftA : STAMPS.tuftB, x, y);
    }
  });
  scatter(STAMP_DENSITY.needles, (x, y) => {
    if (!isOn(x, y, SURFACE_CODE.grass, true) || look.snow) return;
    const at = raster.toGrid(x, y);
    if (shape.inForest(at.col, at.row)) stamp(STAMPS.needles, x, y);
  });
  scatter(look.accentDensity, (x, y) => {
    if (isOn(x, y, SURFACE_CODE.grass, false)) stamp(STAMPS.accent, x, y, pick(look.groundAccents));
  });
  scatter(STAMP_DENSITY.pebbles, (x, y) => {
    if (isOn(x, y, SURFACE_CODE.sand, false)) stamp(STAMPS.pebble, x, y);
  });
  scatter(STAMP_DENSITY.boulders, (x, y) => {
    if (isOn(x, y, SURFACE_CODE.rock, false)) stamp(STAMPS.boulder, x, y);
  });
  scatter(look.flowerDensity, (x, y) => {
    if (!isOn(x, y, SURFACE_CODE.grass, true)) return;
    const color = pick(look.flowers) ?? PALETTE.flowerWhite;
    for (let petal = 0; petal < 5; petal++) {
      const fx = x + Math.floor(random() * 7) - 3;
      const fy = y + Math.floor(random() * 4) - 2;
      if (!isOn(fx, fy, SURFACE_CODE.grass, true)) continue;
      buffer.set(fx, fy, color);
      buffer.set(fx, fy + 1, look.grass.shadow);
    }
  });
}
