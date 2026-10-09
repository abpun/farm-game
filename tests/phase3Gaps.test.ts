import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@core/save/KeyValueStore';
import { buildReady, FakeClock, newSession, richSession } from './helpers';

// Acceptance cases from the Phase 3 brief that cut across several systems.
describe('phase 3 reliability', () => {
  it('keeps a half-finished batch across a reload and pays it once', () => {
    const store = new MemoryStore();
    const clock = new FakeClock();
    const first = richSession(20, { store, clock });
    const mill = buildReady(first, 'grain-mill');
    first.inventory.add('wheat', 3);
    first.production.start(mill, 'flour');
    first.update(5);
    first.save();

    const second = richSession(20, { store, clock });
    expect(second.inventory.count('wheat')).toBe(0);
    expect(second.production.readyCount(mill)).toBe(0);
    expect(second.production.collect(mill).ok).toBe(false);
    second.update(second.content.recipes.get('flour').durationSec);
    expect(second.production.collect(mill).ok).toBe(true);
    second.save();

    const third = richSession(20, { store, clock });
    expect(third.inventory.count('flour')).toBe(1);
    expect(third.production.collect(mill).ok).toBe(false);
  });

  it('rejects unknown, unaccepted and repeated deliveries without touching the barn', () => {
    const session = newSession();
    const offer = session.orders.offers()[0]!;
    for (const [id, count] of Object.entries(offer.items)) session.inventory.add(id, count, true);
    const before = session.economy.balance();
    expect(session.orders.deliver(999_999).ok).toBe(false);
    expect(session.orders.deliver(offer.id).ok).toBe(false);
    expect(session.orders.accept(999_999).ok).toBe(false);
    expect(session.economy.balance()).toBe(before);
    for (const [id, count] of Object.entries(offer.items)) {
      expect(session.inventory.count(id)).toBe(count);
    }

    expect(session.orders.accept(offer.id).ok).toBe(true);
    expect(session.orders.accept(offer.id).ok).toBe(false);
    expect(session.orders.deliver(offer.id).ok).toBe(true);
    expect(session.orders.deliver(offer.id).ok).toBe(false);
    const bonus = session.orders.history()[0]?.bonusEarned ? offer.bonusCoins : 0;
    expect(session.economy.balance()).toBe(before + offer.coins + bonus);
  });

  it('does not ask for crops that cannot grow this season unless some are stored', () => {
    const session = newSession();
    session.state.level = 20;
    const dormant = session.crops.all().find((crop) => session.plots.seasonRate(crop.id) <= 0);
    if (!dormant) return;
    expect(session.orders.obtainableItems().has(dormant.id)).toBe(false);
    session.inventory.add(dormant.id, 1);
    expect(session.orders.obtainableItems().has(dormant.id)).toBe(true);
  });

  it('reports a failed save instead of failing silently', () => {
    const store = new MemoryStore();
    const session = newSession({ store });
    let failures = 0;
    session.bus.on('SaveFailed', () => failures++);
    store.setItem = () => {
      throw new Error('quota exceeded');
    };
    expect(session.save()).toBe(false);
    expect(failures).toBe(1);
  });

  it('pays item rewards from trophies exactly once', () => {
    const session = richSession(20);
    const withItems = session.content.achievements.all().find((a) => a.reward.items);
    expect(withItems).toBeDefined();
    session.state.achievements[withItems!.id] = { completedAt: 0, claimed: false };
    expect(session.achievements.claim(withItems!.id).ok).toBe(true);
    expect(session.achievements.claim(withItems!.id).ok).toBe(false);
    for (const [id, count] of Object.entries(withItems!.reward.items!)) {
      expect(session.inventory.count(id)).toBe(count);
    }
  });

  it('sells the next fishing rod only to qualified, paying players', () => {
    const session = newSession();
    const next = session.fishing.nextRod()!;
    expect(session.fishing.upgradeRod().ok).toBe(false);
    session.state.fishing.xp = 10_000;
    session.economy.earn(next.price - session.economy.balance() - 1);
    expect(session.fishing.upgradeRod()).toEqual({ ok: false, reason: 'Not enough money' });
    session.economy.earn(1);
    expect(session.fishing.upgradeRod().ok).toBe(true);
    expect(session.fishing.rod().id).toBe(next.id);
    expect(session.economy.balance()).toBe(0);
  });
});
