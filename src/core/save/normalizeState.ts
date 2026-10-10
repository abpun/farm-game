import type { Content } from '../config/Content';
import type {
  AchievementState,
  AnimalState,
  BuildingState,
  ExplorationState,
  FarmState,
  FishingCast,
  FishingState,
  FishRecord,
  GameConfig,
  MineNodeState,
  MiningState,
  Order,
  OrdersState,
  PlotCrop,
  ProductionJob,
} from '../entities/types';
import { emptyPlot } from '../systems/PlotSystem';
import type { StoredPlot, StoredState } from './saveFormat';

export function createEmptyState(config: GameConfig): FarmState {
  return {
    money: config.farm.startingMoney,
    time: 0,
    inventory: {},
    nextObjectId: 1,
    objects: [],
    plots: {},
    xp: 0,
    level: 1,
    landSize: config.farm.land.startSize,
    storageLevel: 1,
    stats: {},
    buildings: {},
    fishing: emptyFishing(config),
    orders: emptyOrders(),
    achievements: {},
    unlocks: [],
    mining: emptyMining(config),
    exploration: { found: [] },
  };
}

const emptyMining = (config: GameConfig): MiningState => ({
  pickaxeId: config.mining.pickaxes[0]?.id ?? '',
  nodes: {},
});

const emptyFishing = (config: GameConfig): FishingState => ({
  rodId: config.fishing.rods[0]?.id ?? '',
  boatId: null,
  xp: 0,
  journal: {},
  cast: null,
});

const emptyOrders = (): OrdersState => ({
  nextId: 1,
  offers: [],
  refills: [],
  active: [],
  history: [],
  reputation: 0,
  daily: null,
  dailyDay: 0,
});

// Turns any stored state into a valid FarmState: defaults for missing fields, unknown
// content dropped, damaged records replaced. Old saves never crash the game.
export function normalizeState(stored: StoredState, content: Content): FarmState {
  const { config } = content;
  const objects = stored.objects.filter((object) => content.catalog.has(object.itemId));
  const kindOf = (itemId: string) => content.catalog.get(itemId).kind;
  const plotIds = new Set(
    objects.filter((o) => kindOf(o.itemId) === 'plot').map((o) => String(o.id)),
  );
  const plots: Record<string, PlotCrop> = {};
  for (const id of plotIds) {
    const plot = stored.plots[id];
    plots[id] = plot ? toPlotCrop(plot, stored.time, content) : emptyPlot();
  }

  const buildingIds = objects.filter((o) => content.buildings.has(o.itemId));
  const buildings: Record<string, BuildingState> = {};
  for (const object of buildingIds) {
    const record = stored.buildings?.[String(object.id)];
    buildings[String(object.id)] = toBuilding(record, object.itemId, content);
  }

  const levels = config.progression.levels.length;
  const storageLevels = config.buildings.storage.length;
  const land = config.farm.land;
  const validSizes = [land.startSize, ...land.expansions.map((e) => e.size)];

  return {
    money: stored.money,
    time: stored.time,
    inventory: Object.fromEntries(
      Object.entries(stored.inventory).filter(
        ([id, count]) => content.items.has(id) && count > 0 && Number.isInteger(count),
      ),
    ),
    nextObjectId: Math.max(stored.nextObjectId, ...objects.map((o) => o.id + 1)),
    objects,
    plots,
    xp: nonNegative(stored.xp, 0),
    level: clampInt(stored.level, 1, levels, 1),
    landSize: validSizes.includes(stored.landSize ?? -1)
      ? (stored.landSize as number)
      : land.startSize,
    storageLevel: clampInt(stored.storageLevel, 1, storageLevels, 1),
    stats: numberRecord(stored.stats),
    buildings,
    fishing: toFishing(stored.fishing, content),
    orders: toOrders(stored.orders, content),
    achievements: toAchievements(stored.achievements, content),
    unlocks: Array.isArray(stored.unlocks)
      ? stored.unlocks.filter((id) => typeof id === 'string' && content.catalog.has(id))
      : [],
    mining: toMining(stored.mining, content),
    exploration: toExploration(stored.exploration, content),
  };
}

function toPlotCrop(plot: StoredPlot, time: number, content: Content): PlotCrop {
  const cropId = plot.cropId && content.crops.has(plot.cropId) ? plot.cropId : null;
  if (!cropId) return emptyPlot();
  const growth =
    'growth' in plot
      ? plot.growth
      : (time - plot.legacyPlantedAt) / content.crops.get(cropId).growthTimeSec;
  const extra: Partial<PlotCrop> = 'growth' in plot ? plot : {};
  return {
    cropId,
    growth: Math.max(0, Math.min(1, Number.isFinite(growth) ? growth : 0)),
    watered: extra.watered === true,
    matured: extra.matured === true && content.crops.get(cropId).regrowSec !== undefined,
  };
}

function toBuilding(record: unknown, itemId: string, content: Content): BuildingState {
  const def = content.buildings.get(itemId);
  const raw = isRecord(record) ? record : {};
  const animalId = content.animalFor(itemId)?.id;
  const queue = Array.isArray(raw.queue)
    ? raw.queue.filter(
        (job): job is ProductionJob =>
          isRecord(job) &&
          typeof job.recipeId === 'string' &&
          content.recipes.find(job.recipeId)?.building === itemId &&
          isFiniteNumber(job.startsAt) &&
          isFiniteNumber(job.endsAt),
      )
    : [];
  const animals = Array.isArray(raw.animals)
    ? raw.animals.filter(
        (a): a is AnimalState =>
          isRecord(a) &&
          a.animalId === animalId &&
          isFiniteNumber(a.happiness) &&
          (a.readyAt === null || isFiniteNumber(a.readyAt)) &&
          isFiniteNumber(a.idleSince),
      )
    : [];
  return {
    level: clampInt(raw.level, 1, def.levels.length, 1),
    readyAt: isFiniteNumber(raw.readyAt) ? raw.readyAt : 0,
    queue: queue.sort((a, b) => a.endsAt - b.endsAt),
    animals,
  };
}

