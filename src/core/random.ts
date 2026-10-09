/** Returns a float in [0, 1); injectable so tests can make outcomes deterministic. */
export type Random = () => number;

export const randomInt = (random: Random, min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));

export const randomBetween = (random: Random, min: number, max: number): number =>
  min + random() * (max - min);

export function pick<T>(random: Random, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('Cannot pick from an empty list');
  return item;
}

export function weightedPick<T>(random: Random, entries: ReadonlyArray<[T, number]>): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  const last = entries[entries.length - 1];
  if (!last) throw new Error('Cannot pick from an empty list');
  return last[0];
}

/** Picks up to `count` distinct items. */
export function sample<T>(random: Random, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  while (result.length < count && pool.length > 0) {
    const [item] = pool.splice(Math.floor(random() * pool.length), 1);
    if (item !== undefined) result.push(item);
  }
  return result;
}
