import { fail, ok, type ActionResult } from './actions';
import { DEBUG_MODE } from './debug';
import type { ItemCategory } from './entities/content';
import type { BlockExpansion } from './entities/types';
import type { Spot } from './systems/WorldSystem';
import type { GameContext } from './services/GameContext';
import { payCost } from './services/rewards';

export type { ActionResult } from './actions';

export const BARN_FULL = 'Barn is full';

// Player-facing farm actions that span several systems. Anything that spends or earns goes here.
export class FarmService {
  constructor(
    private readonly ctx: GameContext,
    private readonly refundRatio: number,
    private readonly expansionBlocks: readonly BlockExpansion[],
  ) {}

  plant(plotId: number, cropId: string): ActionResult {
    const { plots, economy, content, seasons, progression, world } = this.ctx;
    if (!plots.isPlot(plotId)) return fail('That is not a garden bed');
    if (!content.crops.has(cropId)) return fail('Unknown crop');
    if (!plots.isEmpty(plotId)) return fail('Bed is occupied');
    const crop = content.crops.get(cropId);
    const object = world.get(plotId);
    const soil = object ? (content.catalog.get(object.itemId).soil ?? 'bed') : 'bed';
    if (crop.plantOn !== soil) {
      return fail(
        crop.plantOn === 'orchard' ? 'Trees need an orchard plot' : 'Plant this in a bed',
      );
    }
    if (!progression.isUnlocked(crop.unlockLevel))
      return fail(`Unlocks at level ${crop.unlockLevel}`);
    if (!DEBUG_MODE && plots.seasonRate(cropId) <= 0) {
      return fail(`${crop.name} won't grow in ${seasons.current().name}`);
    }
    // Sow one from the barn when there is one; otherwise buy the seed.
    const fromBarn = this.ctx.inventory.count(cropId) > 0;
    if (fromBarn) this.ctx.inventory.remove(cropId, 1);
    else if (!economy.spend(crop.seedCost)) return fail('Not enough money');
    plots.plant(plotId, cropId);
    if (fromBarn) this.ctx.bus.emit('SeedUsed', { plotId, cropId });
    return ok;
  }

  /** What planting this crop costs right now: one from the barn, or the seed price. */
  seedSource(cropId: string): 'barn' | 'market' {
    return this.ctx.inventory.count(cropId) > 0 ? 'barn' : 'market';
  }

  water(plotId: number): ActionResult {
    const { plots } = this.ctx;
    if (!plots.isPlot(plotId) || plots.isEmpty(plotId)) return fail('Nothing to water');
    if (plots.isReady(plotId)) return fail('Ready to harvest');
    if (!plots.water(plotId)) return fail('Already watered');
    return ok;
  }

  harvest(plotId: number): ActionResult {
    const { plots, inventory, bus, content, progression } = this.ctx;
    if (!plots.isPlot(plotId)) return fail('That is not a garden bed');
    const ready = plots.peekHarvest(plotId);
    if (!ready) return fail('Nothing to harvest');
    if (!inventory.canFit(ready.amount)) return fail(BARN_FULL);
    const harvest = plots.harvest(plotId);
    if (!harvest) return fail('Nothing to harvest');
    inventory.add(harvest.cropId, harvest.amount);
    const xp = content.crops.get(harvest.cropId).xp;
    progression.addXp(xp);
    bus.emit('CropHarvested', { plotId, ...harvest, xp });
    return ok;
  }

  /** Digs up a crop, e.g. an unwanted fruit tree; nothing is refunded. */
  clearPlot(plotId: number): ActionResult {
    const { plots } = this.ctx;
    if (!plots.isPlot(plotId) || !plots.clear(plotId)) return fail('Nothing planted');
    return ok;
  }

  sell(itemId: string, amount: number): ActionResult {
    const { inventory, content, economy, bus } = this.ctx;
    const item = content.items.find(itemId);
    if (!item || item.sellPrice <= 0) return fail("That can't be sold");
    if (!inventory.remove(itemId, amount)) return fail('Not enough to sell');
    const revenue = amount * item.sellPrice;
    economy.earn(revenue, 'sale');
    bus.emit('ItemSold', { itemId, amount, revenue });
    return ok;
  }

  sellAll(itemId: string): ActionResult {
    return this.sell(itemId, this.ctx.inventory.count(itemId));
  }

  /** Sells every sellable item (optionally one category) and returns the total revenue. */
  sellEverything(category?: ItemCategory): number {
    const { content, inventory } = this.ctx;
    let revenue = 0;
    for (const [id, count] of inventory.entries()) {
      const item = content.items.get(id);
      if (item.sellPrice <= 0 || (category && item.category !== category)) continue;
      if (this.sell(id, count).ok) revenue += count * item.sellPrice;
    }
    return revenue;
  }

  buy(itemId: string, amount: number): ActionResult {
    const { content, inventory, economy, progression, bus } = this.ctx;
    const item = content.items.find(itemId);
    if (!item || item.buyPrice === undefined) return fail('The market does not sell that');
    if (!Number.isInteger(amount) || amount < 1) return fail('Pick an amount');
    if (!progression.isUnlocked(item.unlockLevel)) {
      return fail(`Unlocks at level ${item.unlockLevel}`);
    }
    if (!inventory.canFit(amount)) return fail(BARN_FULL);
    const cost = item.buyPrice * amount;
    if (!economy.spend(cost)) return fail('Not enough money');
    inventory.add(itemId, amount);
    bus.emit('ItemBought', { itemId, amount, cost });
    return ok;
  }

  /** Why an item can't be built right now, or null if it can be (placement aside). */
  buildBlocker(itemId: string): string | null {
    const { content, world, progression, state } = this.ctx;
    if (!content.catalog.has(itemId)) return 'Unknown item';
    const item = content.catalog.get(itemId);
    if (!DEBUG_MODE) {
      if (!item.available) return 'Coming soon';
      if (item.rewardOnly && !state.unlocks.includes(itemId)) return 'Earned from a trophy';
      if (!progression.isUnlocked(item.unlockLevel)) return `Unlocks at level ${item.unlockLevel}`;
      if (item.maxCount !== undefined && world.countOf(itemId) >= item.maxCount) {
        return item.maxCount === 1 ? 'Already built' : `Limit of ${item.maxCount}`;
      }
    }
    return null;
  }

  build(itemId: string, spot: Spot): ActionResult {
    const { content, world, economy, plots, buildings, bus } = this.ctx;
    const blocker = this.buildBlocker(itemId);
    if (blocker) return fail(blocker);
    const item = content.catalog.get(itemId);
    if (!world.canPlace(itemId, spot)) return fail("Can't build there");
    if (!economy.spend(item.price)) return fail('Not enough money');
    const object = world.place(itemId, spot);
    if (!object) return fail("Can't build there");
    if (item.kind === 'plot') plots.create(object.id);
    if (buildings.hasBehaviour(itemId)) buildings.create(object.id, itemId);
    bus.emit('ObjectPlaced', { object });
    return ok;
  }

  move(objectId: number, spot: Spot): ActionResult {
    const { world, bus } = this.ctx;
    const object = world.get(objectId);
    if (!object) return fail('Nothing there');
    const from = world.move(objectId, spot);
    if (!from) return fail("Can't move it there");
    bus.emit('ObjectMoved', { object, from });
    return ok;
  }

  /** Turns an object a quarter in place: its footprint swaps and its art mirrors. */
  rotate(objectId: number): ActionResult {
    const { world, bus } = this.ctx;
    const object = world.get(objectId);
    if (!object) return fail('Nothing there');
    const spot = { col: object.col, row: object.row, rotated: !object.rotated };
    const from = world.move(objectId, spot);
    if (!from) return fail('No room to turn it');
    bus.emit('ObjectMoved', { object, from });
    return ok;
  }

  demolish(objectId: number): ActionResult {
    const { content, world, economy, plots, buildings, bus } = this.ctx;
    const object = world.get(objectId);
    if (!object) return fail('Nothing there');
    const item = content.catalog.get(object.itemId);
    if (!item.removable) return fail(`The ${item.name} stays`);
    if (plots.isPlot(objectId) && !plots.isEmpty(objectId)) return fail('Harvest the bed first');
    if (buildings.isBuilding(objectId)) {
      const record = buildings.record(objectId);
      if (record.queue.length > 0) return fail('Collect production first');
      if (record.animals.length > 0) return fail('It still houses animals');
    }
    world.remove(objectId);
    plots.delete(objectId);
    buildings.delete(objectId);
    economy.earn(Math.floor(item.price * this.refundRatio), 'refund');
    bus.emit('ObjectRemoved', { object });
    return ok;
  }

  /** Every fixed plot not yet bought, stone-bordered on the map until it is. */
  pendingBlocks(): readonly BlockExpansion[] {
    const claimed = new Set(this.ctx.state.claimedBlocks);
    return this.expansionBlocks.filter((b) => !claimed.has(b.id));
  }

  /** The not-yet-bought plot covering this tile, if any. */
  blockAt(col: number, row: number): BlockExpansion | undefined {
    return this.pendingBlocks().find(
      (b) => col >= b.col && col < b.col + b.cols && row >= b.row && row < b.row + b.rows,
    );
  }

  /** The cheapest plot the player could buy right now (unlocked and touching owned land). */
  cheapestAvailableBlock(): BlockExpansion | undefined {
    const { progression } = this.ctx;
    return this.pendingBlocks()
      .filter((b) => progression.isUnlocked(b.unlockLevel) && this.touchesOwned(b))
      .sort((a, b) => a.price - b.price)[0];
  }

  /** True once a plot shares an edge with land the player already owns. */
  touchesOwned(block: Pick<BlockExpansion, 'col' | 'row' | 'cols' | 'rows'>): boolean {
    const { world } = this.ctx;
    for (let c = block.col; c < block.col + block.cols; c++) {
      if (world.isOwned(c, block.row - 1)) return true;
      if (world.isOwned(c, block.row + block.rows)) return true;
    }
    for (let r = block.row; r < block.row + block.rows; r++) {
      if (world.isOwned(block.col - 1, r)) return true;
      if (world.isOwned(block.col + block.cols, r)) return true;
    }
    return false;
  }

  claimBlock(id: string): ActionResult {
    const { economy, progression, state, bus } = this.ctx;
    const block = this.expansionBlocks.find((b) => b.id === id);
    if (!block) return fail('Unknown plot');
    if (state.claimedBlocks.includes(id)) return fail('Already yours');
    if (!progression.isUnlocked(block.unlockLevel))
      return fail(`Unlocks at level ${block.unlockLevel}`);
    if (!DEBUG_MODE && !this.touchesOwned(block)) return fail('Clear the land next to it first');
    if (!economy.spend(block.price)) return fail('Not enough money');
    state.ownedBlocks.push({ col: block.col, row: block.row, cols: block.cols, rows: block.rows });
    state.claimedBlocks.push(id);
    bus.emit('LandExpanded', { block });
    return ok;
  }

  upgradeStorage(): ActionResult {
    const { inventory, economy, progression, bus } = this.ctx;
    const next = inventory.nextStorage();
    if (!next) return fail('Barn is fully upgraded');
    if (!progression.isUnlocked(next.unlockLevel))
      return fail(`Unlocks at level ${next.unlockLevel}`);
    if (!economy.spend(next.cost)) return fail('Not enough money');
    inventory.upgradeStorage();
    bus.emit('StorageUpgraded', { capacity: inventory.capacity() });
    return ok;
  }

  upgradeBuilding(objectId: number): ActionResult {
    const { buildings, progression } = this.ctx;
    if (!buildings.isBuilding(objectId)) return fail('Nothing to upgrade');
    if (!buildings.isOperational(objectId)) return fail('Still under construction');
    const next = buildings.nextLevel(objectId);
    if (!next) return fail('Fully upgraded');
    if (!progression.isUnlocked(next.unlockLevel))
      return fail(`Unlocks at level ${next.unlockLevel}`);
    const paid = payCost(this.ctx, next.cost, next.materials);
    if (!paid.ok) return paid;
    buildings.upgrade(objectId);
    return ok;
  }
}
