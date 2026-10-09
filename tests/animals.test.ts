import { describe, expect, it } from 'vitest';
import { buildAnywhere, buildReady, config, richSession, scripted } from './helpers';

const chicken = config.animals.animals.find((a) => a.id === 'chicken')!;

describe('animals', () => {
  it('buys animals up to the housing capacity', () => {
    const session = richSession();
    const coop = buildReady(session, 'coop');
    const capacity = session.ranch.capacity(coop);
    for (let i = 0; i < capacity; i++) expect(session.ranch.buyAnimal(coop).ok).toBe(true);
    expect(session.ranch.buyAnimal(coop)).toEqual({ ok: false, reason: 'No room left' });
    expect(session.ranch.buyAnimalAnywhere('chicken')).toEqual({
      ok: false,
      reason: 'No room left',
    });
    expect(session.farm.upgradeBuilding(coop).ok).toBe(true);
    expect(session.ranch.buyAnimalAnywhere('chicken').ok).toBe(true);
  });

  it('needs housing before buying from the market', () => {
    const session = richSession();
    expect(session.ranch.buyAnimalAnywhere('cow')).toEqual({
      ok: false,
      reason: 'Build a Cowshed first',
    });
    buildAnywhere(session, 'cowshed');
    expect(session.ranch.buyAnimalAnywhere('cow')).toEqual({ ok: false, reason: 'No room left' });
  });

  it('feeds, produces and collects exactly once', () => {
    const session = richSession(20, { random: scripted(0.99) });
    const coop = buildReady(session, 'coop');
    session.ranch.buyAnimal(coop);
    session.ranch.buyAnimal(coop);
    expect(session.ranch.feedAll(coop)).toEqual({ ok: false, reason: 'Need 1 Chicken Feed' });

    session.inventory.add('chicken-feed', 1);
    expect(session.ranch.feedAll(coop).ok).toBe(true);
    expect(session.ranch.countByStatus(coop, 'producing')).toBe(1);
    expect(session.ranch.countByStatus(coop, 'hungry')).toBe(1);
    expect(session.inventory.count('chicken-feed')).toBe(0);
    expect(session.ranch.collectAll(coop)).toEqual({ ok: false, reason: 'Nothing to collect' });

    session.update(chicken.produceSec);
    expect(session.ranch.collectAll(coop).ok).toBe(true);
    expect(session.inventory.count('egg')).toBe(1);
    expect(session.ranch.collectAll(coop)).toEqual({ ok: false, reason: 'Nothing to collect' });
    expect(session.inventory.count('egg')).toBe(1);
  });

  it('loses happiness while left hungry and regains it by feeding', () => {
    const session = richSession();
    const coop = buildReady(session, 'coop');
    session.ranch.buyAnimal(coop);
    const animal = session.ranch.animals(coop)[0]!;
    const start = session.ranch.happiness(animal);
    session.update(config.farm.dayLengthSec);
    const hungry = session.ranch.happiness(animal);
    expect(hungry).toBeCloseTo(start - config.animals.happiness.idleLossPerDay);
    session.inventory.add('chicken-feed', 1);
    session.ranch.feedAll(coop);
    expect(session.ranch.happiness(animal)).toBeCloseTo(hungry + config.animals.happiness.feedGain);
  });

  it('happy animals can give a bonus product', () => {
    const session = richSession(20, { random: scripted(0) });
    const coop = buildReady(session, 'coop');
    session.ranch.buyAnimal(coop);
    session.ranch.animals(coop)[0]!.happiness = 100;
    session.inventory.add('chicken-feed', 1);
    session.ranch.feedAll(coop);
    session.update(chicken.produceSec);
    session.ranch.collectAll(coop);
    expect(session.inventory.count('egg')).toBe(2);
    expect(session.ranch.productiveCount()).toBe(0);
  });

  it('keeps animals from being demolished out of their home', () => {
    const session = richSession();
    const coop = buildReady(session, 'coop');
    session.ranch.buyAnimal(coop);
    expect(session.farm.demolish(coop)).toEqual({ ok: false, reason: 'It still houses animals' });
  });
});
