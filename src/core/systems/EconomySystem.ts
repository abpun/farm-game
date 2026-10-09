import type { GameBus } from '../events/EventBus';
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

  earn(amount: number): void {
    this.change(amount);
  }

  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.change(-cost);
    return true;
  }

  private change(delta: number): void {
    this.state.money += delta;
    this.bus.emit('MoneyChanged', { balance: this.state.money, delta });
  }
}
