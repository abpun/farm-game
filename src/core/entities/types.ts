import type {
  AchievementsData,
  ExplorationData,
  MiningData,
  AnimalsData,
  BuildingsData,
  FishingData,
  ItemsData,
  OrdersData,
  ProgressionData,
  Quantities,
  RecipesData,
} from './content';

export interface CropVisual {
  kind: string;
  leaf: string;
  produce: string;
  /** Orchard fruit outline (defaults to round). */
  shape?: 'round' | 'pear' | 'oval';
}

/** Where a crop can be planted: tilled garden beds or orchard plots (trees). */
export type Soil = 'bed' | 'orchard';

export interface CropDef {
  id: string;
  name: string;
  /** Market name for what gets planted, e.g. "Apple Tree"; defaults to the crop name. */
  plantName?: string;
  /** Inventory category of the harvested item (its item id is the crop id). */
  category: 'crop' | 'fruit';
  plantOn: Soil;
  unlockLevel: number;
  xp: number;
  visual: CropVisual;
  seedCost: number;
  sellPrice: number;
  growthTimeSec: number;
  /** Set for crops that keep producing: seconds from one harvest to the next. */
  regrowSec?: number;
  stages: number;
  yield: number;
  /** Growth speed per season id: 1 = normal, above 1 = faster, 0 = dormant. */
  seasonGrowth: Record<string, number>;
}

export interface SeasonDef {
  id: string;
  name: string;
}

export interface SeasonsConfig {
  daysPerSeason: number;
  startSeason: string;
  seasons: SeasonDef[];
}

export type ItemKind = 'plot' | 'fence' | 'building' | 'decor';

export interface Footprint {
  cols: number;
  rows: number;
}

export interface CatalogCategory {
  id: string;
  name: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  kind: ItemKind;
  price: number;
  footprint: Footprint;
  /** Texture key the renderer uses for this item. */
  art: string;
  description: string;
  removable: boolean;
  /** False for "coming soon" entries that are shown but cannot be bought yet. */
  available: boolean;
  /** False for landmarks (like the cottage) that never appear in the market. */
  listed: boolean;
  /** 'edge' items (fences, hedges) stand on a tile's edge instead of filling it. */
  placement?: 'tile' | 'edge';
  /** Plots only: what can grow here (defaults to garden beds). */
  soil?: Soil;
  /** Player level needed to build it. */
  unlockLevel?: number;
  /** Most copies the farm may have. */
  maxCount?: number;
  /** Cosmetics earned from an achievement reward rather than bought outright. */
  rewardOnly?: boolean;
}

export interface CatalogData {
  categories: CatalogCategory[];
  items: CatalogItem[];
}

