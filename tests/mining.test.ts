import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@core/save/KeyValueStore';
import { BARN_FULL } from '@core/FarmService';
import { buildReady, FakeClock, newSession, richSession } from './helpers';

const nodeOf = (session: ReturnType<typeof newSession>, deposit: string) =>
  session.mining.nodes().find((node) => node.deposit === deposit)!.id;

describe('mining', () => {
  it('stays closed until the unlock level', () => {
    const session = newSession();
    const stone = nodeOf(session, 'stone');
    expect(session.mining.strike(stone)).toEqual({
      ok: false,
      reason: `The mine opens at level ${session.mining.unlockLevel()}`,
    });
  });

  it('breaks a deposit after its strikes and pays the drop exactly once', () => {
    const session = richSession(5);
    const stone = nodeOf(session, 'stone');
    const hp = session.mining.deposit(stone).hp;
    for (let i = 1; i < hp; i++) {
      expect(session.mining.strike(stone)).toEqual({ ok: true, broken: false, hp: hp - i });
    }
    const result = session.mining.strike(stone);
    expect(result.ok && result.broken).toBe(true);
    const mined = session.inventory.count('stone') + session.inventory.count('coal');
    expect(mined).toBeGreaterThan(0);
    expect(session.mining.strike(stone).ok).toBe(false);
    expect(session.inventory.count('stone') + session.inventory.count('coal')).toBe(mined);
    expect(session.mining.status(stone)).toBe('regrowing');
  });

  it('grows deposits back on the game clock', () => {
    const session = richSession(5);
    const coal = nodeOf(session, 'coal');
    while (session.mining.status(coal) === 'ready') session.mining.strike(coal);
    session.update(session.mining.deposit(coal).respawnSec + 1);
    expect(session.mining.status(coal)).toBe('ready');
    expect(session.mining.hp(coal)).toBe(session.mining.deposit(coal).hp);
  });

  it('needs the right pickaxe tier and a stronger pick hits harder', () => {
    const session = richSession(20);
    const copper = nodeOf(session, 'copper');
    expect(session.mining.strike(copper)).toEqual({ ok: false, reason: 'Needs a Copper Pickaxe' });
    expect(session.mining.upgradePickaxe()).toEqual({
      ok: false,
      reason: 'Needs 20 Stone, 5 Coal',
    });
    session.inventory.add('stone', 20);
    session.inventory.add('coal', 5);
    const coins = session.economy.balance();
    expect(session.mining.upgradePickaxe().ok).toBe(true);
    expect(session.economy.balance()).toBe(coins - session.mining.pickaxe().price);
    expect(session.inventory.count('stone')).toBe(0);
    expect(session.mining.strike(copper).ok).toBe(true);
    const stone = nodeOf(session, 'stone');
    expect(session.mining.power(session.mining.deposit(stone))).toBe(2);
  });

  it('refuses to mine with a full barn and keeps the deposit standing', () => {
    const session = richSession(5);
    session.inventory.add('wheat', session.inventory.freeSpace());
    const stone = nodeOf(session, 'stone');
    expect(session.mining.strike(stone)).toEqual({ ok: false, reason: BARN_FULL });
    expect(session.mining.hp(stone)).toBe(session.mining.deposit(stone).hp);
  });

  it('remembers broken deposits and the pickaxe across a reload', () => {
    const store = new MemoryStore();
    const clock = new FakeClock();
    const first = richSession(20, { store, clock });
    first.inventory.add('stone', 20);
    first.inventory.add('coal', 5);
    first.mining.upgradePickaxe();
    const stone = nodeOf(first, 'stone');
    while (first.mining.status(stone) === 'ready') first.mining.strike(stone);
    first.save();
    const second = richSession(20, { store, clock });
    expect(second.mining.pickaxe().id).toBe('copper-pickaxe');
    expect(second.mining.status(stone)).toBe('regrowing');
  });

  it('smelts ore into bars at the forge and counts them', () => {
    const session = richSession(20);
    const forge = buildReady(session, 'forge');
    session.inventory.add('copper-ore', 3);
    session.inventory.add('coal', 1);
    expect(session.production.start(forge, 'copper-bar').ok).toBe(true);
    session.update(session.content.recipes.get('copper-bar').durationSec);
    expect(session.production.collect(forge).ok).toBe(true);
    expect(session.inventory.count('copper-bar')).toBe(1);
    expect(session.stats.get('barsSmelted')).toBe(1);
  });

  it('asks for mined materials on late building upgrades', () => {
    const session = richSession(20);
    const mill = buildReady(session, 'grain-mill');
    expect(session.farm.upgradeBuilding(mill).ok).toBe(true);
    const result = session.farm.upgradeBuilding(mill);
    expect(result.ok).toBe(false);
    session.inventory.add('stone', 15);
    session.inventory.add('copper-bar', 2);
    expect(session.farm.upgradeBuilding(mill).ok).toBe(true);
    expect(session.inventory.count('copper-bar')).toBe(0);
  });
});
