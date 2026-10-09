import type { GameBus } from '../events/EventBus';
import type { MoneySource } from '../events/GameEvents';
import type { FarmState } from '../entities/types';

export class EconomySystem {
  constructor(
    private readonly state: FarmState,
    private readonly bus: GameBus,
  ) {}

  balance(): number {
    return this.state.money;
  }

  canAfford(cost: number): boolean {
    return this.state.money >= cost;
  }

  earn(amount: number, source: MoneySource = 'sale'): void {
    if (amount <= 0) return;
    this.change(amount, source);
  }

  spend(cost: number): boolean {
    if (cost < 0 || !this.canAfford(cost)) return false;
    if (cost > 0) this.change(-cost, 'spend');
    return true;
  }

  private change(delta: number, source: MoneySource): void {
    this.state.money += delta;
    this.bus.emit('MoneyChanged', { balance: this.state.money, delta, source });
  }
}
