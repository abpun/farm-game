import { describe, expect, it } from 'vitest';
import { BARN_FULL } from '@core/FarmService';
import type { GameSession } from '@core/GameSession';
import { buildAnywhere, config, newSession, richSession } from './helpers';

const growUntilReady = (session: GameSession, plotId: number) => {
  const remaining = session.plots.secondsRemaining(plotId);
  if (!Number.isFinite(remaining)) throw new Error('dormant');
  session.update(remaining + 0.01);
};

// Apple only grows outside winter, so tests skip ahead to a season where it grows.
const toGrowingSeason = (session: GameSession, cropId: string) => {
  while (session.plots.seasonRate(cropId) <= 0)
    session.update(session.seasons.secondsToNextSeason());
};

describe('crop content', () => {
  it('defines every Phase 3 crop and tree with a valid unlock and xp', () => {
    const ids = config.crops.map((crop) => crop.id);
    for (const id of ['tomato', 'potato', 'carrot', 'corn', 'cabbage', 'pumpkin', 'onion']) {
      expect(ids).toContain(id);
    }
    for (const id of ['strawberry', 'blueberry', 'watermelon', 'grapes']) expect(ids).toContain(id);
    const trees = config.crops.filter((crop) => crop.plantOn === 'orchard').map((c) => c.id);
    expect(trees.sort()).toEqual(['apple', 'banana', 'mango', 'orange', 'pear']);
    for (const crop of config.crops) {
      expect(crop.unlockLevel).toBeGreaterThanOrEqual(1);
      expect(crop.xp).toBeGreaterThan(0);
    }
  });
});

describe('planting rules', () => {
  it('locks crops above the player level', () => {
    const session = newSession();
    session.economy.earn(1000, 'reward');
    const bed = session.plots.ids()[0]!;
    expect(session.farm.plant(bed, 'pumpkin')).toEqual({ ok: false, reason: 'Unlocks at level 7' });
  });

  it('keeps trees in orchard plots and vegetables in beds', () => {
    const session = richSession();
    const bed = session.plots.ids()[0]!;
    const orchard = buildAnywhere(session, 'orchard-plot');
    toGrowingSeason(session, 'apple');
    expect(session.farm.plant(bed, 'apple')).toEqual({
      ok: false,
      reason: 'Trees need an orchard plot',
    });
    expect(session.farm.plant(orchard, 'carrot')).toEqual({
      ok: false,
      reason: 'Plant this in a bed',
    });
    expect(session.farm.plant(orchard, 'apple').ok).toBe(true);
  });
});

describe('fruit trees', () => {
  it('grows, harvests, and regrows fruit on the same tree', () => {
    const session = richSession();
    const plot = buildAnywhere(session, 'orchard-plot');
    toGrowingSeason(session, 'apple');
    const apple = session.crops.get('apple');
    expect(session.farm.plant(plot, 'apple').ok).toBe(true);
    growUntilReady(session, plot);

    expect(session.farm.harvest(plot).ok).toBe(true);
    expect(session.inventory.count('apple')).toBe(apple.yield);
    expect(session.plots.cropOf(plot)).toBe('apple');
    expect(session.plots.isReady(plot)).toBe(false);
    expect(session.plots.stage(plot)).toBe(apple.stages - 2);

    toGrowingSeason(session, 'apple');
    const rate = session.plots.seasonRate('apple');
    expect(session.plots.secondsRemaining(plot)).toBeCloseTo(apple.regrowSec! / rate);
    growUntilReady(session, plot);
    expect(session.farm.harvest(plot).ok).toBe(true);
    expect(session.inventory.count('apple')).toBe(apple.yield * 2);
  });

  it('can be dug up to free the plot', () => {
    const session = richSession();
    const plot = buildAnywhere(session, 'orchard-plot');
    toGrowingSeason(session, 'apple');
    session.farm.plant(plot, 'apple');
    expect(session.farm.demolish(plot).ok).toBe(false);
    expect(session.farm.clearPlot(plot).ok).toBe(true);
    expect(session.plots.isEmpty(plot)).toBe(true);
  });
});

describe('watering and harvesting', () => {
  it('watering speeds growth once per crop', () => {
    const session = richSession();
    const bed = session.plots.ids()[0]!;
    session.farm.plant(bed, 'carrot');
    const dry = session.plots.secondsRemaining(bed);
    expect(session.farm.water(bed).ok).toBe(true);
    expect(session.plots.secondsRemaining(bed)).toBeCloseTo(dry / config.farm.waterBoost);
    expect(session.farm.water(bed)).toEqual({ ok: false, reason: 'Already watered' });
  });

  it('awards xp on harvest and never harvests twice', () => {
    const session = richSession(1);
    const bed = session.plots.ids()[0]!;
    session.farm.plant(bed, 'carrot');
    growUntilReady(session, bed);
    expect(session.farm.harvest(bed).ok).toBe(true);
    expect(session.progression.xp()).toBe(session.crops.get('carrot').xp);
    expect(session.farm.harvest(bed)).toEqual({ ok: false, reason: 'Nothing to harvest' });
    expect(session.inventory.count('carrot')).toBe(session.crops.get('carrot').yield);
  });

  it('leaves the crop ready when the barn is full', () => {
    const session = richSession();
    const bed = session.plots.ids()[0]!;
    session.farm.plant(bed, 'carrot');
    growUntilReady(session, bed);
    session.inventory.add('wheat', session.inventory.capacity());
    expect(session.farm.harvest(bed)).toEqual({ ok: false, reason: BARN_FULL });
    expect(session.plots.isReady(bed)).toBe(true);
  });
});