export interface GridRect {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export type LayoutEntry =
  | { itemId: string; col: number; row: number }
  | { itemId: string; area: GridRect }
  | { itemId: string; outline: GridRect; gaps?: Array<[col: number, row: number]> }
  | { itemId: string; around: GridRect; gaps?: Array<[col: number, row: number, side: EdgeSide]> };

/** A walkway in grid coordinates; tiles it crosses cannot be built on. */
export interface PathConfig {
  points: Array<[col: number, row: number]>;
  width: number;
}

export interface LandExpansion {
  /** Owned square side length after buying this expansion. */
  size: number;
  price: number;
  unlockLevel: number;
}

export interface FarmConfig {
  startingMoney: number;
  /** The whole buildable grid; only the owned square (see land) can be used. */
  world: { columns: number; rows: number };
  land: { startSize: number; expansions: LandExpansion[] };
  paths: PathConfig[];
  starterLayout: LayoutEntry[];
  refundRatio: number;
  /** Growth speed multiplier for a watered crop. */
  waterBoost: number;
  autosaveIntervalSec: number;
  dayLengthSec: number;
  maxOfflineHours: number;
}

export interface GameConfig {
  crops: CropDef[];
  seasons: SeasonsConfig;
  catalog: CatalogData;
  farm: FarmConfig;
  items: ItemsData;
  recipes: RecipesData;
  buildings: BuildingsData;
  animals: AnimalsData;
  fishing: FishingData;
  orders: OrdersData;
  achievements: AchievementsData;
  progression: ProgressionData;
  mining: MiningData;
  exploration: ExplorationData;
}

/** Side of a cell an edge item stands on: its north (top-right) or west (top-left) edge. */
export type EdgeSide = 'n' | 'w';

export interface PlacedObject {
  id: number;
  itemId: string;
  col: number;
  row: number;
  /** Edge items only: the cell side they stand on. */
  edge?: EdgeSide;
  /** Turned a quarter: the footprint swaps columns and rows and the art is mirrored. */
  rotated?: boolean;
}

export interface PlotCrop {
  cropId: string | null;
  /** 0 when planted (or just harvested, for regrowing crops), 1 when ready to harvest. */
  growth: number;
  /** Watered crops grow faster until their next harvest. */
  watered: boolean;
  /** True once a regrowing crop has been harvested at least once. */
  matured: boolean;
}

export interface ProductionJob {
  recipeId: string;
  /** Game time the job begins (jobs run one after another). */
  startsAt: number;
  endsAt: number;
}

export interface AnimalState {
  animalId: string;
  /** Happiness at the last feed or collection; it falls while idle. */
  happiness: number;
  /** Game time production finishes; null while waiting to be fed. */
  readyAt: number | null;
  /** Game time the animal last became hungry. */
  idleSince: number;
}

export interface BuildingState {
  level: number;
  /** Game time construction finishes. */
  readyAt: number;
  queue: ProductionJob[];
  animals: AnimalState[];
}

export interface FishingCast {
  spotId: string;
  baitId: string | null;
  /** Decided when casting, so reloading or re-clicking can never change the catch. */
  fishId: string;
  castAt: number;
  biteAt: number;
  reactionSec: number;
}

export interface FishRecord {
  caught: number;
  firstCaughtAt: number;
}

export interface FishingState {
  rodId: string;
  /** Boat owned for sailing to far spots; null until one is bought. */
  boatId: string | null;
  xp: number;
  journal: Record<string, FishRecord>;
  cast: FishingCast | null;
}

export type OrderStatus = 'available' | 'active' | 'completed' | 'expired';

export interface Order {
  id: number;
  customer: string;
  category: string;
  difficulty: string;
  items: Quantities;
  coins: number;
  xp: number;
  reputation: number;
  status: OrderStatus;
  createdAt: number;
  /** Seconds allowed once accepted. */
  durationSec: number;
  acceptedAt: number | null;
  closedAt: number | null;
  /** Deliver within this many seconds of accepting for the bonus. */
  bonusWithinSec: number;
  bonusCoins: number;
  bonusEarned: boolean;
  daily: boolean;
}

export interface OrdersState {
  nextId: number;
  offers: Order[];
  /** Game times when empty board slots refill. */
  refills: number[];
  active: Order[];
  history: Order[];
  reputation: number;
  daily: Order | null;
  /** Game day the current daily contract belongs to (0 = none yet). */
  dailyDay: number;
}

export interface AchievementState {
  completedAt: number;
  claimed: boolean;
}

export interface MineNodeState {
  /** Strikes left before it breaks. */
  hp: number;
  /** Game time a broken deposit grows back; 0 while standing. */
  respawnAt: number;
}

export interface MiningState {
  pickaxeId: string;
  /** Only deposits that were struck are stored; the rest are fresh. */
  nodes: Record<string, MineNodeState>;
}

export interface ExplorationState {
  /** Discovery ids already found, claimed or cleared. */
  found: string[];
}

export interface FarmState {
  money: number;
  time: number;
  inventory: Record<string, number>;
  nextObjectId: number;
  objects: PlacedObject[];
  /** Crop state per garden-bed or orchard object, keyed by object id. */
  plots: Record<string, PlotCrop>;
  xp: number;
  level: number;
  landSize: number;
  storageLevel: number;
  /** Lifetime counters that drive achievements. */
  stats: Record<string, number>;
  /** Production and housing state per building object, keyed by object id. */
  buildings: Record<string, BuildingState>;
  fishing: FishingState;
  orders: OrdersState;
  achievements: Record<string, AchievementState>;
  /** Catalog items unlocked by rewards. */
  unlocks: string[];
  mining: MiningState;
  exploration: ExplorationState;
}
