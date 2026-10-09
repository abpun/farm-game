export interface Clock {
  /** Wall-clock time in epoch milliseconds. */
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };
