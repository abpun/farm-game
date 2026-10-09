import type { Catalog } from './config/Catalog';
import type { CropRegistry } from './config/CropRegistry';
import type { GameBus } from './events/EventBus';
import type { EconomySystem } from './systems/EconomySystem';
import type { InventorySystem } from './systems/InventorySystem';
import type { PlotSystem } from './systems/PlotSystem';
import type { SeasonSystem } from './systems/SeasonSystem';
import type { WorldSystem } from './systems/WorldSystem';

export type ActionResult = { ok: true } | { ok: false; reason: string };

const ok: ActionResult = { ok: true };
const fail = (reason: string): ActionResult => ({ ok: false, reason });

export interface FarmServiceDeps {
  crops: CropRegistry;
  catalog: Catalog;
  plots: PlotSystem;
  seasons: SeasonSystem;
  world: WorldSystem;
  economy: EconomySystem;
  inventory: InventorySystem;
  bus: GameBus;
  refundRatio: number;
}

// Player-facing actions that span several systems. Anything that spends or earns goes here.
export class FarmService {
  constructor(private readonly deps: FarmServiceDeps) {}

  plant(plotId: number, cropId: string): ActionResult {
    const { plots, economy, crops, seasons } = this.deps;
    if (!plots.isPlot(plotId)) return fail('That is not a garden bed');
    if (!plots.isEmpty(plotId)) return fail('Bed is occupied');
    if (plots.seasonRate(cropId) <= 0) {
      return fail(`${crops.get(cropId).name} won't grow in ${seasons.current().name}`);
    }
    if (!economy.spend(crops.get(cropId).seedCost)) return fail('Not enough money');
    plots.plant(plotId, cropId);
    return ok;
  }

  harvest(plotId: number): ActionResult {
    const { plots, inventory, bus } = this.deps;
    if (!plots.isPlot(plotId)) return fail('That is not a garden bed');
    const harvest = plots.harvest(plotId);
    if (!harvest) return fail('Nothing to harvest');
    inventory.add(harvest.cropId, harvest.amount);
    bus.emit('CropHarvested', { plotId, ...harvest });
    return ok;
  }

  sell(cropId: string, amount: number): ActionResult {
    const { inventory, crops, economy, bus } = this.deps;
    if (!inventory.remove(cropId, amount)) return fail('Not enough to sell');
    const revenue = amount * crops.get(cropId).sellPrice;
    economy.earn(revenue);
    bus.emit('CropSold', { cropId, amount, revenue });
    return ok;
  }

  sellAll(cropId: string): ActionResult {
    return this.sell(cropId, this.deps.inventory.count(cropId));
  }

  /** Sells every crop in the inventory and returns the total revenue. */
  sellEverything(): number {
    const { crops, inventory } = this.deps;
    let revenue = 0;
    for (const crop of crops.all()) {
      const count = inventory.count(crop.id);
      if (count > 0 && this.sell(crop.id, count).ok) revenue += count * crop.sellPrice;
    }
    return revenue;
  }

  build(itemId: string, col: number, row: number): ActionResult {
    const { catalog, world, economy, plots, bus } = this.deps;
    if (!catalog.has(itemId)) return fail('Unknown item');
    const item = catalog.get(itemId);
    if (!item.available) return fail('Coming soon');
    if (!world.canPlace(itemId, col, row)) return fail("Can't build there");
    if (!economy.spend(item.price)) return fail('Not enough money');
    const object = world.place(itemId, col, row);
    if (!object) return fail("Can't build there");
    if (item.kind === 'plot') plots.create(object.id);
    bus.emit('ObjectPlaced', { object });
    return ok;
  }

  demolish(objectId: number): ActionResult {
    const { catalog, world, economy, plots, bus, refundRatio } = this.deps;
    const object = world.get(objectId);
    if (!object) return fail('Nothing there');
    const item = catalog.get(object.itemId);
    if (!item.removable) return fail(`The ${item.name} stays`);
    if (plots.isPlot(objectId) && !plots.isEmpty(objectId)) return fail('Harvest the bed first');
    world.remove(objectId);
    plots.delete(objectId);
    economy.earn(Math.floor(item.price * refundRatio));
    bus.emit('ObjectRemoved', { object });
    return ok;
  }
}
