import type { GameSession } from '@core/GameSession';
import type { Tool } from '../tools';
import { spotKey, spotUnder, type GridPoint } from './spots';

/** Distance (tiles) between points sampled along a fast drag so no tile is skipped. */
const STEP = 0.25;
/** Refusals that just mean "nothing to do on this tile" and stay quiet during a sweep. */
const QUIET = new Set(['Bed is occupied', "Can't build there", 'Nothing to harvest']);

type SweepKind = 'plant' | 'harvest' | 'build';

interface Active {
  kind: SweepKind;
  tool: Tool;
  start: string;
  last: GridPoint;
  visited: Set<string>;
  moved: boolean;
  warned: boolean;
}

// One drag across the farm applies the armed action to every tile it crosses: plant a
// seed, harvest ripe crops, or build. A drag that never leaves its first tile is a tap.
export class FarmSweep {
  private active: Active | null = null;

  constructor(
    private readonly session: GameSession,
    private readonly warn: (message: string, at: GridPoint) => void,
  ) {}

  get isActive(): boolean {
    return this.active !== null;
  }

  /** Starts a sweep if the press lands where the tool can act; returns whether it did. */
  begin(tool: Tool, point: GridPoint): boolean {
    const kind = this.kindFor(tool, point);
    if (!kind) return false;
    this.active = {
      kind,
      tool,
      start: this.keyOf(kind, tool, point),
      last: point,
      visited: new Set(),
      moved: false,
      warned: false,
    };
    return true;
  }

  move(point: GridPoint): void {
    const sweep = this.active;
    if (!sweep) return;
    if (!sweep.moved) {
      if (this.keyOf(sweep.kind, sweep.tool, point) === sweep.start) return;
      sweep.moved = true;
      this.apply(sweep, sweep.last);
    }
    const distance = Math.hypot(point.col - sweep.last.col, point.row - sweep.last.row);
    const steps = Math.max(1, Math.ceil(distance / STEP));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.apply(sweep, {
        col: sweep.last.col + (point.col - sweep.last.col) * t,
        row: sweep.last.row + (point.row - sweep.last.row) * t,
      });
    }
    sweep.last = point;
  }

  /** Ends the sweep; true when it acted on tiles, false when it was only a tap. */
  end(): boolean {
    const moved = this.active?.moved ?? false;
    this.active = null;
    return moved;
  }

  private kindFor(tool: Tool, point: GridPoint): SweepKind | null {
    const { world, plots } = this.session;
    const target = world.objectAt(Math.floor(point.col), Math.floor(point.row));
    const isPlot = target !== undefined && plots.isPlot(target.id);
    if (tool.kind === 'plant' && isPlot) return 'plant';
    if (tool.kind === 'none' && isPlot && plots.isReady(target.id)) return 'harvest';
    if (tool.kind !== 'build') return null;
    const spot = spotUnder(point, world.isEdgeItem(tool.itemId));
    return world.canPlace(tool.itemId, spot) ? 'build' : null;
  }

  private keyOf(kind: SweepKind, tool: Tool, point: GridPoint): string {
    const onEdge = tool.kind === 'build' && this.session.world.isEdgeItem(tool.itemId);
    return kind === 'build' ? spotKey(spotUnder(point, onEdge)) : spotKey(spotUnder(point, false));
  }

  private apply(sweep: Active, point: GridPoint): void {
    const key = this.keyOf(sweep.kind, sweep.tool, point);
    if (sweep.visited.has(key)) return;
    sweep.visited.add(key);
    const reason = this.act(sweep, point);
    if (!reason || QUIET.has(reason) || sweep.warned) return;
    sweep.warned = true;
    this.warn(reason, point);
  }

  // Returns why the tile was refused, if it was.
  private act({ kind, tool }: Active, point: GridPoint): string | null {
    const { world, plots, farm } = this.session;
    if (kind === 'build' && tool.kind === 'build') {
      const result = farm.build(tool.itemId, spotUnder(point, world.isEdgeItem(tool.itemId)));
      return result.ok ? null : result.reason;
    }
    const target = world.objectAt(Math.floor(point.col), Math.floor(point.row));
    if (!target || !plots.isPlot(target.id)) return null;
    if (kind === 'harvest') {
      if (!plots.isReady(target.id)) return null;
      const result = farm.harvest(target.id);
      return result.ok ? null : result.reason;
    }
    if (tool.kind !== 'plant' || !plots.isEmpty(target.id)) return null;
    const result = farm.plant(target.id, tool.cropId);
    return result.ok ? null : result.reason;
  }
}
