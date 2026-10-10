import { seededRandom } from '../art/terrain/noise';
import { insidePolygon, toGrid, toMap, type Forest } from './WorldMap';
import type { WorldShape } from './WorldShape';

export interface Planting {
  col: number;
  row: number;
  kind: string;
}

const GRID_CLEARANCE = 1.6;
const JITTER = 0.42;
const EDGE_KEEP = 0.45;
const GAP_NOISE = { frequency: 0.35, threshold: 0.32 };
/** Pines this far north (map v) grow tall: the old woods at the valley's head. */
const OLD_WOODS_V = -14;

// Trees on a jittered lattice inside each authored forest. Noise opens natural gaps,
// edges thin out, and nothing lands on paths, water, beaches or the farm.
export function plantForests(shape: WorldShape): Planting[] {
  return shape.data.forests.flatMap((forest, index) => plantForest(shape, forest, index));
}

function plantForest(shape: WorldShape, forest: Forest, index: number): Planting[] {
  const random = seededRandom(shape.data.seed * 101 + index * 17);
  const us = forest.polygon.map(([u]) => u);
  const vs = forest.polygon.map(([, v]) => v);
  const step = forest.spacing;
  const plantings: Planting[] = [];
  for (let v = Math.min(...vs); v <= Math.max(...vs); v += step) {
    const offset = (Math.round(v / step) % 2) * (step / 2);
    for (let u = Math.min(...us) + offset; u <= Math.max(...us); u += step * 2) {
      const pu = u + (random() - 0.5) * 2 * JITTER * step;
      const pv = v + (random() - 0.5) * 2 * JITTER * step;
      const roll = random();
      if (!insidePolygon(forest.polygon, pu, pv)) continue;
      if (forest.clearings.some((c) => Math.hypot(pu - c.u, (pv - c.v) / 2) < c.radius)) continue;
      const { col, row } = toGrid(pu, pv);
      if (!canGrow(shape, col, row)) continue;
      const gap = shape.noise.fbm(col * GAP_NOISE.frequency + 200, row * GAP_NOISE.frequency);
      if (gap < GAP_NOISE.threshold) continue;
      if (nearEdge(forest, pu, pv, step) && roll > EDGE_KEEP) continue;
      plantings.push({ col, row, kind: chooseKind(forest, col, row, random) });
    }
  }
  return plantings;
}

function canGrow(shape: WorldShape, col: number, row: number): boolean {
  if (shape.gridDistance(col, row) < GRID_CLEARANCE) return false;
  if (shape.surface(col, row) !== 'grass') return false;
  if (shape.freshDistance(col, row) < 0.6) return false;
  return !shape.isPath(col, row) && !shape.isPath(col + 0.3, row + 0.3);
}

const nearEdge = (forest: Forest, u: number, v: number, step: number) =>
  [
    [step, 0],
    [-step, 0],
    [0, step],
    [0, -step],
  ].some(([du = 0, dv = 0]) => !insidePolygon(forest.polygon, u + du, v + dv));

function chooseKind(forest: Forest, col: number, row: number, random: () => number): string {
  const kind = forest.kinds[Math.floor(random() * forest.kinds.length)] ?? 'bush';
  if (kind === 'pine' && toMap(col, row).v < OLD_WOODS_V) return 'pineTall';
  return kind;
}

/** Map coordinates of a planting, for tests and debugging. */
export const plantingMap = (planting: Planting) => toMap(planting.col, planting.row);
