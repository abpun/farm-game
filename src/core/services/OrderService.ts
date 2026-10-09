import { fail, ok, type ActionResult } from '../actions';
import type { OrderDifficultyDef, OrdersData, Quantities } from '../entities/content';
import type { Order } from '../entities/types';
import { pick, randomBetween, randomInt, sample } from '../random';
import type { FishingService } from './FishingService';
import type { GameContext } from './GameContext';

const UNCATCHABLE_FOR_ORDERS = new Set(['rare', 'legendary']);

// Delivery board: offers refill over time, accepted orders run against a deadline,
// and delivering consumes every requested item before the reward is paid exactly once.
export class OrderService {
  constructor(
    private readonly ctx: GameContext,
    private readonly fishing: FishingService,
    private readonly dayLengthSec: number,
  ) {}

  private get data(): OrdersData {
    return this.ctx.content.config.orders;
  }

  private get orders() {
    return this.ctx.state.orders;
  }

  reputation(): number {
    return this.orders.reputation;
  }

  slots(): number {
    const tiers = this.data.boardSlots.filter((tier) => this.orders.reputation >= tier.reputation);
    return tiers[tiers.length - 1]?.slots ?? 0;
  }

  offers(): readonly Order[] {
    return this.orders.offers;
  }

  active(): readonly Order[] {
    return this.orders.active;
  }

  history(): readonly Order[] {
    return this.orders.history;
  }

  daily(): Order | null {
    return this.orders.daily;
  }

  /** Game time at which the next empty board slot refills, if any. */
  nextRefill(): number | null {
    return this.orders.refills.length ? Math.min(...this.orders.refills) : null;
  }

  deadline(order: Order): number | null {
    return order.acceptedAt === null ? null : order.acceptedAt + order.durationSec;
  }

  canDeliver(order: Order): boolean {
    return order.status === 'active' && this.ctx.inventory.has(order.items);
  }

  /** Refills the board, expires late orders and rolls the daily contract. */
  update(): void {
    const now = this.ctx.time.now();
    let changed = this.expireLate(now);
    const due = this.orders.refills.filter((at) => at <= now);
    if (due.length > 0) {
      this.orders.refills = this.orders.refills.filter((at) => at > now);
      changed = true;
    }
    while (this.orders.offers.length + this.orders.refills.length < this.slots()) {
      const order = this.generate(false);
      if (!order) break;
      this.orders.offers.push(order);
      changed = true;
    }
    if (this.rollDaily(now)) changed = true;
    if (changed) this.ctx.bus.emit('OrdersChanged', {});
  }

  accept(orderId: number): ActionResult {
    const daily = this.orders.daily;
    const isDaily = daily?.id === orderId && daily.status === 'available';
    const index = this.orders.offers.findIndex((order) => order.id === orderId);
    if (index < 0 && !isDaily) return fail('That order is gone');
    if (this.orders.active.length >= this.data.maxActive) {
      return fail(`You can run ${this.data.maxActive} orders at once`);
    }
    const now = this.ctx.time.now();
    const order = isDaily ? (daily as Order) : (this.orders.offers.splice(index, 1)[0] as Order);
    order.status = 'active';
    order.acceptedAt = now;
    if (isDaily) {
      order.durationSec = this.dayEnd(now) - now;
      order.bonusWithinSec = Math.round(order.durationSec * this.data.bonus.withinFraction);
      this.orders.daily = null;
    } else {
      this.orders.refills.push(now + this.data.refreshCooldownSec);
    }
    this.orders.active.push(order);
    this.ctx.bus.emit('OrdersChanged', {});
    return ok;
  }

  /** Turns down an offer; a fresh one arrives after the cooldown. */
  discard(orderId: number): ActionResult {
    const index = this.orders.offers.findIndex((order) => order.id === orderId);
    if (index < 0) return fail('That order is gone');
    this.orders.offers.splice(index, 1);
    this.orders.refills.push(this.ctx.time.now() + this.data.refreshCooldownSec);
    this.ctx.bus.emit('OrdersChanged', {});
    return ok;
  }

  /** Gives up an active order; it counts as expired. */
  abandon(orderId: number): ActionResult {
    const order = this.orders.active.find((o) => o.id === orderId);
    if (!order) return fail('That order is gone');
    this.close(order, 'expired');
    this.ctx.bus.emit('OrderExpired', { order });
    this.ctx.bus.emit('OrdersChanged', {});
    return ok;
  }

  deliver(orderId: number): ActionResult {
    const { inventory, economy, progression, time, bus } = this.ctx;
    const order = this.orders.active.find((o) => o.id === orderId);
    if (!order || order.status !== 'active') return fail('That order is not active');
    const now = time.now();
    if (now > (this.deadline(order) ?? Infinity)) {
      this.expireLate(now);
      return fail('Too late, the order expired');
    }
    if (!inventory.removeAll(order.items)) return fail('Missing items');
    order.bonusEarned = now - (order.acceptedAt ?? now) <= order.bonusWithinSec;
    this.close(order, 'completed');
    const bonus = order.bonusEarned;
    economy.earn(order.coins + (bonus ? order.bonusCoins : 0), 'order');
    this.orders.reputation += order.reputation + (bonus ? this.data.bonus.reputation : 0);
    progression.addXp(order.xp);
    bus.emit('OrderCompleted', { order });
    bus.emit('OrdersChanged', {});
    return ok;
  }

