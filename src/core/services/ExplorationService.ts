import { fail, ok, type ActionResult } from '../actions';
import type { DiscoveryDef } from '../entities/content';
import type { GameContext } from './GameContext';
import { grantReward } from './rewards';

/** Exposes the pickaxe tier without a hard dependency on the mining service. */
export type PickaxeTier = () => number;

// Hidden chests, viewpoints and trail obstacles: each can be found once, for one reward.
export class ExplorationService {
  constructor(
    private readonly ctx: GameContext,
    private readonly pickaxeTier: PickaxeTier,
  ) {}

  all(): DiscoveryDef[] {
    return this.ctx.content.discoveries.all();
  }

  isFound(id: string): boolean {
    return this.ctx.state.exploration.found.includes(id);
  }

  foundCount(): number {
    return this.ctx.state.exploration.found.length;
  }

  /** Why a discovery can't be made yet, or null if it can. */
  blocker(id: string): string | null {
    const discovery = this.ctx.content.discoveries.find(id);
    if (!discovery) return 'Nothing here';
    if (this.isFound(id)) return 'Already found';
    const { level, pickaxeTier, discovered } = discovery.requires;
    if (level !== undefined && !this.ctx.progression.isUnlocked(level)) {
      return `Come back at level ${level}`;
    }
    if (pickaxeTier !== undefined && this.pickaxeTier() < pickaxeTier) {
      const pick = this.ctx.content.pickaxes.all().find((p) => p.tier >= pickaxeTier);
      return `Needs a ${pick?.name ?? 'better pickaxe'} to clear`;
    }
    if (discovered !== undefined && !this.isFound(discovered)) {
      return `Blocked by the ${this.ctx.content.discoveries.get(discovered).name.toLowerCase()}`;
    }
    return null;
  }

  discover(id: string): ActionResult {
    const blocker = this.blocker(id);
    if (blocker) return fail(blocker);
    const discovery = this.ctx.content.discoveries.get(id);
    this.ctx.state.exploration.found.push(id);
    grantReward(this.ctx, discovery.reward);
    this.ctx.bus.emit('DiscoveryFound', { id, kind: discovery.kind });
    return ok;
  }
}
