import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@core/save/KeyValueStore';
import { config, FakeClock, newSession } from './helpers';

const levelTwo = config.progression.levels[1]!;

describe('player levels', () => {
  it('levels up from xp and pays the level reward once', () => {
    const session = newSession();
    const before = session.economy.balance();
    session.progression.addXp(levelTwo.xp);
    expect(session.progression.level()).toBe(2);
    expect(session.economy.balance()).toBe(before + levelTwo.coins);
    session.progression.addXp(1);
    expect(session.economy.balance()).toBe(before + levelTwo.coins);
  });

  it('can skip several levels in one go', () => {
    const session = newSession();
    session.progression.addXp(config.progression.levels[4]!.xp);
    expect(session.progression.level()).toBe(5);
  });
});

describe('achievements', () => {
  it('has every required category with real stats', () => {
    const session = newSession();
    const categories = new Set(session.achievements.all().map((a) => a.category));
    expect(categories.size).toBe(config.achievements.categories.length);
    for (const achievement of session.achievements.all()) {
      expect(() => session.achievements.value(achievement.stat)).not.toThrow();
      expect(session.achievements.target(achievement)).toBeGreaterThan(0);
    }
  });

  it('completes from gameplay events and pays the reward only once', () => {
    const session = newSession();
    const first = session.content.achievements.get('first-harvest');
    expect(session.achievements.status(first)).toBe('locked');
    const bed = session.plots.ids()[0]!;
    session.farm.plant(bed, 'carrot');
    session.update(session.plots.secondsRemaining(bed));
    session.farm.harvest(bed);
    session.update(0.01);
    expect(session.achievements.status(first)).toBe('completed');

    const before = session.economy.balance();
    expect(session.achievements.claim('first-harvest').ok).toBe(true);
    expect(session.economy.balance()).toBe(before + first.reward.coins!);
    expect(session.achievements.claim('first-harvest')).toEqual({
      ok: false,
      reason: 'Already claimed',
    });
    expect(session.economy.balance()).toBe(before + first.reward.coins!);
  });

  it('remembers claims across a reload', () => {
    const store = new MemoryStore();
    const clock = new FakeClock();
    const first = newSession({ store, clock });
    first.state.stats.cropsHarvested = 1;
    first.update(0.01);
    first.achievements.claim('first-harvest');
    first.save();
    const second = newSession({ store, clock });
    expect(second.achievements.claim('first-harvest').ok).toBe(false);
  });

  it('unlocks cosmetic rewards that can then be built', () => {
    const session = newSession();
    expect(session.farm.buildBlocker('scarecrow')).toBe('Earned from a trophy');
    session.state.stats.cropsHarvested = 100;
    session.update(0.01);
    session.achievements.claim('green-thumb');
    expect(session.farm.buildBlocker('scarecrow')).toBeNull();
  });

  it('counts only sales and orders toward lifetime earnings', () => {
    const session = newSession();
    session.economy.earn(500, 'reward');
    session.economy.earn(40, 'refund');
    session.inventory.add('carrot', 2);
    session.farm.sellAll('carrot');
    expect(session.stats.get('lifetimeEarnings')).toBe(2 * session.crops.get('carrot').sellPrice);
  });
});
