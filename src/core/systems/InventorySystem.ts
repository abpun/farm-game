import type { ItemRegistry } from '../config/ItemRegistry';
import type { Quantities, StorageLevel } from '../entities/content';
import type { FarmState } from '../entities/types';
import type { GameBus } from '../events/EventBus';

// The one authoritative item store, shared by every feature, with a barn capacity.
export class InventorySystem {
  constructor(
    private readonly state: FarmState,
    private readonly items: ItemRegistry,
    private readonly storage: readonly StorageLevel[],
    private readonly bus: GameBus,
  ) {}

  count(itemId: string): number {
    return this.state.inventory[itemId] ?? 0;
  }

  /** Items currently held, in registry order. */
  entries(): Array<[string, number]> {
    return this.items
      .all()
      .map((item): [string, number] => [item.id, this.count(item.id)])
      .filter(([, count]) => count > 0);
  }

  used(): number {
    return Object.values(this.state.inventory).reduce((sum, count) => sum + count, 0);
  }

  capacity(): number {
    return this.storageLevel(this.state.storageLevel)?.capacity ?? 0;
  }

  freeSpace(): number {
    return Math.max(0, this.capacity() - this.used());
  }

  canFit(amount: number): boolean {
    return amount <= this.freeSpace();
  }

  /** The next storage upgrade, or undefined at the top level. */
  nextStorage(): StorageLevel | undefined {
    return this.storageLevel(this.state.storageLevel + 1);
  }

  upgradeStorage(): void {
    this.state.storageLevel += 1;
  }

  has(quantities: Quantities): boolean {
    return Object.entries(quantities).every(([id, count]) => this.count(id) >= count);
  }

  /** Adds unless the barn would overflow; `force` is for rewards that must never be lost. */
  add(itemId: string, amount: number, force = false): boolean {
    if (amount <= 0 || !this.items.has(itemId)) return false;
    if (!force && !this.canFit(amount)) return false;
    this.set(itemId, this.count(itemId) + amount);
    return true;
  }

  /** Adds every item or none of them. */
  addAll(quantities: Quantities, force = false): boolean {
    const total = Object.values(quantities).reduce((sum, count) => sum + count, 0);
    if (!force && !this.canFit(total)) return false;
    if (Object.keys(quantities).some((id) => !this.items.has(id))) return false;
    for (const [id, count] of Object.entries(quantities)) this.add(id, count, true);
    return true;
  }

  remove(itemId: string, amount: number): boolean {
    if (amount <= 0 || !Number.isInteger(amount) || this.count(itemId) < amount) return false;
    this.set(itemId, this.count(itemId) - amount);
    return true;
  }

  /** Removes every item or none of them. */
  removeAll(quantities: Quantities): boolean {
    if (!this.has(quantities)) return false;
    for (const [id, count] of Object.entries(quantities)) this.remove(id, count);
    return true;
  }

  private storageLevel(level: number): StorageLevel | undefined {
    return this.storage[level - 1];
  }

  private set(itemId: string, count: number): void {
    if (count === 0) delete this.state.inventory[itemId];
    else this.state.inventory[itemId] = count;
    this.bus.emit('InventoryChanged', { itemId, count });
  }
}
