import { fail, ok, type ActionResult } from '../actions';
import type { Quantities, Reward } from '../entities/content';
import type { GameContext } from './GameContext';

/** Takes coins and materials together, or nothing at all if either is short. */
export function payCost(ctx: GameContext, coins: number, materials: Quantities = {}): ActionResult {
  const { economy, inventory } = ctx;
  if (!inventory.has(materials)) return fail(`Needs ${describeQuantities(ctx, materials)}`);
  if (!economy.canAfford(coins)) return fail('Not enough money');
  if (!inventory.removeAll(materials) || !economy.spend(coins)) return fail('Payment failed');
  return ok;
}

/** Pays out a reward; reward items may overflow the barn so they are never lost. */
export function grantReward(ctx: GameContext, reward: Reward): void {
  if (reward.coins) ctx.economy.earn(reward.coins, 'reward');
  if (reward.items) ctx.inventory.addAll(reward.items, true);
  for (const id of reward.unlocks ?? []) {
    if (!ctx.state.unlocks.includes(id)) ctx.state.unlocks.push(id);
  }
  if (reward.xp) ctx.progression.addXp(reward.xp);
}

export function describeQuantities(
  ctx: Pick<GameContext, 'content'>,
  quantities: Record<string, number>,
): string {
  return Object.entries(quantities)
    .map(([id, count]) => `${count} ${ctx.content.items.name(id)}`)
    .join(', ');
}
