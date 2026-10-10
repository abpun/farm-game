import { polylineDistance } from '@core/config/geometry';
import { profileAt, toGrid, WORLD, type MapPoint } from '../map/WorldMap';

const NEAR = { coast: 12, river: 6, falls: 9 } as const;
/** How loud the sea bed loop plays: by the shore, inland, and underground. */
export const BED_LEVEL = { coast: 1, inland: 0.4, underground: 0 } as const;

const river = WORLD.river.points.map(([u, v]): [number, number] => {
  const g = toGrid(u, v);
  return [g.col, g.row];
});

/** Ambient features around a listening point: what the player would hear from there. */
export function surroundings(point: MapPoint | null, animals: Iterable<string>): Set<string> {
  if (!point) return new Set(['place:mine']);
  const features = new Set<string>(['outdoors', ...animals]);
  if (point.v > profileAt(WORLD.coast.points, point.u) - NEAR.coast) features.add('near:coast');
  const { col, row } = toGrid(point.u, point.v);
  if (polylineDistance(river, col, row) < NEAR.river) features.add('near:river');
  const pond = toGrid(WORLD.river.pond.u, WORLD.river.pond.v);
  if (Math.hypot(col - pond.col, row - pond.row) < NEAR.falls) features.add('near:falls');
  return features;
}

export function bedLevel(features: ReadonlySet<string>): number {
  if (features.has('place:mine')) return BED_LEVEL.underground;
  return features.has('near:coast') ? BED_LEVEL.coast : BED_LEVEL.inland;
}
