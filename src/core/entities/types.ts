export interface CropVisual {
  kind: string;
  leaf: string;
  produce: string;
}

export interface CropDef {
  id: string;
  name: string;
  visual: CropVisual;
  seedCost: number;
  sellPrice: number;
  growthTimeSec: number;
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

export type ItemKind = 'plot' | 'fence' | 'building' | 'decor' | 'animal';

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
  | { itemId: string; outline: GridRect; gaps?: Array<[col: number, row: number]> };

/** A walkway in grid coordinates; tiles it crosses cannot be built on. */
export interface PathConfig {
  points: Array<[col: number, row: number]>;
  width: number;
}

export interface FarmConfig {
  startingMoney: number;
  world: { columns: number; rows: number };
  paths: PathConfig[];
  starterLayout: LayoutEntry[];
  refundRatio: number;
  autosaveIntervalSec: number;
  dayLengthSec: number;
  maxOfflineHours: number;
}

export interface GameConfig {
  crops: CropDef[];
  seasons: SeasonsConfig;
  catalog: CatalogData;
  farm: FarmConfig;
}

export interface PlacedObject {
  id: number;
  itemId: string;
  col: number;
  row: number;
}

export interface PlotCrop {
  cropId: string | null;
  /** 0 when planted, 1 when ready to harvest. */
  growth: number;
}

export interface FarmState {
  money: number;
  time: number;
  inventory: Record<string, number>;
  nextObjectId: number;
  objects: PlacedObject[];
  /** Crop state per garden-bed object, keyed by object id. */
  plots: Record<string, PlotCrop>;
}
