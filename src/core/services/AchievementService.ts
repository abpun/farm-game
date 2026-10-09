import { fail, ok, type ActionResult } from '../actions';
import type { AchievementDef } from '../entities/content';
import type { StatsSystem } from '../systems/StatsSystem';
import type { GameContext } from './GameContext';
import { grantReward } from './rewards';

export type AchievementStatus = 'locked' | 'progress' | 'completed' | 'claimed';

/** Live values that are not simple counters. */
export interface Gauges {
  productiveAnimals: () => number;
  fishSpecies: () => number;
}

// Completion is detected automatically from stats; each reward is claimed exactly once.
export class AchievementService {
  constructor(
    private readonly ctx: GameContext,
    private readonly stats: StatsSystem,
    private readonly gauges: Gauges,
  ) {}

  all(): AchievementDef[] {
    return this.ctx.content.achievements.all();
  }

  /** A target of -1 means "every kind there is". */
  target(achievement: AchievementDef): number {
    if (achievement.target >= 0) return achievement.target;
    if (achievement.stat === 'fishSpecies') return this.ctx.content.fish.all().length;
    if (achievement.stat === 'cropTypes') return this.ctx.content.crops.all().length;
    if (achievement.stat === 'discoveries') return this.ctx.content.discoveries.all().length;
    if (achievement.stat === 'spotsFished') return this.ctx.content.spots.all().length;
    throw new Error(`${achievement.id}: target -1 is not supported for ${achievement.stat}`);
  }

  value(stat: string): number {
    switch (stat) {
      case 'level':
        return this.ctx.progression.level();
      case 'reputation':
        return this.ctx.state.orders.reputation;
      case 'cropTypes':
        return this.stats.cropTypes();
      case 'spotsFished':
        return this.stats.spotsFished();
      case 'fishSpecies':
        return this.gauges.fishSpecies();
      case 'productiveAnimals':
        return this.gauges.productiveAnimals();
      default:
        return this.stats.get(stat);
    }
  }

  progress(achievement: AchievementDef): number {
    if (this.ctx.state.achievements[achievement.id]) return 1;
    return Math.min(1, this.value(achievement.stat) / this.target(achievement));
  }

  status(achievement: AchievementDef): AchievementStatus {
    const record = this.ctx.state.achievements[achievement.id];
    if (record) return record.claimed ? 'claimed' : 'completed';
    return this.value(achievement.stat) > 0 ? 'progress' : 'locked';
  }

  unclaimedCount(): number {
    return Object.values(this.ctx.state.achievements).filter((a) => !a.claimed).length;
  }

  /** Marks newly reached achievements as completed. */
  check(): void {
    for (const achievement of this.all()) {
      if (this.ctx.state.achievements[achievement.id]) continue;
      if (this.value(achievement.stat) < this.target(achievement)) continue;
      this.ctx.state.achievements[achievement.id] = {
        completedAt: this.ctx.time.now(),
        claimed: false,
      };
      this.ctx.bus.emit('AchievementCompleted', { id: achievement.id });
    }
  }

  claim(id: string): ActionResult {
    const record = this.ctx.state.achievements[id];
    if (!record) return fail('Not completed yet');
    if (record.claimed) return fail('Already claimed');
    record.claimed = true;
    grantReward(this.ctx, this.ctx.content.achievements.get(id).reward);
    this.ctx.bus.emit('AchievementClaimed', { id });
    return ok;
  }
}
