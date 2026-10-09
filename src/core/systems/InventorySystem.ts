import type { GameBus } from '../events/EventBus';
import type { FarmState } from '../entities/types';

export class InventorySystem {
  constructor(
    private readonly state: FarmState,
    private readonly bus: GameBus,
  ) {}

  count(cropId: string): number {
    return this.state.inventory[cropId] ?? 0;
  }

  add(cropId: string, amount: number): void {
    this.set(cropId, this.count(cropId) + amount);
  }

  remove(cropId: string, amount: number): boolean {
    if (amount <= 0 || this.count(cropId) < amount) return false;
    this.set(cropId, this.count(cropId) - amount);
    return true;
  }

  private set(cropId: string, count: number): void {
    this.state.inventory[cropId] = count;
    this.bus.emit('InventoryChanged', { cropId, count });
  }
}