  /** Items the player can realistically produce right now, for order generation. */
  obtainableItems(): Set<string> {
    const { content, progression, world } = this.ctx;
    const items = new Set<string>();
    for (const crop of content.crops.all()) {
      if (progression.isUnlocked(crop.unlockLevel)) items.add(crop.id);
    }
    for (const spot of content.spots.all()) {
      if (this.fishing.spotBlocker(spot.id)) continue;
      for (const fish of this.fishing.catchable(spot.id)) {
        if (!UNCATCHABLE_FOR_ORDERS.has(fish.rarity)) items.add(fish.id);
      }
    }
    for (const animal of content.animals.all()) {
      if (world.countOf(animal.housing) > 0) items.add(animal.product);
    }
    let grew = true;
    while (grew) {
      grew = false;
      for (const recipe of content.recipes.all()) {
        if (world.countOf(recipe.building) === 0) continue;
        if (!progression.isUnlocked(recipe.unlockLevel)) continue;
        if (!Object.keys(recipe.inputs).every((id) => items.has(id))) continue;
        for (const id of Object.keys(recipe.outputs)) {
          if (!items.has(id)) {
            items.add(id);
            grew = true;
          }
        }
      }
    }
    return items;
  }

  private rollDaily(now: number): boolean {
    const day = Math.floor(now / this.dayLengthSec) + 1;
    if (this.orders.dailyDay === day) return false;
    if (!this.ctx.progression.isUnlocked(this.data.daily.unlockLevel)) return false;
    this.orders.dailyDay = day;
    this.orders.daily = this.generate(true);
    return true;
  }

  private dayEnd(now: number): number {
    return (Math.floor(now / this.dayLengthSec) + 1) * this.dayLengthSec;
  }

  private expireLate(now: number): boolean {
    const late = this.orders.active.filter((order) => now > (this.deadline(order) ?? Infinity));
    for (const order of late) {
      this.close(order, 'expired');
      this.ctx.bus.emit('OrderExpired', { order });
    }
    return late.length > 0;
  }

  private close(order: Order, status: 'completed' | 'expired'): void {
    order.status = status;
    order.closedAt = this.ctx.time.now();
    this.orders.active = this.orders.active.filter((o) => o.id !== order.id);
    this.orders.history.unshift(order);
    this.orders.history.length = Math.min(this.orders.history.length, this.data.historySize);
  }

  private generate(daily: boolean): Order | null {
    const { random, content, progression, time } = this.ctx;
    const obtainable = this.obtainableItems();
    const level = progression.level();
    const categories = this.data.categories
      .filter((c) => progression.isUnlocked(c.unlockLevel))
      .map((c) => ({
        category: c,
        pool: [...obtainable].filter((id) =>
          c.itemCategories.includes(content.items.get(id).category),
        ),
      }))
      .filter(({ pool }) => pool.length > 0);
    if (categories.length === 0) return null;
    const { category, pool } = pick(random, categories);
    const difficulty = daily ? this.dailyDifficulty() : this.rollDifficulty();
    const [minItems, maxItems] = difficulty.items;
    const chosen = sample(random, pool, randomInt(random, minItems, maxItems));
    const target =
      randomBetween(random, ...difficulty.value) * (1 + difficulty.valuePerLevel * (level - 1));
    const items: Quantities = {};
    for (const id of chosen) {
      const price = Math.max(1, content.items.get(id).sellPrice);
      items[id] = Math.max(
        1,
        Math.min(this.data.maxQuantity, Math.round(target / chosen.length / price)),
      );
    }
    const multiplier = daily ? this.data.daily.rewardMultiplier : difficulty.rewardMultiplier;
    const coins = Math.round(content.items.value(items) * multiplier);
    const durationSec = difficulty.deadlineDays * this.dayLengthSec;
    return {
      id: this.orders.nextId++,
      customer: pick(random, this.data.customers),
      category: category.id,
      difficulty: difficulty.id,
      items,
      coins,
      xp: Math.max(1, Math.round(coins * difficulty.xpPerCoin)),
      reputation: daily ? this.data.daily.reputation : difficulty.reputation,
      status: 'available',
      createdAt: time.now(),
      durationSec,
      acceptedAt: null,
      closedAt: null,
      bonusWithinSec: Math.round(durationSec * this.data.bonus.withinFraction),
      bonusCoins: Math.round(coins * this.data.bonus.coinsFraction),
      bonusEarned: false,
      daily,
    };
  }

  private rollDifficulty(): OrderDifficultyDef {
    const unlocked = this.data.difficulties.filter((d) =>
      this.ctx.progression.isUnlocked(d.unlockLevel),
    );
    return pick(this.ctx.random, unlocked.length ? unlocked : this.data.difficulties);
  }

  private dailyDifficulty(): OrderDifficultyDef {
    const id = this.data.daily.difficulty;
    const found = this.data.difficulties.find((d) => d.id === id);
    if (!found) throw new Error(`Unknown daily difficulty ${id}`);
    return found;
  }
}
