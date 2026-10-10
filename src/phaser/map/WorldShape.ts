import { polylineDistance } from '@core/config/geometry';
import type { PathConfig } from '@core/entities/types';
import { createNoise, type Noise } from '../art/terrain/noise';
import { CODE, TERRAINS, type Terrain, type TerrainCode } from './terrain';
import { TerrainGrid, type CellRange } from './TerrainGrid';
import { plantForests, type Planting } from './vegetation';
import { profileAt, toGrid, toMap, type WorldData } from './WorldMap';

export type Surface = 'grass' | 'sand' | 'water' | 'fresh' | 'rock';

const COAST_WOBBLE = { frequency: 0.18, amount: 1.6 };
const EDGE_WOBBLE = { frequency: 0.7, amount: 0.35 };
const PATH_WOBBLE = { frequency: 2.2, amount: 0.07 };
const RIVER_WOBBLE = { frequency: 0.6, amount: 0.18 };
const POND_WOBBLE = { frequency: 0.45, amount: 1.6 };
/** Cells this close to the build grid stay meadow. */
const GRID_CLEARANCE = 1;
/** Points inside a cell tested against farm paths, matching how the farm blocks path tiles. */
const CELL_SAMPLES = [0.2, 0.5, 0.8];
/** Forest floor spreads this far (tiles) around each tree. */
const CANOPY = 1.3;
/** A trail claims a cell when it passes this close to the centre: one cell wide. */
const TRAIL_REACH = 0.55;
const SURFACE: Record<Terrain, Surface> = {
  sea: 'water',
  sand: 'sand',
  rock: 'rock',
  grass: 'grass',
  woods: 'grass',
  path: 'grass',
  fresh: 'fresh',
};
const FAR = 99;
/** Profiles are sampled this finely along u and cached. */
const PROFILE_STEP = 0.05;

interface Box {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

const boxAround = (points: ReadonlyArray<readonly [number, number]>, margin: number): Box => ({
  minCol: Math.min(...points.map(([c]) => c)) - margin,
  maxCol: Math.max(...points.map(([c]) => c)) + margin,
  minRow: Math.min(...points.map(([, r]) => r)) - margin,
  maxRow: Math.max(...points.map(([, r]) => r)) + margin,
});

const inBox = (box: Box, col: number, row: number) =>
  col >= box.minCol && col <= box.maxCol && row >= box.minRow && row <= box.maxRow;

function cached(cache: Map<number, number>, u: number, compute: () => number): number {
  const key = Math.round(u / PROFILE_STEP);
  let value = cache.get(key);
  if (value === undefined) {
    value = compute();
    cache.set(key, value);
  }
  return value;
}

interface RiverSegment {
  a: [number, number];
  b: [number, number];
  wa: number;
  wb: number;
}

// The whole map as queries in grid space: sea to the south, woods to the north, a river from
// the waterfall pond to the coast, and the build grid that always stays dry grass. Each cell
// gets one terrain (`terrain`), which is exactly what the tiles draw.
export class WorldShape {
  readonly noise: Noise;
  private readonly river: RiverSegment[];
  private readonly pond: { col: number; row: number; radius: number };
  private readonly paths: Array<PathConfig & { box: Box }>;
  private readonly farmPaths: Array<PathConfig & { box: Box }>;
  private readonly trails: Array<PathConfig & { box: Box }>;
  private readonly riverBox: Box;
  private readonly coastCache = new Map<number, number>();
  readonly terrain: TerrainGrid;
  /** Every tree in the authored forests, planted once. */
  readonly trees: Planting[];

