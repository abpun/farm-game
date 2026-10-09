import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@core/save/KeyValueStore';
import { SAVE_KEYS } from '@core/save/SaveSystem';
import { buildReady, config, FakeClock, newSession, richSession } from './helpers';

describe('Phase 3 save data', () => {
  it('migrates a v4 save into v5 defaults, keeping progress', () => {
    const store = new MemoryStore();
    const state = {
      money: 321,
      time: 50,
      inventory: { carrot: 3, retired: 2 },
      nextObjectId: 2,
      objects: [{ id: 1, itemId: 'plot', col: 5, row: 5 }],
      plots: { '1': { cropId: 'carrot', growth: 0.5 } },
    };
    store.setItem(SAVE_KEYS.main, JSON.stringify({ version: 4, savedAt: null, state }));

    const session = newSession({ store });
    expect(session.economy.balance()).toBe(321);
    expect(session.inventory.count('carrot')).toBe(3);
    expect(session.state.inventory.retired).toBeUndefined();
    expect(session.progression.level()).toBe(1);
    expect(session.state.landSize).toBe(config.farm.land.startSize);
    expect(session.state.fishing.rodId).toBe('bamboo-rod');
    expect(session.plots.progress(1)).toBeCloseTo(0.5);
    expect(session.plots.isWatered(1)).toBe(false);
  });

  it('round-trips buildings, animals, fishing, orders and achievements', () => {
    const store = new MemoryStore();
    const clock = new FakeClock();
    const first = richSession(20, { store, clock });
    const coop = buildReady(first, 'coop');
    first.ranch.buyAnimal(coop);
    first.farm.upgradeStorage();
    first.state.fishing.journal.minnow = { caught: 2, firstCaughtAt: 1 };
    first.orders.accept(first.orders.offers()[0]!.id);
    first.state.stats.cropsHarvested = 1;
    first.update(0.01);
    first.save();

    const second = newSession({ store, clock });
    expect(second.ranch.animals(coop)).toHaveLength(1);
    expect(second.inventory.capacity()).toBe(first.inventory.capacity());
    expect(second.state.fishing.journal.minnow?.caught).toBe(2);
    expect(second.orders.active()).toHaveLength(1);
    expect(second.state.achievements['first-harvest']).toBeDefined();
    expect(second.progression.level()).toBe(20);
  });

  it('repairs damaged sections instead of discarding the save', () => {
    const store = new MemoryStore();
    const state = {
      money: 77,
      time: 0,
      inventory: {},
      nextObjectId: 1,
      objects: [],
      plots: {},
      level: 'high',
      fishing: { rodId: 'laser-rod', cast: { spotId: 'moon' }, journal: { kraken: { caught: 1 } } },
      orders: { active: [{ id: 'x' }], reputation: -5 },
      buildings: 'nope',
      achievements: { 'first-harvest': { claimed: true }, ghost: { claimed: true } },
    };
    store.setItem(SAVE_KEYS.main, JSON.stringify({ version: 5, savedAt: null, state }));
    const session = newSession({ store });
    expect(session.economy.balance()).toBe(77);
    expect(session.progression.level()).toBe(1);
    expect(session.state.fishing).toMatchObject({ rodId: 'bamboo-rod', cast: null, journal: {} });
    expect(session.orders.active()).toHaveLength(0);
    expect(session.orders.reputation()).toBe(0);
    expect(session.state.achievements).toEqual({
      'first-harvest': { completedAt: 0, claimed: true },
    });
  });

  it('keeps under-construction buildings building across reloads', () => {
    const store = new MemoryStore();
    const clock = new FakeClock();
    const first = richSession(20, { store, clock });
    const { col, row } = { col: 8, row: 8 };
    first.farm.build('dairy', col, row);
    const dairy = first.world.objectAt(col, row)!.id;
    first.save();
    const second = newSession({ store, clock });
    expect(second.buildings.isOperational(dairy)).toBe(false);
    second.update(config.buildings.buildings.find((b) => b.id === 'dairy')!.buildSec);
    expect(second.buildings.isOperational(dairy)).toBe(true);
  });
});
