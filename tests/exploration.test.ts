import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@core/save/KeyValueStore';
import { FakeClock, newSession, richSession } from './helpers';

describe('exploration', () => {
  it('opens a chest once and pays its reward once', () => {
    const session = newSession();
    const chest = session.content.discoveries.get('grove-chest');
    const coins = session.economy.balance();
    expect(session.exploration.discover(chest.id).ok).toBe(true);
    expect(session.economy.balance()).toBe(coins + (chest.reward.coins ?? 0));
    expect(session.exploration.discover(chest.id)).toEqual({ ok: false, reason: 'Already found' });
    expect(session.economy.balance()).toBe(coins + (chest.reward.coins ?? 0));
  });

  it('gates the high trail behind a cleared rockfall and a better pickaxe', () => {
    const session = richSession(20);
    expect(session.exploration.discover('eagle-lookout').ok).toBe(false);
    expect(session.exploration.blocker('rockfall')).toBe('Needs a Copper Pickaxe to clear');
    session.inventory.add('stone', 20);
    session.inventory.add('coal', 5);
    session.mining.upgradePickaxe();
    expect(session.exploration.discover('rockfall').ok).toBe(true);
    expect(session.exploration.discover('eagle-lookout').ok).toBe(true);
    expect(session.stats.get('viewpoints')).toBe(1);
  });

  it('respects level requirements', () => {
    const session = newSession();
    expect(session.exploration.blocker('mine-cache')).toBe('Come back at level 3');
  });

  it('remembers discoveries across a reload', () => {
    const store = new MemoryStore();
    const clock = new FakeClock();
    const first = newSession({ store, clock });
    first.exploration.discover('driftwood-cache');
    first.save();
    const second = newSession({ store, clock });
    expect(second.exploration.isFound('driftwood-cache')).toBe(true);
    expect(second.exploration.discover('driftwood-cache').ok).toBe(false);
  });
});

describe('boats and fishing destinations', () => {
  it('defines the six destinations with increasing requirements', () => {
    const session = newSession();
    const ids = ['river', 'pond', 'coastal', 'reef', 'deep', 'isle'];
    ids.forEach((id) => expect(session.content.spots.has(id)).toBe(true));
    for (const spot of session.content.spots.all()) {
      expect(session.fishing.catchable(spot.id).length + spot.unlockLevel).toBeGreaterThan(0);
      expect(session.content.fish.all().some((fish) => fish.spots.includes(spot.id))).toBe(true);
    }
  });

  it('needs a boat for open-water spots', () => {
    const session = richSession(20);
    expect(session.fishing.startCast('coastal')).toEqual({ ok: false, reason: 'Needs a Rowboat' });
    expect(session.fishing.upgradeBoat().ok).toBe(true);
    expect(session.fishing.startCast('coastal').ok).toBe(true);
    expect(session.fishing.startCast('reef').ok).toBe(false);
  });

  it('charges coins and materials for a bigger boat, or nothing', () => {
    const session = richSession(20);
    session.fishing.upgradeBoat();
    const coins = session.economy.balance();
    expect(session.fishing.upgradeBoat()).toEqual({ ok: false, reason: 'Needs 4 Copper Bar' });
    expect(session.economy.balance()).toBe(coins);
    session.inventory.add('copper-bar', 4);
    expect(session.fishing.upgradeBoat().ok).toBe(true);
    expect(session.fishing.boat()?.id).toBe('sailboat');
  });

  it('records where each fish was caught and shortens the window at hard spots', () => {
    const session = richSession(20);
    session.fishing.upgradeBoat();
    session.fishing.startCast('coastal');
    const coastal = session.fishing.cast()!;
    session.update(coastal.biteAt - session.time.now() + 0.01);
    session.fishing.reel();
    expect(session.stats.spotsFished()).toBe(1);
    session.fishing.startCast('river');
    const river = session.fishing.cast()!;
    expect(river.reactionSec).toBeGreaterThan(0);
    expect(session.content.spots.get('coastal').difficulty).toBeGreaterThan(1);
  });

  it('keeps old saves: a v5 save gets no boat, a fresh mine and its catches', () => {
    const store = new MemoryStore();
    const first = newSession({ store });
    first.state.fishing.journal.minnow = { caught: 3, firstCaughtAt: 0 };
    first.save();
    const file = JSON.parse(store.getItem('farm-game.save')!);
    file.version = 5;
    delete file.state.mining;
    delete file.state.exploration;
    delete file.state.fishing.boatId;
    store.setItem('farm-game.save', JSON.stringify(file));
    const second = newSession({ store });
    expect(second.state.fishing.journal.minnow?.caught).toBe(3);
    expect(second.fishing.boat()).toBeNull();
    expect(second.mining.pickaxe().id).toBe('old-pickaxe');
    expect(second.state.exploration.found).toEqual([]);
  });
});
