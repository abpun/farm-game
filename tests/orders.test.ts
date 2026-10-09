import { describe, expect, it } from 'vitest';
import type { GameSession } from '@core/GameSession';
import { buildAnywhere, config, newSession, richSession } from './helpers';

const stock = (session: GameSession, items: Record<string, number>) => {
  for (const [id, count] of Object.entries(items)) session.inventory.add(id, count, true);
};

describe('delivery orders', () => {
  it('fills the board with orders for things the player can produce', () => {
    const session = newSession();
    const offers = session.orders.offers();
    expect(offers).toHaveLength(session.orders.slots());
    const obtainable = session.orders.obtainableItems();
    for (const order of offers) {
      for (const id of Object.keys(order.items)) expect(obtainable.has(id)).toBe(true);
      expect(order.coins).toBeGreaterThan(session.content.items.value(order.items));
    }
  });

  it('only asks for goods and animal products once their buildings exist', () => {
    const session = richSession(20);
    expect(session.orders.obtainableItems().has('egg')).toBe(false);
    expect(session.orders.obtainableItems().has('flour')).toBe(false);
    buildAnywhere(session, 'coop');
    buildAnywhere(session, 'grain-mill');
    buildAnywhere(session, 'bakery');
    const items = session.orders.obtainableItems();
    expect(items.has('egg')).toBe(true);
    expect(items.has('flour')).toBe(true);
    expect(items.has('bread')).toBe(true);
    expect(items.has('cheese')).toBe(false);
  });

  it('accepts, delivers and pays the reward exactly once', () => {
    const session = newSession();
    const order = session.orders.offers()[0]!;
    expect(session.orders.deliver(order.id)).toEqual({
      ok: false,
      reason: 'That order is not active',
    });
    expect(session.orders.accept(order.id).ok).toBe(true);
    expect(session.orders.deliver(order.id)).toEqual({ ok: false, reason: 'Missing items' });

    stock(session, order.items);
    const before = session.economy.balance();
    expect(session.orders.deliver(order.id).ok).toBe(true);
    const paid = session.economy.balance() - before;
    expect(paid).toBe(order.coins + order.bonusCoins);
    expect(session.inventory.used()).toBe(0);
    expect(session.orders.history()[0]?.status).toBe('completed');
    expect(session.orders.reputation()).toBeGreaterThan(0);

    stock(session, order.items);
    expect(session.orders.deliver(order.id).ok).toBe(false);
    expect(session.economy.balance() - before).toBe(paid);
  });

  it('expires accepted orders after their deadline', () => {
    const session = newSession();
    const order = session.orders.offers()[0]!;
    session.orders.accept(order.id);
    stock(session, order.items);
    session.update(order.durationSec + 1);
    expect(session.orders.active()).toHaveLength(0);
    expect(session.orders.history()[0]?.status).toBe('expired');
    expect(session.orders.deliver(order.id).ok).toBe(false);
  });

  it('refills discarded and accepted slots after the cooldown', () => {
    const session = newSession();
    const slots = session.orders.slots();
    session.orders.discard(session.orders.offers()[0]!.id);
    expect(session.orders.offers()).toHaveLength(slots - 1);
    session.update(config.orders.refreshCooldownSec + 1);
    expect(session.orders.offers()).toHaveLength(slots);
  });

  it('limits how many orders run at once', () => {
    const session = richSession(20);
    session.update(config.orders.refreshCooldownSec * 10);
    for (let i = 0; i < config.orders.maxActive; i++) {
      session.update(config.orders.refreshCooldownSec + 1);
      expect(session.orders.accept(session.orders.offers()[0]!.id).ok).toBe(true);
    }
    session.update(config.orders.refreshCooldownSec + 1);
    expect(session.orders.accept(session.orders.offers()[0]!.id).ok).toBe(false);
  });

  it('offers one daily contract per game day', () => {
    const session = richSession(5);
    session.update(0.1);
    const daily = session.orders.daily()!;
    expect(daily.daily).toBe(true);
    expect(session.orders.accept(daily.id).ok).toBe(true);
    expect(session.orders.daily()).toBeNull();
    session.update(config.farm.dayLengthSec);
    expect(session.orders.daily()?.id).not.toBe(daily.id);
  });
});