function toFishing(raw: unknown, content: Content): FishingState {
  const fallback = emptyFishing(content.config);
  if (!isRecord(raw)) return fallback;
  const journal: Record<string, FishRecord> = {};
  if (isRecord(raw.journal)) {
    for (const [id, record] of Object.entries(raw.journal)) {
      if (!content.fish.has(id) || !isRecord(record) || !isFiniteNumber(record.caught)) continue;
      journal[id] = {
        caught: record.caught,
        firstCaughtAt: isFiniteNumber(record.firstCaughtAt) ? record.firstCaughtAt : 0,
      };
    }
  }
  return {
    rodId:
      typeof raw.rodId === 'string' && content.rods.has(raw.rodId) ? raw.rodId : fallback.rodId,
    boatId: typeof raw.boatId === 'string' && content.boats.has(raw.boatId) ? raw.boatId : null,
    xp: nonNegative(raw.xp, 0),
    journal,
    cast: toCast(raw.cast, content),
  };
}

function toCast(raw: unknown, content: Content): FishingCast | null {
  if (!isRecord(raw)) return null;
  const valid =
    typeof raw.spotId === 'string' &&
    content.spots.has(raw.spotId) &&
    typeof raw.fishId === 'string' &&
    content.fish.has(raw.fishId) &&
    (raw.baitId === null || typeof raw.baitId === 'string') &&
    isFiniteNumber(raw.castAt) &&
    isFiniteNumber(raw.biteAt) &&
    isFiniteNumber(raw.reactionSec);
  return valid ? (raw as unknown as FishingCast) : null;
}

function toMining(raw: unknown, content: Content): MiningState {
  const fallback = emptyMining(content.config);
  if (!isRecord(raw)) return fallback;
  const nodes: Record<string, MineNodeState> = {};
  if (isRecord(raw.nodes)) {
    for (const [id, node] of Object.entries(raw.nodes)) {
      if (!content.mineNodes.has(id) || !isRecord(node)) continue;
      nodes[id] = { hp: nonNegative(node.hp, 0), respawnAt: nonNegative(node.respawnAt, 0) };
    }
  }
  const pickaxeId =
    typeof raw.pickaxeId === 'string' && content.pickaxes.has(raw.pickaxeId)
      ? raw.pickaxeId
      : fallback.pickaxeId;
  return { pickaxeId, nodes };
}

function toExploration(raw: unknown, content: Content): ExplorationState {
  if (!isRecord(raw) || !Array.isArray(raw.found)) return { found: [] };
  const found = raw.found.filter(
    (id): id is string => typeof id === 'string' && content.discoveries.has(id),
  );
  return { found: [...new Set(found)] };
}

function toOrders(raw: unknown, content: Content): OrdersState {
  if (!isRecord(raw)) return emptyOrders();
  const orders = (list: unknown) =>
    Array.isArray(list) ? list.filter((o): o is Order => isOrder(o, content)) : [];
  const all = [...orders(raw.offers), ...orders(raw.active), ...orders(raw.history)];
  const daily = isOrder(raw.daily, content) ? raw.daily : null;
  const maxId = Math.max(0, ...all.map((o) => o.id), daily?.id ?? 0);
  return {
    nextId: Math.max(nonNegative(raw.nextId, 1), maxId + 1),
    offers: orders(raw.offers).filter((o) => o.status === 'available'),
    refills: Array.isArray(raw.refills) ? raw.refills.filter(isFiniteNumber) : [],
    active: orders(raw.active).filter((o) => o.status === 'active'),
    history: orders(raw.history),
    reputation: nonNegative(raw.reputation, 0),
    daily: daily?.status === 'available' ? daily : null,
    dailyDay: nonNegative(raw.dailyDay, 0),
  };
}

function isOrder(value: unknown, content: Content): value is Order {
  return (
    isRecord(value) &&
    isFiniteNumber(value.id) &&
    typeof value.status === 'string' &&
    isRecord(value.items) &&
    Object.entries(value.items).every(
      ([id, count]) => content.items.has(id) && isFiniteNumber(count) && count > 0,
    ) &&
    isFiniteNumber(value.coins) &&
    isFiniteNumber(value.xp) &&
    isFiniteNumber(value.durationSec)
  );
}

function toAchievements(raw: unknown, content: Content): Record<string, AchievementState> {
  if (!isRecord(raw)) return {};
  const result: Record<string, AchievementState> = {};
  for (const [id, record] of Object.entries(raw)) {
    if (!content.achievements.has(id) || !isRecord(record)) continue;
    result[id] = {
      completedAt: isFiniteNumber(record.completedAt) ? record.completedAt : 0,
      claimed: record.claimed === true,
    };
  }
  return result;
}

function numberRecord(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, number] => isFiniteNumber(entry[1])),
  );
}

const clampInt = (value: unknown, min: number, max: number, fallback: number): number =>
  isFiniteNumber(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;

const nonNegative = (value: unknown, fallback: number): number =>
  isFiniteNumber(value) && value >= 0 ? value : fallback;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
