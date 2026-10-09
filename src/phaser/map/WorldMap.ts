import worldJson from '@data/world.json';

/** Map point: east = col − row, south = col + row, in tiles. */
export interface MapPoint {
  u: number;
  v: number;
}

export interface GridPoint {
  col: number;
  row: number;
}

export type FeatureKind =
  | 'cave'
  | 'waterfall'
  | 'harbor'
  | 'lighthouse'
  | 'chest'
  | 'crate'
  | 'bench'
  | 'rockfall'
  | 'lookout'
  | 'spot';

export interface WorldFeature extends MapPoint {
  id: string;
  kind: FeatureKind;
  /** Screen pixels above the ground, for things up on the mountainside. */
  lift?: number;
  discovery?: string;
  spot?: string;
}

export interface Forest {
  id: string;
  kinds: string[];
  /** Typical gap between trunks, in tiles. */
  spacing: number;
  polygon: Array<[number, number]>;
  clearings: Array<MapPoint & { radius: number }>;
}

export interface WorldPath {
  id: string;
  width: number;
  points: Array<[number, number]>;
}

export interface RangeData {
  layer: 'near' | 'mid' | 'far';
  baseLift: number;
  seed: number;
  cliffs: Array<[number, number]>;
  peaks: Array<{ u: number; height: number; spread: number }>;
}

export interface WorldData {
  bounds: { west: number; east: number; north: number; south: number };
  seed: number;
  coast: { beach: number; points: Array<[number, number]>; cliffs: Array<[number, number]> };
  mountains: { foot: Array<[number, number]>; scree: number; ranges: RangeData[] };
  river: {
    pond: MapPoint & { radius: number };
    /** [u, v, width in tiles] from the pond to the sea. */
    points: Array<[number, number, number]>;
  };
  paths: WorldPath[];
  bridges: MapPoint[];
  forests: Forest[];
  features: WorldFeature[];
  /** [u, v, lift] points of the high trail drawn up the mountainside. */
  trail: Array<[number, number, number]>;
  islands: Array<MapPoint & { size: number }>;
  /** Where the boat anchors out at sea for each boat fishing spot. */
  seaSpots: Record<string, MapPoint>;
}

export const WORLD = worldJson as unknown as WorldData;

export const toGrid = (u: number, v: number): GridPoint => ({ col: (v + u) / 2, row: (v - u) / 2 });

export const toMap = (col: number, row: number): MapPoint => ({ u: col - row, v: col + row });

/** Linear interpolation of a profile given as [u, value] points sorted by u. */
export function profileAt(points: ReadonlyArray<readonly [number, number]>, u: number): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return 0;
  if (u <= first[0]) return first[1];
  if (u >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [u1, v1] = points[i] as readonly [number, number];
    const [u0, v0] = points[i - 1] as readonly [number, number];
    if (u <= u1) return v0 + ((v1 - v0) * (u - u0)) / (u1 - u0);
  }
  return last[1];
}

export function insidePolygon(
  polygon: ReadonlyArray<readonly [number, number]>,
  u: number,
  v: number,
) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ui, vi] = polygon[i] as readonly [number, number];
    const [uj, vj] = polygon[j] as readonly [number, number];
    if (vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside;
  }
  return inside;
}

/** World-space rectangle of the whole map. */
export function mapBounds(tileW: number, tileH: number, data: WorldData = WORLD) {
  const { west, east, north, south } = data.bounds;
  return {
    x: (west * tileW) / 2,
    y: (north * tileH) / 2,
    width: ((east - west) * tileW) / 2,
    height: ((south - north) * tileH) / 2,
  };
}

/** World-space point of a map location, optionally lifted up the screen. */
export function mapToScreen(tileW: number, tileH: number, point: MapPoint, lift = 0) {
  return { x: (point.u * tileW) / 2, y: (point.v * tileH) / 2 - lift };
}
