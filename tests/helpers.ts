import { loadConfig } from '@core/config/loadConfig';
import type { GameConfig } from '@core/entities/types';
import { GameSession } from '@core/GameSession';
import type { Clock } from '@core/save/Clock';
import { MemoryStore } from '@core/save/KeyValueStore';

export const config = loadConfig();

export class FakeClock implements Clock {
  constructor(public time = 1_000_000) {}
  now = () => this.time;
  advanceSec = (sec: number) => (this.time += sec * 1000);
}

/** Deterministic random that replays the given values, then repeats the last one. */
export const scripted =
  (...values: number[]) =>
  () => {
    const value = values.length > 1 ? values.shift() : values[0];
    return value ?? 0;
  };

export interface TestSessionOptions {
  store?: MemoryStore;
  clock?: FakeClock;
  random?: () => number;
  config?: GameConfig;
}

export function newSession(options: TestSessionOptions = {}): GameSession {
  return new GameSession(options.config ?? config, options.store ?? new MemoryStore(), {
    clock: options.clock ?? new FakeClock(),
    random: options.random ?? scripted(0),
  });
}

/** A session with plenty of money and the given player level. */
export function richSession(level = 20, options: TestSessionOptions = {}): GameSession {
  const session = newSession(options);
  session.state.level = level;
  session.economy.earn(1_000_000, 'reward');
  return session;
}

export function freeTile(session: GameSession, itemId: string): { col: number; row: number } {
  for (let row = 0; row < session.state.landSize; row++) {
    for (let col = 0; col < session.state.landSize; col++) {
      if (session.world.canPlace(itemId, col, row)) return { col, row };
    }
  }
  throw new Error(`no room for ${itemId}`);
}

/** Builds an item on the first free tile and returns its object id. */
export function buildAnywhere(session: GameSession, itemId: string): number {
  const { col, row } = freeTile(session, itemId);
  const result = session.farm.build(itemId, col, row);
  if (!result.ok) throw new Error(`build ${itemId}: ${result.reason}`);
  return session.world.objectAt(col, row)!.id;
}

/** Builds and waits out construction. */
export function buildReady(session: GameSession, itemId: string): number {
  const id = buildAnywhere(session, itemId);
  session.update(session.buildings.constructionRemaining(id) + 0.01);
  return id;
}
