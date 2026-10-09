import { toGrid, toMap, type GridPoint } from './WorldMap';
import type { WorldShape } from './WorldShape';

export interface Dressing extends GridPoint {
  kind: 'reeds' | 'lily' | 'shell' | 'driftwood' | 'signpost';
}

const REED_STEP = 1.4;
const BANK_OFFSET = 0.35;
const POND_REEDS = 14;
const POND_LILIES = 7;
const SHELL_STEP = 3.3;
const DRIFTWOOD_EVERY = 4;
const BRIDGE_CLEARANCE = 1.6;

// Small details that follow the geography: reeds on the banks, lilies on the pond,
// shells and driftwood along the tide line, signposts at trail junctions.
export function dressWorld(shape: WorldShape): Dressing[] {
  return [...riverbank(shape), ...pond(shape), ...beach(shape), ...junctions(shape)];
}

function riverbank(shape: WorldShape): Dressing[] {
  const result: Dressing[] = [];
  const points = shape.data.river.points.map(([u, v, w]) => ({ ...toGrid(u, v), w }));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const length = Math.hypot(b.col - a.col, b.row - a.row);
    const normal = { col: -(b.row - a.row) / length, row: (b.col - a.col) / length };
    for (let d = 0; d < length; d += REED_STEP) {
      const t = d / length;
      const half = (a.w + (b.w - a.w) * t) / 2 + BANK_OFFSET;
      for (const side of [-1, 1]) {
        const jitter = shape.noise.hash(i * 31 + Math.round(d * 10), side + 5) - 0.5;
        const col = a.col + (b.col - a.col) * t + normal.col * side * (half + jitter * 0.3);
        const row = a.row + (b.row - a.row) * t + normal.row * side * (half + jitter * 0.3);
        if (shape.noise.hash(Math.round(col * 5), Math.round(row * 5)) < 0.35) continue;
        if (fits(shape, col, row)) result.push({ kind: 'reeds', col, row });
      }
    }
  }
  return result;
}

function pond(shape: WorldShape): Dressing[] {
  const { u, v, radius } = shape.data.river.pond;
  const center = toGrid(u, v);
  const result: Dressing[] = [];
  for (let i = 0; i < POND_REEDS; i++) {
    const angle = (i / POND_REEDS) * Math.PI * 2 + shape.noise.hash(i, 77);
    for (let r = radius; r < radius + 3; r += 0.25) {
      const col = center.col + Math.cos(angle) * r;
      const row = center.row + Math.sin(angle) * r;
      if (shape.surface(col, row) === 'fresh') continue;
      if (fits(shape, col, row)) result.push({ kind: 'reeds', col, row });
      break;
    }
  }
  for (let i = 0; i < POND_LILIES; i++) {
    const angle = shape.noise.hash(i, 91) * Math.PI * 2;
    const r = radius * (0.35 + shape.noise.hash(i, 92) * 0.45);
    const col = center.col + Math.cos(angle) * r;
    const row = center.row + Math.sin(angle) * r;
    if (shape.surface(col, row) === 'fresh') result.push({ kind: 'lily', col, row });
  }
  return result;
}

function beach(shape: WorldShape): Dressing[] {
  const result: Dressing[] = [];
  const { west, east } = shape.data.bounds;
  let index = 0;
  for (let u = west + 2; u < east - 2; u += SHELL_STEP, index++) {
    const v = shape.coastAt(u) - 1.2 - shape.noise.hash(index, 3) * 1.4;
    const { col, row } = toGrid(u, v);
    if (shape.surface(col, row) !== 'sand' || shape.isPath(col, row)) continue;
    result.push({ kind: index % DRIFTWOOD_EVERY === 0 ? 'driftwood' : 'shell', col, row });
  }
  return result;
}

// A signpost where trails meet, so the player can read the valley's routes at a glance.
function junctions(shape: WorldShape): Dressing[] {
  const starts = shape.data.paths.map((path) => path.points[0]).filter(Boolean);
  return starts.flatMap((point) => {
    const [u = 0, v = 0] = point ?? [];
    const { col, row } = toGrid(u + 0.9, v - 0.4);
    if (shape.isWater(col, row) || shape.gridDistance(col, row) < 0.6) return [];
    return [{ kind: 'signpost' as const, col, row }];
  });
}

function fits(shape: WorldShape, col: number, row: number): boolean {
  if (shape.isWater(col, row) || shape.isPath(col, row)) return false;
  if (shape.gridDistance(col, row) < 1) return false;
  const { u, v } = toMap(col, row);
  return !shape.data.bridges.some((b) => Math.hypot(b.u - u, (b.v - v) / 2) < BRIDGE_CLEARANCE);
}
