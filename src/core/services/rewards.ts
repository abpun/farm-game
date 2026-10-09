import type { Reward } from '../entities/content';
import type { GameContext } from './GameContext';

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
