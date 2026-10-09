import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '@core/config/loadConfig';
import { CropRegistry } from '@core/config/CropRegistry';
import { EventBus } from '@core/events/EventBus';
import { GameSession } from '@core/GameSession';
import { MemoryStore } from '@core/save/KeyValueStore';

const newSession = () => new GameSession(loadConfig(), new MemoryStore());
const firstBed = (session: GameSession) => session.plots.ids()[0]!;

describe('EventBus', () => {
  it('delivers payloads and supports unsubscribe', () => {
    const bus = new EventBus<{ Ping: { n: number } }>();
    const handler = vi.fn();
    const off = bus.on('Ping', handler);
    bus.emit('Ping', { n: 1 });
    off();
    bus.emit('Ping', { n: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('CropRegistry', () => {
  it('rejects invalid definitions', () => {
    const crop = { ...loadConfig().crops[0]!, growthTimeSec: 0 };
    expect(() => new CropRegistry([crop])).toThrow();
  });
});

describe('farm loop', () => {
  it('plants, grows, harvests and sells', () => {
    const session = newSession();
    const start = session.economy.balance();
    const carrot = session.crops.get('carrot');
    const bed = firstBed(session);

    expect(session.farm.plant(bed, 'carrot').ok).toBe(true);
    expect(session.economy.balance()).toBe(start - carrot.seedCost);
    expect(session.farm.harvest(bed).ok).toBe(false);
    const rate = session.plots.seasonRate('carrot');
    expect(session.plots.secondsRemaining(bed)).toBeCloseTo(carrot.growthTimeSec / rate);

    session.update(carrot.growthTimeSec);
    expect(session.plots.isReady(bed)).toBe(true);
    expect(session.plots.stage(bed)).toBe(carrot.stages - 1);

    expect(session.farm.harvest(bed).ok).toBe(true);
    expect(session.inventory.count('carrot')).toBe(carrot.yield);
    expect(session.plots.isEmpty(bed)).toBe(true);

    expect(session.farm.sellAll('carrot').ok).toBe(true);
    expect(session.economy.balance()).toBe(
      start - carrot.seedCost + carrot.yield * carrot.sellPrice,
    );
  });

  it('refuses to plant without money or on occupied plots', () => {
    const session = newSession();
    const bed = firstBed(session);
    session.economy.spend(session.economy.balance());
    expect(session.farm.plant(bed, 'carrot')).toEqual({ ok: false, reason: 'Not enough money' });
    session.economy.earn(100);
    session.farm.plant(bed, 'carrot');
    expect(session.farm.plant(bed, 'tomato')).toEqual({ ok: false, reason: 'Bed is occupied' });
  });

  it('is profitable for every configured crop', () => {
    for (const crop of loadConfig().crops) {
      expect(crop.yield * crop.sellPrice).toBeGreaterThan(crop.seedCost);
    }
  });

  it('sells everything in one go', () => {
    const session = newSession();
    session.inventory.add('carrot', 2);
    session.inventory.add('wheat', 3);
    const expected =
      2 * session.crops.get('carrot').sellPrice + 3 * session.crops.get('wheat').sellPrice;
    expect(session.farm.sellEverything()).toBe(expected);
    expect(session.inventory.count('carrot')).toBe(0);
    expect(session.farm.sellEverything()).toBe(0);
  });
});