  constructor(
    readonly data: WorldData,
    readonly columns: number,
    readonly rows: number,
    farmPaths: PathConfig[],
  ) {
    this.noise = createNoise(data.seed);
    const pts = data.river.points.map(([u, v, w]) => {
      const g = toGrid(u, v);
      return { at: [g.col, g.row] as [number, number], w };
    });
    this.river = pts.slice(1).map((p, i) => {
      const prev = pts[i] as (typeof pts)[number];
      return { a: prev.at, b: p.at, wa: prev.w, wb: p.w };
    });
    const pond = toGrid(data.river.pond.u, data.river.pond.v);
    this.pond = { ...pond, radius: data.river.pond.radius };
    const worldPaths = data.paths.map((path) => ({
      width: path.width,
      points: path.points.map(([u, v]): [number, number] => {
        const g = toGrid(u, v);
        return [g.col, g.row];
      }),
    }));
    const boxed = (path: PathConfig) => ({ ...path, box: boxAround(path.points, path.width + 1) });
    this.farmPaths = farmPaths.map(boxed);
    this.trails = worldPaths.map(boxed);
    this.paths = [...this.farmPaths, ...this.trails];
    const widest = Math.max(...data.river.points.map(([, , w]) => w));
    this.riverBox = boxAround(
      [...pts.map((p) => p.at), [pond.col, pond.row]],
      Math.max(widest, data.river.pond.radius) + 2,
    );
    this.terrain = new TerrainGrid(
      cellRange(data),
      (col, row) => this.classify(col, row),
      (code, col, row) => this.reach(code, col, row),
    );
    this.trees = plantForests(this);
    this.shadeCanopies();
  }

  /** Distance in tiles from the build grid (0 inside it). */
  gridDistance(col: number, row: number): number {
    const dx = Math.max(-col, col - this.columns, 0);
    const dy = Math.max(-row, row - this.rows, 0);
    return Math.hypot(dx, dy);
  }

  /** South edge of the land: the coastline's v at this u. */
  coastAt(u: number): number {
    return cached(this.coastCache, u, () => {
      const wobble = this.noise.fbm(u * COAST_WOBBLE.frequency + 300, 7) - 0.5;
      return profileAt(this.data.coast.points, u) + wobble * 2 * COAST_WOBBLE.amount;
    });
  }

  isCliffCoast(u: number): boolean {
    return this.data.coast.cliffs.some(([from, to]) => u >= from && u <= to);
  }

  /** Signed distance to the sea shore in tiles: negative on land, positive offshore. */
  shoreDistance(col: number, row: number): number {
    const { u, v } = toMap(col, row);
    const edge = this.noise.fbm(col * EDGE_WOBBLE.frequency, row * EDGE_WOBBLE.frequency) - 0.5;
    return (v - this.coastAt(u)) / 2 + edge * EDGE_WOBBLE.amount;
  }

  /** Signed distance to river or pond water in tiles: negative inside the water. */
  freshDistance(col: number, row: number): number {
    if (!inBox(this.riverBox, col, row)) return FAR;
    const lobe = this.noise.fbm(col * POND_WOBBLE.frequency + 31, row * POND_WOBBLE.frequency, 2);
    const pond =
      Math.hypot(col - this.pond.col, row - this.pond.row) -
      this.pond.radius -
      (lobe - 0.5) * 2 * POND_WOBBLE.amount;
    let best = pond;
    for (const seg of this.river) {
      const { distance, t } = segmentDistance(seg.a, seg.b, col, row);
      const half = (seg.wa + (seg.wb - seg.wa) * t) / 2;
      best = Math.min(best, distance - half);
    }
    const wobble = this.noise.value(
      col * RIVER_WOBBLE.frequency + 80,
      row * RIVER_WOBBLE.frequency,
    );
    return best + (wobble - 0.5) * RIVER_WOBBLE.amount;
  }

  /** What the tiles show at a fractional grid point. */
  surface(col: number, row: number): Surface {
    return SURFACE[terrainName(this.terrain.terrainAt(col, row))];
  }

  isWater(col: number, row: number): boolean {
    const surface = this.surface(col, row);
    return surface === 'water' || surface === 'fresh';
  }

