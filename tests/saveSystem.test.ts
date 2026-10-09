import { describe, expect, it } from 'vitest';
import { loadConfig } from '@core/config/loadConfig';
import { GameSession } from '@core/GameSession';
import type { Clock } from '@core/save/Clock';
import { MemoryStore } from '@core/save/KeyValueStore';
import { SAVE_KEYS } from '@core/save/SaveSystem';
import { SAVE_VERSION } from '@core/save/saveFormat';

class FakeClock implements Clock {
  constructor(public time = 1_000_000) {}
  now = () => this.time;
  advanceSec = (sec: number) => (this.time += sec * 1000);
}

const config = loadConfig();
const session = (store: MemoryStore, clock = new FakeClock()) =>
  new GameSession(config, store, clock);

describe('save system', () => {
  it('round-trips money, plots and game time', () => {
    const store = new MemoryStore();
    const clock = new FakeClock();
    const first = session(store, clock);
    const bed = first.plots.ids()[2]!;
    first.farm.plant(bed, 'tomato');
    first.update(10);
    expect(first.save()).toBe(true);

    const second = session(store, clock);
    expect(second.economy.balance()).toBe(first.economy.balance());
    expect(second.plots.cropOf(bed)).toBe('tomato');
    expect(second.world.objects()).toHaveLength(first.world.objects().length);
    expect(second.time.now()).toBe(10);
  });

  it('migrates version 1 saves without granting offline time', () => {
    const store = new MemoryStore();
    const state = { money: 99, time: 5, inventory: { carrot: 2 }, plots: [] };
    store.setItem(SAVE_KEYS.main, JSON.stringify({ version: 1, state }));

    const loaded = session(store);
    expect(loaded.economy.balance()).toBe(99);
    expect(loaded.inventory.count('carrot')).toBe(2);
    expect(loaded.time.now()).toBe(5);
    expect(loaded.offlineSeconds).toBe(0);
  });

  it('migrates version 2 bed grids into placed beds plus the starter layout', () => {
    const store = new MemoryStore();
    const plots = [
      { id: 0, cropId: 'carrot', plantedAt: 0 },
      { id: 1, cropId: null, plantedAt: 0 },
    ];
    const state = { money: 70, time: 100, inventory: {}, plots };
    store.setItem(SAVE_KEYS.main, JSON.stringify({ version: 2, savedAt: null, state }));

    const loaded = session(store);
    const beds = loaded.world.objects().filter((o) => o.itemId === 'plot');
    const carrotBed = beds.find((o) => loaded.plots.cropOf(o.id) === 'carrot');
    expect(carrotBed).toMatchObject({ col: 3, row: 4 });
    expect(loaded.plots.isReady(carrotBed!.id)).toBe(true);
    expect(loaded.world.objects().some((o) => o.itemId === 'cottage')).toBe(true);
    expect(loaded.economy.balance()).toBe(70);
  });

  it('rejects saves from a newer game version', () => {
    const store = new MemoryStore();
    const state = { money: 99, time: 0, inventory: {}, plots: [] };
    store.setItem(SAVE_KEYS.main, JSON.stringify({ version: SAVE_VERSION + 1, savedAt: 0, state }));
    expect(session(store).economy.balance()).toBe(config.farm.startingMoney);
  });

  it('recovers from the backup when the main save is corrupt', () => {
    const store = new MemoryStore();
    const game = session(store);
    game.economy.earn(50);
    game.save();
    game.economy.earn(1);
    game.save();
    store.setItem(SAVE_KEYS.main, '{corrupt');

    expect(session(store).economy.balance()).toBe(config.farm.startingMoney + 50);
  });

  it('falls back to a fresh farm when nothing is valid', () => {
    const store = new MemoryStore();
    store.setItem(
      SAVE_KEYS.main,
      JSON.stringify({ version: SAVE_VERSION, savedAt: 0, state: { money: 'lots' } }),
    );
    expect(session(store).economy.balance()).toBe(config.farm.startingMoney);
  });

  it('grows crops while offline, capped by config', () => {
    const store = new MemoryStore();
    const clock = new FakeClock();
    const game = session(store, clock);
    const bed = game.plots.ids()[0]!;
    game.farm.plant(bed, 'carrot');
    game.save();

    clock.advanceSec(60);
    const back = session(store, clock);
    expect(back.offlineSeconds).toBe(60);
    expect(back.plots.isReady(bed)).toBe(true);

    back.save();
    clock.advanceSec(100 * 3600);
    expect(session(store, clock).offlineSeconds).toBe(config.farm.maxOfflineHours * 3600);
  });

  it('ignores a wall clock that moved backwards', () => {
    const store = new MemoryStore();
    const clock = new FakeClock();
    session(store, clock).save();
    clock.advanceSec(-500);
    expect(session(store, clock).offlineSeconds).toBe(0);
  });

  it('exports and imports a save, then stops autosaving over it', () => {
    const source = session(new MemoryStore());
    source.economy.earn(500);
    const exported = source.exportSave();

    const store = new MemoryStore();
    const target = session(store);
    expect(target.importSave(exported)).toBe(true);
    expect(target.save()).toBe(false);
    expect(session(store).economy.balance()).toBe(config.farm.startingMoney + 500);
  });

  it('refuses to import garbage', () => {
    expect(session(new MemoryStore()).importSave('not a save')).toBe(false);
  });

  it('reset clears both slots', () => {
    const store = new MemoryStore();
    const game = session(store);
    game.save();
    game.save();
    game.resetSave();
    expect(store.getItem(SAVE_KEYS.main)).toBeNull();
    expect(store.getItem(SAVE_KEYS.backup)).toBeNull();
  });
});
