import { describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '@core/save/KeyValueStore';
import { FakeClock, newSession, richSession, scripted } from './helpers';

const BITE_WAIT = 8;

describe('fishing', () => {
  it('defines at least ten fish across all four rarities', () => {
    const session = newSession();
    const fish = session.content.fish.all();
    expect(fish.length).toBeGreaterThanOrEqual(10);
    expect(new Set(fish.map((f) => f.rarity))).toEqual(
      new Set(['common', 'uncommon', 'rare', 'legendary']),
    );
    for (const id of ['minnow', 'carp', 'trout', 'salmon', 'catfish', 'tuna', 'golden-fish']) {
      expect(session.content.fish.has(id)).toBe(true);
    }
  });

  it('catches the fish rolled at cast when reeled inside the bite window', () => {
    const session = newSession();
    expect(session.fishing.startCast('pier').ok).toBe(true);
    const cast = session.fishing.cast()!;
    expect(session.fishing.phase()).toBe('waiting');
    session.update(cast.biteAt - session.time.now() + 0.1);
    expect(session.fishing.phase()).toBe('bite');

    const result = session.fishing.reel();
    expect(result).toEqual({ ok: true, fishId: cast.fishId, firstCatch: true });
    expect(session.inventory.count(cast.fishId)).toBe(1);
    expect(session.state.fishing.journal[cast.fishId]?.caught).toBe(1);
    expect(session.fishing.level()).toBeGreaterThanOrEqual(1);
    expect(session.state.fishing.xp).toBeGreaterThan(0);
  });

  it('pays a catch only once however often reel is pressed', () => {
    const session = newSession();
    session.fishing.startCast('pier');
    session.update(session.fishing.cast()!.biteAt - session.time.now() + 0.1);
    const fishId = session.fishing.cast()!.fishId;
    session.fishing.reel();
    expect(session.fishing.reel()).toEqual({ ok: false, reason: 'Not fishing' });
    expect(session.inventory.count(fishId)).toBe(1);
  });

  it('loses the fish when reeling too early or too late', () => {
    const session = newSession();
    session.fishing.startCast('pier');
    expect(session.fishing.reel()).toEqual({ ok: false, reason: 'Too early! It swam off' });

    session.fishing.startCast('pier');
    const escaped = vi.fn();
    session.bus.on('FishEscaped', escaped);
    session.update(BITE_WAIT + 5);
    expect(session.fishing.cast()).toBeNull();
    expect(escaped).toHaveBeenCalledWith({ reason: 'late' });
    expect(session.inventory.used()).toBe(0);
  });

  it('keeps the same fish across a reload mid-cast', () => {
    const store = new MemoryStore();
    const clock = new FakeClock();
    const first = newSession({ store, clock, random: scripted(0.99) });
    first.fishing.startCast('pier');
    const { fishId } = first.fishing.cast()!;
    first.save();
    const second = newSession({ store, clock, random: scripted(0) });
    expect(second.fishing.cast()?.fishId).toBe(fishId);
  });

  it('consumes bait, gates spots and rods, and upgrades the rod', () => {
    const session = richSession(1);
    expect(session.fishing.startCast('rocks')).toEqual({ ok: false, reason: 'Unlocks at level 6' });
    expect(session.fishing.startCast('pier', 'worm-bait')).toEqual({
      ok: false,
      reason: 'Out of bait',
    });
    session.farm.buy('worm-bait', 2);
    expect(session.fishing.startCast('pier', 'worm-bait').ok).toBe(true);
    expect(session.inventory.count('worm-bait')).toBe(1);

    expect(session.fishing.upgradeRod()).toEqual({ ok: false, reason: 'Needs fishing level 3' });
    session.state.fishing.xp = 1000;
    expect(session.fishing.upgradeRod().ok).toBe(true);
    expect(session.fishing.rod().id).toBe('fiberglass-rod');
  });

  it('refuses to cast with a full barn', () => {
    const session = newSession();
    session.inventory.add('wheat', session.inventory.capacity());
    expect(session.fishing.startCast('pier')).toEqual({ ok: false, reason: 'Barn is full' });
  });
});