  isPath(col: number, row: number): boolean {
    const wobble = this.noise.value(col * PATH_WOBBLE.frequency, row * PATH_WOBBLE.frequency) - 0.5;
    return this.pathDistance(col, row) < wobble * 2 * PATH_WOBBLE.amount;
  }

  /** Distance past the edge of the nearest path, in tiles (negative on it). */
  pathDistance(col: number, row: number, paths = this.paths): number {
    let best = FAR;
    for (const path of paths) {
      if (!inBox(path.box, col, row)) continue;
      best = Math.min(best, polylineDistance(path.points, col, row) - path.width / 2);
    }
    return best;
  }

  // The terrain of a whole cell, judged at its centre.
  private classify(col: number, row: number): TerrainCode {
    const x = col + 0.5;
    const y = row + 0.5;
    const crossed = this.pathCrosses(col, row);
    if (this.gridDistance(x, y) < GRID_CLEARANCE) return crossed ? CODE.path : CODE.grass;
    const shore = this.shoreDistance(x, y);
    if (shore > 0) return CODE.sea;
    if (this.freshDistance(x, y) < 0) return CODE.fresh;
    if (crossed) return CODE.path;
    const beach = (this.data.coast.beach / 2) * (0.7 + this.noise.fbm(x * 0.5 + 9, y * 0.5) * 0.6);
    if (shore > -beach) return this.isCliffCoast(toMap(x, y).u) ? CODE.rock : CODE.sand;
    return CODE.grass;
  }

  // The darker forest floor follows the trees that were actually planted.
  private shadeCanopies(): void {
    const reach = Math.ceil(CANOPY);
    for (const tree of this.trees) {
      const col = Math.floor(tree.col);
      const row = Math.floor(tree.row);
      for (let dr = -reach; dr <= reach; dr++) {
        for (let dc = -reach; dc <= reach; dc++) {
          const c = col + dc;
          const r = row + dr;
          if (Math.hypot(c + 0.5 - tree.col, r + 0.5 - tree.row) > CANOPY) continue;
          this.terrain.repaint(c, r, CODE.grass, CODE.woods);
        }
      }
    }
  }

  private pathCrosses(col: number, row: number): boolean {
    const onFarmPath = CELL_SAMPLES.some((dy) =>
      CELL_SAMPLES.some((dx) => this.pathDistance(col + dx, row + dy, this.farmPaths) < 0),
    );
    if (onFarmPath) return true;
    return this.trails.some(
      (trail) =>
        inBox(trail.box, col, row) &&
        polylineDistance(trail.points, col + 0.5, row + 0.5) < TRAIL_REACH,
    );
  }

  // How readily a cell joins a diagonal river or path; the farm's own cells never do.
  private reach(code: TerrainCode, col: number, row: number): number {
    if (this.gridDistance(col + 0.5, row + 0.5) < GRID_CLEARANCE) return Infinity;
    const x = col + 0.5;
    const y = row + 0.5;
    return code === CODE.fresh ? this.freshDistance(x, y) : this.pathDistance(x, y);
  }
}

const terrainName = (code: TerrainCode): Terrain => TERRAINS[code] ?? 'sea';

// Every cell under the map bounds, plus a one-cell rim.
function cellRange(data: WorldData): CellRange {
  const { west, east, north, south } = data.bounds;
  return {
    minCol: Math.floor((north + west) / 2) - 1,
    minRow: Math.floor((north - east) / 2) - 1,
    maxCol: Math.ceil((south + east) / 2) + 1,
    maxRow: Math.ceil((south - west) / 2) + 1,
  };
}

function segmentDistance(a: [number, number], b: [number, number], x: number, y: number) {
  const [ax, ay] = a;
  const [bx, by] = b;
  const lengthSq = (bx - ax) ** 2 + (by - ay) ** 2;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / lengthSq));
  return { distance: Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))), t };
}
