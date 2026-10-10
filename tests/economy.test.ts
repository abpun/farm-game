import { describe, expect, it } from 'vitest';
import { Content } from '@core/config/Content';
import { config, newSession, richSession } from './helpers';

const content = new Content(config);

describe('item economy', () => {
  it('never sells anything cheaper than it buys back', () => {
    for (const item of content.items.buyable()) {
      expect(item.buyPrice!).toBeGreaterThan(item.sellPrice);
    }
  });

  it('makes processed goods worth more than their ingredients', () => {
    for (const recipe of content.recipes.all()) {
      const outputs = Object.keys(recipe.outputs).map((id) => content.items.get(id));
      if (outputs.some((item) => item.category === 'supply')) continue;
      expect(content.items.value(recipe.outputs)).toBeGreaterThan(
        content.items.value(recipe.inputs),
      );
      expect(content.items.value(recipe.outputs)).toBeLessThan(
        content.items.value(recipe.inputs) * 2,
      );
    }
  });

  it('has no buy-craft-sell loop that prints coins', () => {
    for (const recipe of content.recipes.all()) {
      const inputs = Object.entries(recipe.inputs);
      if (!inputs.every(([id]) => content.items.get(id).buyPrice !== undefined)) continue;
      const cost = inputs.reduce((sum, [id, n]) => sum + content.items.get(id).buyPrice! * n, 0);
      expect(content.items.value(recipe.outputs)).toBeLessThanOrEqual(cost);
    }
  });

  it('rejects content that references unknown items', () => {
    const broken = {
      ...config,
      recipes: { recipes: [{ ...config.recipes.recipes[0]!, inputs: { nope: 1 } }] },
    };
    expect(() => new Content(broken)).toThrow(/unknown item nope/);
  });
});

describe('market', () => {
  it('buys supplies, charging the right amount', () => {
    const session = richSession(5);
    const before = session.economy.balance();
    expect(session.farm.buy('chicken-feed', 4).ok).toBe(true);
    expect(session.inventory.count('chicken-feed')).toBe(4);
    expect(session.economy.balance()).toBe(
      before - 4 * content.items.get('chicken-feed').buyPrice!,
    );
  });

  it('refuses purchases without coins, room, or the level', () => {
    const session = newSession();
    expect(session.farm.buy('pig-feed', 1)).toEqual({ ok: false, reason: 'Unlocks at level 11' });
    expect(session.farm.buy('worm-bait', 100)).toEqual({ ok: false, reason: 'Barn is full' });
    session.economy.spend(session.economy.balance());
    expect(session.farm.buy('worm-bait', 1)).toEqual({ ok: false, reason: 'Not enough money' });
    expect(session.inventory.used()).toBe(0);
  });

  it('refuses to sell what the player does not own or that has no price', () => {
    const session = newSession();
    session.inventory.add('carrot', 1);
    expect(session.farm.sell('carrot', 2)).toEqual({ ok: false, reason: 'Not enough to sell' });
    expect(session.farm.sell('carrot', 0).ok).toBe(false);
    expect(session.farm.sell('carrot', -1).ok).toBe(false);
    session.inventory.add('worm-bait', 1);
    expect(session.farm.sell('worm-bait', 1)).toEqual({ ok: false, reason: "That can't be sold" });
    expect(session.inventory.count('carrot')).toBe(1);
  });

  it('caps storage and grows it with upgrades', () => {
    const session = richSession(20);
    const capacity = session.inventory.capacity();
    expect(session.inventory.add('carrot', capacity + 1)).toBe(false);
    expect(session.inventory.add('carrot', capacity)).toBe(true);
    expect(session.inventory.add('carrot', 1)).toBe(false);
    expect(session.farm.upgradeStorage().ok).toBe(true);
    expect(session.inventory.capacity()).toBeGreaterThan(capacity);
    expect(session.inventory.add('carrot', 1)).toBe(true);
  });

  it('expands land so new tiles become buildable', () => {
    const session = richSession(20);
    const edge = session.state.landSize;
    expect(session.world.canPlace('fence', { col: edge, row: 0 })).toBe(false);
    expect(session.farm.expandLand().ok).toBe(true);
    expect(session.world.canPlace('fence', { col: edge, row: 0 })).toBe(true);
  });
});
