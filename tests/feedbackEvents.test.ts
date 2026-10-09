import { describe, expect, it } from 'vitest';
import { buildReady, newSession, richSession } from './helpers';

// Events that only exist so the presentation layer can react (sounds, effects).
describe('feedback events', () => {
  it('announces each new day once', () => {
    const session = newSession();
    const days: number[] = [];
    session.bus.on('DayChanged', ({ day }) => days.push(day));
    const dayLength = session.config.farm.dayLengthSec;
    session.update(dayLength / 2);
    expect(days).toEqual([]);
    session.update(dayLength / 2 + 0.1);
    expect(days).toEqual([2]);
    session.update(1);
    expect(days).toEqual([2]);
  });

  it('announces a bite once per cast', () => {
    const session = newSession();
    const bites: string[] = [];
    session.bus.on('FishBite', ({ spotId }) => bites.push(spotId));
    session.fishing.startCast('pier');
    session.update(session.fishing.cast()!.biteAt - session.time.now() - 0.5);
    expect(bites).toEqual([]);
    session.update(0.6);
    session.update(0.1);
    expect(bites).toEqual(['pier']);
  });

  it('announces each finished production job once', () => {
    const session = richSession();
    const mill = buildReady(session, 'grain-mill');
    session.inventory.add('wheat', 6);
    const ready: string[] = [];
    session.bus.on('ProductionReady', ({ recipeId }) => ready.push(recipeId));
    session.production.start(mill, 'flour');
    session.production.start(mill, 'flour');
    const duration = session.content.recipes.get('flour').durationSec;
    session.update(duration - 1);
    expect(ready).toEqual([]);
    session.update(1.5);
    expect(ready).toEqual(['flour']);
    session.update(duration);
    session.update(duration);
    expect(ready).toEqual(['flour', 'flour']);
  });
});
