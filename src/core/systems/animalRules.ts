import type { HappinessRules } from '../entities/content';
import type { AnimalState } from '../entities/types';

export type AnimalStatus = 'hungry' | 'producing' | 'ready';

// An animal is hungry until fed, producing until readyAt, then ready until collected.

export function animalStatus(animal: AnimalState, now: number): AnimalStatus {
  if (animal.readyAt === null) return 'hungry';
  return now >= animal.readyAt ? 'ready' : 'producing';
}

/** Happiness falls while the animal waits for food or for its product to be collected. */
export function happinessAt(
  animal: AnimalState,
  now: number,
  rules: HappinessRules,
  dayLengthSec: number,
): number {
  const status = animalStatus(animal, now);
  if (status === 'producing') return animal.happiness;
  const idleFrom = status === 'ready' ? (animal.readyAt as number) : animal.idleSince;
  const idleDays = Math.max(0, now - idleFrom) / dayLengthSec;
  return Math.max(0, animal.happiness - idleDays * rules.idleLossPerDay);
}

export function newAnimal(animalId: string, now: number, rules: HappinessRules): AnimalState {
  return { animalId, happiness: rules.start, readyAt: null, idleSince: now };
}

export function feedAnimal(
  animal: AnimalState,
  now: number,
  produceSec: number,
  rules: HappinessRules,
  dayLengthSec: number,
): void {
  const happiness = happinessAt(animal, now, rules, dayLengthSec);
  animal.happiness = Math.min(rules.max, happiness + rules.feedGain);
  animal.readyAt = now + produceSec;
}

/** Chance of a bonus product, from happiness. */
export function bonusChance(happiness: number, rules: HappinessRules): number {
  if (happiness <= rules.bonusFrom) return 0;
  return ((happiness - rules.bonusFrom) / (rules.max - rules.bonusFrom)) * rules.bonusChanceMax;
}

export function collectAnimal(
  animal: AnimalState,
  now: number,
  rules: HappinessRules,
  dayLengthSec: number,
): void {
  animal.happiness = happinessAt(animal, now, rules, dayLengthSec);
  animal.readyAt = null;
  animal.idleSince = now;
}
