import { fail, ok, type ActionResult } from '../actions';
import type { Quantities, RecipeDef } from '../entities/content';
import { BARN_FULL } from '../FarmService';
import { enqueue, finishedJobs } from '../systems/productionQueue';
import type { GameContext } from './GameContext';
import { describeQuantities } from './rewards';

const total = (quantities: Quantities) =>
  Object.values(quantities).reduce((sum, count) => sum + count, 0);

// One production engine for every building: validate, deduct inputs once, queue, collect once.
export class ProductionService {
  constructor(private readonly ctx: GameContext) {}

  recipes(objectId: number): RecipeDef[] {
    const object = this.ctx.world.get(objectId);
    return object ? this.ctx.content.recipesFor(object.itemId) : [];
  }

  slots(objectId: number): number {
    return this.ctx.buildings.levelDef(objectId).slots ?? 0;
  }

  /** Why the recipe can't start right now, or null if it can. */
  blocker(objectId: number, recipeId: string): string | null {
    const { buildings, content, progression, inventory, world } = this.ctx;
    if (!buildings.isBuilding(objectId) || buildings.def(objectId).role !== 'production') {
      return 'Not a production building';
    }
    const recipe = content.recipes.find(recipeId);
    if (!recipe || recipe.building !== world.get(objectId)?.itemId) return 'Unknown recipe';
    if (!buildings.isOperational(objectId)) return 'Still under construction';
    if (!progression.isUnlocked(recipe.unlockLevel))
      return `Unlocks at level ${recipe.unlockLevel}`;
    if (buildings.record(objectId).queue.length >= this.slots(objectId)) return 'Queue is full';
    if (!inventory.has(recipe.inputs)) {
      const missing = Object.fromEntries(
        Object.entries(recipe.inputs)
          .map(([id, need]): [string, number] => [id, need - inventory.count(id)])
          .filter(([, short]) => short > 0),
      );
      return `Need ${describeQuantities(this.ctx, missing)}`;
    }
    if (total(recipe.outputs) > inventory.freeSpace() + total(recipe.inputs)) return BARN_FULL;
    return null;
  }

  start(objectId: number, recipeId: string): ActionResult {
    const blocker = this.blocker(objectId, recipeId);
    if (blocker) return fail(blocker);
    const { content, buildings, inventory, time, bus } = this.ctx;
    const recipe = content.recipes.get(recipeId);
    if (!inventory.removeAll(recipe.inputs)) return fail('Missing ingredients');
    enqueue(buildings.record(objectId), recipe, time.now(), buildings.levelDef(objectId).speed);
    bus.emit('ProductionStarted', { objectId, recipeId });
    return ok;
  }

  readyCount(objectId: number): number {
    const { buildings, time } = this.ctx;
    if (!buildings.isBuilding(objectId)) return 0;
    return finishedJobs(buildings.record(objectId), time.now()).length;
  }

  /** Collects finished batches in order until the barn is full. */
  collect(objectId: number): ActionResult {
    const { buildings, content, inventory, progression, time, bus } = this.ctx;
    if (!buildings.isBuilding(objectId)) return fail('Nothing to collect');
    const record = buildings.record(objectId);
    const now = time.now();
    const finished = finishedJobs(record, now);
    if (finished.length === 0) return fail('Nothing is ready');

    // Jobs run in sequence, so finished jobs are always the front of the queue.
    let space = inventory.freeSpace();
    let fitting = 0;
    for (const job of finished) {
      const size = total(content.recipes.get(job.recipeId).outputs);
      if (size > space) break;
      space -= size;
      fitting += 1;
    }
    if (fitting === 0) return fail(BARN_FULL);
    const taken = record.queue.splice(0, fitting);

    const items: Quantities = {};
    let xp = 0;
    for (const job of taken) {
      const recipe = content.recipes.get(job.recipeId);
      for (const [id, count] of Object.entries(recipe.outputs))
        items[id] = (items[id] ?? 0) + count;
      xp += recipe.xp;
    }
    inventory.addAll(items, true);
    progression.addXp(xp);
    bus.emit('ProductionCollected', { objectId, items, batches: taken.length });
    return ok;
  }
}
