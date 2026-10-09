import type { LevelDef } from '../entities/content';
import type { FarmState } from '../entities/types';
import type { GameBus } from '../events/EventBus';
import type { EconomySystem } from './EconomySystem';

// Player XP and level; level-up coins are paid exactly once because the level is saved with them.
export class ProgressionSystem {
  constructor(
    private readonly state: FarmState,
    private readonly levels: readonly LevelDef[],
    private readonly economy: EconomySystem,
    private readonly bus: GameBus,
  ) {}

  level(): number {
    return this.state.level;
  }

  xp(): number {
    return this.state.xp;
  }

  maxLevel(): number {
    return this.levels.length;
  }

  /** XP progress within the current level, as [earned, needed]; needed is 0 at max level. */
  levelProgress(): [number, number] {
    const current = this.levels[this.state.level - 1]?.xp ?? 0;
    const next = this.levels[this.state.level]?.xp;
    if (next === undefined) return [0, 0];
    return [this.state.xp - current, next - current];
  }

  isUnlocked(requiredLevel = 1): boolean {
    return this.state.level >= requiredLevel;
  }

  addXp(amount: number): void {
    if (amount <= 0) return;
    this.state.xp += Math.round(amount);
    this.bus.emit('XpGained', { amount, xp: this.state.xp });
    let next = this.levels[this.state.level];
    while (next && this.state.xp >= next.xp) {
      this.state.level += 1;
      this.economy.earn(next.coins, 'reward');
      this.bus.emit('LevelUp', { level: this.state.level, coins: next.coins });
      next = this.levels[this.state.level];
    }
  }
}
