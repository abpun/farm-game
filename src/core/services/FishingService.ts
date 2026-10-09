import { fail, ok, type ActionResult } from '../actions';
import type { BaitDef, FishDef, FishingData, Rarity, RodDef } from '../entities/content';
import type { FishingCast } from '../entities/types';
import { BARN_FULL } from '../FarmService';
import { pick, randomBetween, weightedPick } from '../random';
import type { GameContext } from './GameContext';

export type FishingPhase = 'idle' | 'waiting' | 'bite';

export type ReelResult =
  { ok: true; fishId: string; firstCatch: boolean } | { ok: false; reason: string };

const COMMON: Rarity = 'common';

// Cast → wait for a bite → reel within the window. The fish is rolled at cast time and
// the cast is cleared as soon as it resolves, so a catch can only be paid once.
export class FishingService {
  /** castAt of the cast whose bite was already announced. */
  private announcedBite: number | null = null;

  constructor(private readonly ctx: GameContext) {}

  private get data(): FishingData {
    return this.ctx.content.config.fishing;
  }

  private get fishing() {
    return this.ctx.state.fishing;
  }

  level(): number {
    const xp = this.fishing.xp;
    return this.data.levels.filter((threshold) => xp >= threshold).length;
  }

  /** XP progress within the current fishing level as [earned, needed]; needed 0 at max. */
  levelProgress(): [number, number] {
    const level = this.level();
    const current = this.data.levels[level - 1] ?? 0;
    const next = this.data.levels[level];
    return next === undefined ? [0, 0] : [this.fishing.xp - current, next - current];
  }

  rod(): RodDef {
    return (
      this.ctx.content.rods.find(this.fishing.rodId) ?? (this.ctx.content.rods.all()[0] as RodDef)
    );
  }

  nextRod(): RodDef | undefined {
    const rods = this.ctx.content.rods.all();
    return rods[rods.findIndex((rod) => rod.id === this.rod().id) + 1];
  }

  baits(): BaitDef[] {
    return this.data.baits;
  }

  cast(): FishingCast | null {
    return this.fishing.cast;
  }

  phase(): FishingPhase {
    const cast = this.fishing.cast;
    if (!cast) return 'idle';
    return this.ctx.time.now() >= cast.biteAt ? 'bite' : 'waiting';
  }

  /** Fish this spot can yield at the current fishing level. */
  catchable(spotId: string): FishDef[] {
    const level = this.level();
    return this.ctx.content.fish
      .all()
      .filter((fish) => fish.spots.includes(spotId) && fish.fishingLevel <= level);
  }

  spotBlocker(spotId: string): string | null {
    const spot = this.ctx.content.spots.find(spotId);
    if (!spot) return 'Unknown fishing spot';
    if (!this.ctx.progression.isUnlocked(spot.unlockLevel)) {
      return `Unlocks at level ${spot.unlockLevel}`;
    }
    return null;
  }

  startCast(spotId: string, baitId: string | null = null): ActionResult {
    const { inventory, time, random, bus } = this.ctx;
    if (this.fishing.cast) return fail('Already fishing');
    const blocker = this.spotBlocker(spotId);
    if (blocker) return fail(blocker);
    const bait = baitId ? this.data.baits.find((b) => b.item === baitId) : undefined;
    if (baitId && !bait) return fail('Unknown bait');
    if (bait && bait.fishingLevel > this.level()) {
      return fail(`Bait needs fishing level ${bait.fishingLevel}`);
    }
    if (!inventory.canFit(1)) return fail(BARN_FULL);
    if (bait && !inventory.remove(bait.item, 1)) return fail('Out of bait');

    const fish = this.rollFish(spotId, bait);
    const rarity = this.rarity(fish.rarity);
    const delay = randomBetween(random, this.data.biteDelaySec.min, this.data.biteDelaySec.max);
    const now = time.now();
    this.fishing.cast = {
      spotId,
      baitId: bait?.item ?? null,
      fishId: fish.id,
      castAt: now,
      biteAt: now + delay * (bait?.biteSpeed ?? 1),
      reactionSec: rarity.reactionSec + this.rod().reactionBonusSec,
    };
    bus.emit('FishingCast', { spotId });
    return ok;
  }

  /** Resolves the cast: a catch inside the bite window, otherwise the fish gets away. */
  reel(): ReelResult {
    const cast = this.fishing.cast;
    if (!cast) return { ok: false, reason: 'Not fishing' };
    const now = this.ctx.time.now();
    this.fishing.cast = null;
    if (now < cast.biteAt) return this.escape('early', 'Too early! It swam off');
    if (now > cast.biteAt + cast.reactionSec) return this.escape('late', 'It got away');
    if (!this.ctx.inventory.add(cast.fishId, 1)) return this.escape('late', BARN_FULL);
    return this.land(cast.fishId);
  }

  /** Announces a bite once, and lets a fish that was never reeled in get away. */
  update(): void {
    const cast = this.fishing.cast;
    if (!cast) return;
    const now = this.ctx.time.now();
    if (now >= cast.biteAt && this.announcedBite !== cast.castAt) {
      this.announcedBite = cast.castAt;
      this.ctx.bus.emit('FishBite', { spotId: cast.spotId });
    }
    if (now <= cast.biteAt + cast.reactionSec) return;
    this.fishing.cast = null;
    this.ctx.bus.emit('FishEscaped', { reason: 'late' });
  }

  upgradeRod(): ActionResult {
    const next = this.nextRod();
    if (!next) return fail('Best rod already');
    if (this.level() < next.fishingLevel) return fail(`Needs fishing level ${next.fishingLevel}`);
    if (!this.ctx.economy.spend(next.price)) return fail('Not enough money');
    this.fishing.rodId = next.id;
    this.ctx.bus.emit('RodUpgraded', { rodId: next.id });
    return ok;
  }

  private land(fishId: string): ReelResult {
    const { progression, time, bus, content } = this.ctx;
    const record = this.fishing.journal[fishId];
    const firstCatch = !record;
    this.fishing.journal[fishId] = {
      caught: (record?.caught ?? 0) + 1,
      firstCaughtAt: record?.firstCaughtAt ?? time.now(),
    };
    const xp = this.rarity(content.fish.get(fishId).rarity).xp;
    this.fishing.xp += xp;
    progression.addXp(xp);
    bus.emit('FishCaught', { fishId, firstCatch });
    return { ok: true, fishId, firstCatch };
  }

  private escape(reason: 'early' | 'late', message: string): ReelResult {
    this.ctx.bus.emit('FishEscaped', { reason });
    return { ok: false, reason: message };
  }

  private rarity(id: Rarity) {
    const rarity = this.data.rarities.find((r) => r.id === id);
    if (!rarity) throw new Error(`Unknown rarity ${id}`);
    return rarity;
  }

  // Rod and bait luck boost every rarity above common.
  private rollFish(spotId: string, bait: BaitDef | undefined): FishDef {
    const pool = this.catchable(spotId);
    if (pool.length === 0) throw new Error(`No fish at ${spotId}`);
    const luck = this.rod().luck * (bait?.luck ?? 1);
    const rarities = this.data.rarities
      .filter((r) => pool.some((fish) => fish.rarity === r.id))
      .map((r): [Rarity, number] => [r.id, r.id === COMMON ? r.weight : r.weight * luck]);
    const rarity = weightedPick(this.ctx.random, rarities);
    return pick(
      this.ctx.random,
      pool.filter((fish) => fish.rarity === rarity),
    );
  }
}
