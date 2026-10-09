import { polylineDistance } from '@core/config/geometry';
import type { PathConfig } from '@core/entities/types';
import { createNoise, type Noise } from '../art/terrain/noise';
import { insidePolygon, profileAt, toGrid, toMap, type WorldData } from './WorldMap';

export type Surface = 'grass' | 'sand' | 'water' | 'fresh' | 'rock';

const COAST_WOBBLE = { frequency: 0.18, amount: 1.6 };
const EDGE_WOBBLE = { frequency: 0.7, amount: 0.35 };
const FOOT_WOBBLE = { frequency: 0.25, amount: 1.4 };
const PATH_WOBBLE = { frequency: 2.2, amount: 0.07 };
const RIVER_WOBBLE = { frequency: 0.6, amount: 0.18 };
const POND_WOBBLE = { frequency: 0.45, amount: 1.6 };
const BANK = { sea: [2, 6], cliff: [8, 13], fresh: [1, 2] } as const;
const GRID_CLEARANCE = 0.4;
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

// The whole map as queries in grid space: sea to the south, mountains to the north, a river
// from the waterfall pond to the coast, and the build grid that always stays dry grass.
export class WorldShape {
  readonly noise: Noise;
  private readonly river: RiverSegment[];
  private readonly pond: { col: number; row: number; radius: number };
  private readonly paths: Array<PathConfig & { box: Box }>;
  private readonly riverBox: Box;
  private readonly coastCache = new Map<number, number>();
  private readonly footCache = new Map<number, number>();

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
    this.paths = [...farmPaths, ...worldPaths].map((path) => ({
      ...path,
      box: boxAround(path.points, path.width + 1),
    }));
    const widest = Math.max(...data.river.points.map(([, , w]) => w));
    this.riverBox = boxAround(
      [...pts.map((p) => p.at), [pond.col, pond.row]],
      Math.max(widest, data.river.pond.radius) + 2,
    );
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

  /** Foot of the mountains: the v north of which everything is mountainside. */
  footAt(u: number): number {
    return cached(this.footCache, u, () => {
      const wobble = this.noise.fbm(u * FOOT_WOBBLE.frequency + 500, 3) - 0.5;
      return profileAt(this.data.mountains.foot, u) + wobble * 2 * FOOT_WOBBLE.amount;
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

  /** How far into the mountainside a point is (positive north of the foot), in v units. */
  mountainDepth(col: number, row: number): number {
    const { u, v } = toMap(col, row);
    return this.footAt(u) - v;
  }

  surface(col: number, row: number): Surface {
    if (this.gridDistance(col, row) <= GRID_CLEARANCE) return 'grass';
    const shore = this.shoreDistance(col, row);
    if (shore > 0) return 'water';
    if (this.freshDistance(col, row) < 0) return 'fresh';
    const depth = this.mountainDepth(col, row);
    if (depth > 0) return 'rock';
    const { u } = toMap(col, row);
    const beach =
      (this.data.coast.beach / 2) * (0.7 + this.noise.fbm(col * 0.5 + 9, row * 0.5) * 0.6);
    if (shore > -beach) return this.isCliffCoast(u) ? 'rock' : 'sand';
    const scree = this.data.mountains.scree * this.noise.fbm(col * 0.9 + 40, row * 0.9);
    if (depth > -scree) return 'rock';
    return 'grass';
  }

  isWater(col: number, row: number): boolean {
    const surface = this.surface(col, row);
    return surface === 'water' || surface === 'fresh';
  }

  /** Height in art pixels of the bank where land drops into water. */
  bankHeight(col: number, row: number): number {
    const t = this.noise.fbm(col * 0.55 + 40, row * 0.55 + 40, 2);
    const [min, max] = this.bankRange(col, row);
    return Math.round(min + t * (max - min));
  }

  isPath(col: number, row: number): boolean {
    const wobble = this.noise.value(col * PATH_WOBBLE.frequency, row * PATH_WOBBLE.frequency) - 0.5;
    return this.paths.some(
      (path) =>
        inBox(path.box, col, row) &&
        polylineDistance(path.points, col, row) < path.width / 2 + wobble * 2 * PATH_WOBBLE.amount,
    );
  }

  inForest(col: number, row: number): boolean {
    const { u, v } = toMap(col, row);
    return this.data.forests.some((forest) => insidePolygon(forest.polygon, u, v));
  }

  private bankRange(col: number, row: number): readonly [number, number] {
    if (this.freshDistance(col, row) < 1) return BANK.fresh;
    return this.isCliffCoast(toMap(col, row).u) ? BANK.cliff : BANK.sea;
  }
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
