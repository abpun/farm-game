import { describe, expect, it } from 'vitest';
import { Catalog } from '@core/config/Catalog';
import { expandLayout } from '@core/config/expandLayout';
import { loadConfig } from '@core/config/loadConfig';
import { GameSession } from '@core/GameSession';
import { MemoryStore } from '@core/save/KeyValueStore';

const config = loadConfig();
const newSession = () => new GameSession(config, new MemoryStore());
const free = (session: GameSession) => {
  for (let row = 0; row < config.farm.world.rows; row++) {
    for (let col = 0; col < config.farm.world.columns; col++) {
      if (!session.world.objectAt(col, row)) return { col, row };
    }
  }
  throw new Error('no free tile');
};

describe('layout expansion', () => {
  it('expands areas and outlines with gaps', () => {
    const tiles = expandLayout([
      { itemId: 'plot', area: { col: 0, row: 0, cols: 2, rows: 2 } },
      { itemId: 'fence', outline: { col: 0, row: 0, cols: 3, rows: 3 }, gaps: [[1, 0]] },
    ]);
    expect(tiles.filter((t) => t.itemId === 'plot')).toHaveLength(4);
    expect(tiles.filter((t) => t.itemId === 'fence')).toHaveLength(7);
  });
});

describe('catalog', () => {
  it('rejects items in unknown categories', () => {
    const item = { ...config.catalog.items[0]!, category: 'nope' };
    expect(() => new Catalog({ categories: config.catalog.categories, items: [item] })).toThrow();
  });

  it('only lists market items', () => {
    const catalog = new Catalog(config.catalog);
    expect(catalog.listed('buildings').some((item) => item.id === 'cottage')).toBe(false);
  });
});

describe('building', () => {
  it('starts with the starter layout', () => {
    const session = newSession();
    expect(session.plots.ids()).toHaveLength(4);
    expect(session.world.objects().some((o) => o.itemId === 'cottage')).toBe(true);
  });

  it('builds a garden bed that can be planted, and charges for it', () => {
    const session = newSession();
    session.economy.earn(100);
    const before = session.economy.balance();
    const { col, row } = free(session);

    expect(session.farm.build('plot', col, row).ok).toBe(true);
    expect(session.economy.balance()).toBe(before - session.catalog.get('plot').price);
    const bed = session.world.objectAt(col, row)!;
    expect(session.farm.plant(bed.id, 'carrot').ok).toBe(true);
  });

  it('refuses occupied tiles, out of bounds, unaffordable and unavailable items', () => {
    const session = newSession();
    const cottage = session.world.objects().find((o) => o.itemId === 'cottage')!;
    session.economy.earn(1000);
    expect(session.farm.build('fence', cottage.col, cottage.row).ok).toBe(false);
    expect(session.farm.build('fence', -1, 0).ok).toBe(false);
    expect(session.farm.build('chicken', free(session).col, free(session).row)).toEqual({
      ok: false,
      reason: 'Coming soon',
    });
    session.economy.spend(session.economy.balance());
    expect(session.farm.build('fence', free(session).col, free(session).row)).toEqual({
      ok: false,
      reason: 'Not enough money',
    });
  });

  it('never builds on the farm path', () => {
    const session = newSession();
    session.economy.earn(1000);
    const [col, row] = config.farm.paths[0]!.points[1]!;
    const tile = { col: Math.floor(col), row: Math.floor(row) };
    expect(session.world.isBlocked(tile.col, tile.row)).toBe(true);
    expect(session.farm.build('plot', tile.col, tile.row).ok).toBe(false);
    expect(session.world.isBlocked(tile.col + 1, tile.row)).toBe(false);
  });

  it('keeps every starter piece off the path', () => {
    const session = newSession();
    for (const object of session.world.objects()) {
      expect(session.world.isBlocked(object.col, object.row)).toBe(false);
    }
  });

  it('blocks multi-tile footprints that overlap', () => {
    const session = newSession();
    const cottage = session.world.objects().find((o) => o.itemId === 'cottage')!;
    expect(session.world.objectAt(cottage.col + 1, cottage.row + 1)?.id).toBe(cottage.id);
  });

  it('demolishes with a partial refund, but keeps landmarks and planted beds', () => {
    const session = newSession();
    session.economy.earn(100);
    const fence = session.world.objects().find((o) => o.itemId === 'fence')!;
    const before = session.economy.balance();
    expect(session.farm.demolish(fence.id).ok).toBe(true);
    expect(session.economy.balance()).toBe(
      before + Math.floor(session.catalog.get('fence').price * config.farm.refundRatio),
    );
    expect(session.world.objectAt(fence.col, fence.row)).toBeUndefined();

    const cottage = session.world.objects().find((o) => o.itemId === 'cottage')!;
    expect(session.farm.demolish(cottage.id).ok).toBe(false);

    const bed = session.plots.ids()[0]!;
    session.farm.plant(bed, 'carrot');
    expect(session.farm.demolish(bed)).toEqual({ ok: false, reason: 'Harvest the bed first' });
  });
});
