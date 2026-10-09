import { fail, ok, type ActionResult } from '../actions';
import type { DepositDef, MineNodeDef, PickaxeDef, Quantities } from '../entities/content';
import type { MineNodeState } from '../entities/types';
import { BARN_FULL } from '../FarmService';
import { randomInt, weightedPick } from '../random';
import type { GameContext } from './GameContext';
import { payCost } from './rewards';

export type StrikeResult =
  | { ok: true; broken: false; hp: number }
  | { ok: true; broken: true; items: Quantities }
  | { ok: false; reason: string };

export type NodeStatus = 'ready' | 'regrowing';

// The mine: deposits take a few pickaxe strikes, drop ore once, then grow back on a timer.
// Broken state lives in the save, so re-tapping or reloading can never pay a deposit twice.
export class MiningService {
  constructor(private readonly ctx: GameContext) {}

  private get mining() {
    return this.ctx.state.mining;
  }

  isUnlocked(): boolean {
    return this.ctx.progression.isUnlocked(this.ctx.content.config.mining.unlockLevel);
  }

  unlockLevel(): number {
    return this.ctx.content.config.mining.unlockLevel;
  }

  nodes(): MineNodeDef[] {
    return this.ctx.content.mineNodes.all();
  }

  deposit(nodeId: string): DepositDef {
    return this.ctx.content.deposits.get(this.ctx.content.mineNodes.get(nodeId).deposit);
  }

  pickaxe(): PickaxeDef {
    return (
      this.ctx.content.pickaxes.find(this.mining.pickaxeId) ??
      (this.ctx.content.pickaxes.all()[0] as PickaxeDef)
    );
  }

  nextPickaxe(): PickaxeDef | undefined {
    return this.ctx.content.pickaxes.all().find((p) => p.tier === this.pickaxe().tier + 1);
  }

  /** Damage per strike: every tier above a deposit's own hits once more. */
  power(deposit: DepositDef): number {
    return 1 + Math.max(0, this.pickaxe().tier - deposit.tier);
  }

  status(nodeId: string): NodeStatus {
    const node = this.mining.nodes[nodeId];
    if (!node || node.respawnAt === 0) return 'ready';
    return this.ctx.time.now() >= node.respawnAt ? 'ready' : 'regrowing';
  }

  /** Strikes left on a standing deposit. */
  hp(nodeId: string): number {
    const node = this.liveNode(nodeId);
    return node?.hp ?? this.deposit(nodeId).hp;
  }

  regrowRemaining(nodeId: string): number {
    const node = this.mining.nodes[nodeId];
    return node ? Math.max(0, node.respawnAt - this.ctx.time.now()) : 0;
  }

  blocker(nodeId: string): string | null {
    if (!this.ctx.content.mineNodes.has(nodeId)) return 'Nothing to mine';
    if (!this.isUnlocked()) return `The mine opens at level ${this.unlockLevel()}`;
    const deposit = this.deposit(nodeId);
    if (deposit.tier > this.pickaxe().tier) {
      const needed = this.ctx.content.pickaxes.all().find((p) => p.tier >= deposit.tier);
      return `Needs a ${needed?.name ?? 'better pickaxe'}`;
    }
    if (this.status(nodeId) === 'regrowing') return 'Already mined, it will grow back';
    const most = Math.max(...deposit.drops.map((drop) => drop.max));
    if (!this.ctx.inventory.canFit(most)) return BARN_FULL;
    return null;
  }

  strike(nodeId: string): StrikeResult {
    const blocker = this.blocker(nodeId);
    if (blocker) return { ok: false, reason: blocker };
    const deposit = this.deposit(nodeId);
    const hp = Math.max(0, this.hp(nodeId) - this.power(deposit));
    if (hp > 0) {
      this.mining.nodes[nodeId] = { hp, respawnAt: 0 };
      this.ctx.bus.emit('DepositStruck', { nodeId, hp });
      return { ok: true, broken: false, hp };
    }
    const { random, inventory, progression, time, bus } = this.ctx;
    const drop = weightedPick(
      random,
      deposit.drops.map((d): [typeof d, number] => [d, d.weight]),
    );
    const items = { [drop.item]: randomInt(random, drop.min, drop.max) };
    inventory.addAll(items);
    this.mining.nodes[nodeId] = { hp: deposit.hp, respawnAt: time.now() + deposit.respawnSec };
    progression.addXp(deposit.xp);
    bus.emit('DepositMined', { nodeId, depositId: deposit.id, items });
    return { ok: true, broken: true, items };
  }

  upgradePickaxe(): ActionResult {
    const next = this.nextPickaxe();
    if (!next) return fail('Best pickaxe already');
    if (!this.ctx.progression.isUnlocked(next.unlockLevel)) {
      return fail(`Unlocks at level ${next.unlockLevel}`);
    }
    const paid = payCost(this.ctx, next.price, next.materials);
    if (!paid.ok) return paid;
    this.mining.pickaxeId = next.id;
    this.ctx.bus.emit('PickaxeUpgraded', { pickaxeId: next.id });
    return ok;
  }

  // A deposit whose regrow time has passed counts as fresh again.
  private liveNode(nodeId: string): MineNodeState | undefined {
    const node = this.mining.nodes[nodeId];
    if (!node) return undefined;
    if (node.respawnAt > 0 && this.ctx.time.now() >= node.respawnAt) {
      delete this.mining.nodes[nodeId];
      return undefined;
    }
    return node.respawnAt > 0 ? { hp: 0, respawnAt: node.respawnAt } : node;
  }
}
