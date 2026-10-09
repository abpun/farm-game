import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@core/save/KeyValueStore';
import { buildAnywhere, buildReady, FakeClock, richSession } from './helpers';

describe('production buildings', () => {
  it('waits for construction before producing', () => {
    const session = richSession();
    const mill = buildAnywhere(session, 'grain-mill');
    session.inventory.add('wheat', 3);
    expect(session.production.start(mill, 'flour')).toEqual({
      ok: false,
      reason: 'Still under construction',
    });
    session.update(session.buildings.constructionRemaining(mill) + 0.1);
    expect(session.production.start(mill, 'flour').ok).toBe(true);
  });

  it('deducts inputs once at start and delivers outputs once on collection', () => {
    const session = richSession();
    const mill = buildReady(session, 'grain-mill');
    session.inventory.add('wheat', 6);
    expect(session.production.start(mill, 'flour').ok).toBe(true);
    expect(session.inventory.count('wheat')).toBe(3);
    expect(session.production.collect(mill)).toEqual({ ok: false, reason: 'Nothing is ready' });
    expect(session.inventory.count('flour')).toBe(0);

    session.update(session.content.recipes.get('flour').durationSec);
    expect(session.production.collect(mill).ok).toBe(true);
    expect(session.inventory.count('flour')).toBe(1);
    expect(session.production.collect(mill)).toEqual({ ok: false, reason: 'Nothing is ready' });
    expect(session.inventory.count('flour')).toBe(1);
  });

  it('refuses missing ingredients without touching the inventory', () => {
    const session = richSession();
    const bakery = buildReady(session, 'bakery');
    session.inventory.add('flour', 2);
    expect(session.production.start(bakery, 'bread')).toEqual({ ok: false, reason: 'Need 1 Egg' });
    expect(session.inventory.count('flour')).toBe(2);
  });

  it('runs jobs in sequence and respects the queue size', () => {
    const session = richSession();
    const mill = buildReady(session, 'feed-mill');
    session.inventory.add('wheat', 20);
    const slots = session.production.slots(mill);
    for (let i = 0; i < slots; i++)
      expect(session.production.start(mill, 'chicken-feed').ok).toBe(true);
    expect(session.production.start(mill, 'chicken-feed')).toEqual({
      ok: false,
      reason: 'Queue is full',
    });
    const duration = session.content.recipes.get('chicken-feed').durationSec;
    session.update(duration);
    expect(session.production.readyCount(mill)).toBe(1);
    session.update(duration * (slots - 1));
    expect(session.production.collect(mill).ok).toBe(true);
    expect(session.inventory.count('chicken-feed')).toBe(3 * slots);
  });

  it('collects only what fits in the barn and keeps the rest queued', () => {
    const session = richSession();
    const mill = buildReady(session, 'feed-mill');
    session.inventory.add('wheat', 4);
    session.production.start(mill, 'chicken-feed');
    session.production.start(mill, 'chicken-feed');
    session.update(100);
    session.inventory.add('carrot', session.inventory.freeSpace() - 3);
    expect(session.production.collect(mill).ok).toBe(true);
    expect(session.inventory.count('chicken-feed')).toBe(3);
    expect(session.production.readyCount(mill)).toBe(1);
  });

  it('finishes production while the game is closed', () => {
    const store = new MemoryStore();
    const clock = new FakeClock();
    const first = richSession(20, { store, clock });
    const mill = buildReady(first, 'grain-mill');
    first.inventory.add('wheat', 3);
    first.production.start(mill, 'flour');
    first.save();

    clock.advanceSec(120);
    const second = richSession(20, { store, clock });
    expect(second.production.readyCount(mill)).toBe(1);
    expect(second.production.collect(mill).ok).toBe(true);
    expect(second.inventory.count('flour')).toBe(1);
  });

  it('upgrades for more slots and blocks demolition while busy', () => {
    const session = richSession();
    const mill = buildReady(session, 'grain-mill');
    const before = session.production.slots(mill);
    expect(session.farm.upgradeBuilding(mill).ok).toBe(true);
    expect(session.production.slots(mill)).toBe(before + 1);
    session.inventory.add('wheat', 3);
    session.production.start(mill, 'flour');
    expect(session.farm.demolish(mill)).toEqual({ ok: false, reason: 'Collect production first' });
  });

  it('allows one of each production building', () => {
    const session = richSession();
    buildAnywhere(session, 'dairy');
    expect(session.farm.buildBlocker('dairy')).toBe('Already built');
  });
});
