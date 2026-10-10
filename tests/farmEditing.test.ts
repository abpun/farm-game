import { describe, expect, it } from 'vitest';
import { SAVE_KEYS } from '@core/save/SaveSystem';
import { MemoryStore } from '@core/save/KeyValueStore';
import { buildAnywhere, freeTile, newSession, richSession } from './helpers';

const emptyBed = (session: ReturnType<typeof newSession>) =>
  session.world.objects().find((o) => session.plots.isPlot(o.id) && session.plots.isEmpty(o.id))!
    .id;

describe('sowing from the barn', () => {
  it('uses one crop from the barn before buying a seed', () => {
    const session = newSession();
    session.inventory.add('carrot', 1);
    const money = session.economy.balance();
    expect(session.farm.seedSource('carrot')).toBe('barn');
    expect(session.farm.plant(emptyBed(session), 'carrot').ok).toBe(true);
    expect(session.inventory.count('carrot')).toBe(0);
    expect(session.economy.balance()).toBe(money);
    expect(session.farm.seedSource('carrot')).toBe('market');
    expect(session.farm.plant(emptyBed(session), 'carrot').ok).toBe(true);
    expect(session.economy.balance()).toBe(money - session.crops.get('carrot').seedCost);
  });

  it('harvests two for every one sown', () => {
    const session = newSession();
    const bed = emptyBed(session);
    session.inventory.add('carrot', 1);
    session.farm.plant(bed, 'carrot');
    session.update(session.crops.get('carrot').growthTimeSec * 10);
    expect(session.farm.harvest(bed).ok).toBe(true);
    expect(session.inventory.count('carrot')).toBe(2);
  });
});

describe('moving and turning objects', () => {
  it('moves a building with its state and frees its old tiles', () => {
    const session = richSession();
    const id = buildAnywhere(session, 'coop');
    const from = { ...session.world.get(id)! };
    session.economy.earn(0);
    const target = freeTile(session, 'coop');
    expect(session.farm.move(id, target).ok).toBe(true);
    expect(session.world.objectAt(target.col, target.row)?.id).toBe(id);
    expect(session.world.objectAt(from.col, from.row)).toBeUndefined();
    expect(session.buildings.isBuilding(id)).toBe(true);
  });

  it('refuses to move onto another object', () => {
    const session = richSession();
    const id = buildAnywhere(session, 'coop');
    const cottage = session.world.objects().find((o) => o.itemId === 'cottage')!;
    expect(session.farm.move(id, { col: cottage.col, row: cottage.row }).ok).toBe(false);
    expect(session.world.get(id)?.col).not.toBe(cottage.col);
  });

  it('turns an object in place and back', () => {
    const session = richSession();
    const id = buildAnywhere(session, 'coop');
    expect(session.farm.rotate(id).ok).toBe(true);
    expect(session.world.get(id)?.rotated).toBe(true);
    expect(session.farm.rotate(id).ok).toBe(true);
    expect(session.world.get(id)?.rotated).toBeUndefined();
  });
});

describe('edge items', () => {
  it('stand on tile edges without blocking the tile', () => {
    const session = richSession();
    const tile = freeTile(session, 'plot');
    expect(session.farm.build('white-fence', { ...tile, edge: 'n' }).ok).toBe(true);
    expect(session.world.edgeAt(tile.col, tile.row, 'n')?.itemId).toBe('white-fence');
    expect(session.farm.build('hedge', { ...tile, edge: 'n' }).ok).toBe(false);
    expect(session.farm.build('hedge', { ...tile, edge: 'w' }).ok).toBe(true);
    expect(session.farm.build('plot', tile).ok).toBe(true);
  });

  it('keeps fences out of a building and buildings off fences', () => {
    const session = richSession();
    const tile = freeTile(session, 'coop');
    session.farm.build('fence', { col: tile.col + 1, row: tile.row, edge: 'w' });
    expect(session.farm.build('coop', tile).ok).toBe(false);
  });

  it('fences the starter field with edges', () => {
    const session = newSession();
    expect(session.world.edgeAt(2, 3, 'n')?.itemId).toBe('fence');
    expect(session.world.edgeAt(4, 3, 'n')).toBeUndefined();
    expect(session.world.edgeAt(7, 4, 'w')?.itemId).toBe('fence');
  });
});

describe('save v7', () => {
  it('turns tile fences into edge fences and keeps bushes', () => {
    const store = new MemoryStore();
    const objects = [
      { id: 1, itemId: 'fence', col: 2, row: 2 },
      { id: 2, itemId: 'fence', col: 3, row: 2 },
      { id: 3, itemId: 'fence', col: 2, row: 3 },
      { id: 4, itemId: 'bush-autumn', col: 9, row: 9 },
    ];
    const state = { money: 5, time: 0, inventory: {}, nextObjectId: 5, objects, plots: {} };
    store.setItem(SAVE_KEYS.main, JSON.stringify({ version: 6, savedAt: null, state }));
    const session = newSession({ store });
    expect(session.world.edgeAt(2, 2, 'n')?.itemId).toBe('fence');
    expect(session.world.edgeAt(2, 2, 'w')?.itemId).toBe('fence');
    expect(session.world.edgeAt(3, 2, 'n')?.itemId).toBe('fence');
    expect(session.world.edgeAt(2, 3, 'n')?.itemId).toBe('fence');
    expect(session.world.edgeAt(9, 9, 'n')?.itemId).toBe('bush-autumn');
    expect(new Set(session.world.objects().map((o) => o.id)).size).toBe(
      session.world.objects().length,
    );
  });
});
