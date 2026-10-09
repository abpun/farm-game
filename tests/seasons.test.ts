import { describe, expect, it } from 'vitest';
import { loadConfig } from '@core/config/loadConfig';
import type { GameConfig } from '@core/entities/types';
import { GameSession } from '@core/GameSession';
import { MemoryStore } from '@core/save/KeyValueStore';

// Season mechanics are tested from spring, whatever the shipped start season is.
const loaded = loadConfig();
const base: GameConfig = { ...loaded, seasons: { ...loaded.seasons, startSeason: 'spring' } };
const seasonLength = base.seasons.daysPerSeason * base.farm.dayLengthSec;

const withRates = (rates: Record<string, number>): GameConfig => ({
  ...base,
  crops: base.crops.map((crop) => (crop.id === 'carrot' ? { ...crop, seasonGrowth: rates } : crop)),
});
const newSession = (config: GameConfig = base) => {
  const session = new GameSession(config, new MemoryStore());
  session.economy.earn(1000);
  return session;
};

describe('seasons', () => {
  it('starts in the configured season and advances after daysPerSeason days', () => {
    const session = newSession();
    expect(session.seasons.current().id).toBe(base.seasons.startSeason);
    expect(session.seasons.dayOfSeason()).toBe(1);
    const seen: string[] = [];
    session.bus.on('SeasonChanged', ({ seasonId }) => seen.push(seasonId));
    session.update(seasonLength);
    expect(session.seasons.current().id).toBe(base.seasons.seasons[1]!.id);
    expect(seen).toEqual([base.seasons.seasons[1]!.id]);
  });

  it('wraps into a new year', () => {
    const session = newSession();
    session.update(seasonLength * base.seasons.seasons.length);
    expect(session.seasons.year()).toBe(2);
    expect(session.seasons.current().id).toBe(base.seasons.startSeason);
  });

  it('grows faster in a favourable season', () => {
    const fast = newSession(withRates({ spring: 2 }));
    const slow = newSession(withRates({ spring: 0.5 }));
    for (const session of [fast, slow]) session.farm.plant(session.plots.ids()[0]!, 'carrot');
    fast.update(10);
    slow.update(10);
    const bed = (s: GameSession) => s.plots.progress(s.plots.ids()[0]!);
    expect(bed(fast)).toBeCloseTo(bed(slow) * 4);
  });

  it('refuses to plant a crop that is dormant this season', () => {
    const session = newSession(withRates({ spring: 0 }));
    expect(session.farm.plant(session.plots.ids()[0]!, 'carrot')).toEqual({
      ok: false,
      reason: "Carrot won't grow in Spring",
    });
  });

  it('pauses growth while dormant and resumes next season, even in one big step', () => {
    const carrot = base.crops.find((c) => c.id === 'carrot')!;
    const config = withRates({ spring: 1, summer: 0, autumn: 1, winter: 1 });
    const session = newSession(config);
    const bed = session.plots.ids()[0]!;
    session.update(seasonLength - 10);
    session.farm.plant(bed, 'carrot');
    session.update(10 + seasonLength + 5);
    const expected = (10 + 5) / carrot.growthTimeSec;
    expect(session.plots.progress(bed)).toBeCloseTo(expected);
  });

  it('reports dormant crops as never finishing', () => {
    const session = newSession(withRates({ spring: 1, summer: 0 }));
    const bed = session.plots.ids()[0]!;
    session.update(seasonLength - 5);
    session.farm.plant(bed, 'carrot');
    session.update(10);
    expect(session.seasons.current().id).toBe('summer');
    expect(session.plots.secondsRemaining(bed)).toBe(Infinity);
  });
});
