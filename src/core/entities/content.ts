// Data-driven definitions for everything beyond crops and placeable catalog items.

export type ItemCategory = 'crop' | 'fruit' | 'fish' | 'animal' | 'goods' | 'supply';

/** Pixel icon recipe: a named shape from the renderer plus up to four hex colours. */
export interface ItemIcon {
  shape: string;
  colors: string[];
}

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  /** Coins per unit when sold; 0 means the item cannot be sold. */
  sellPrice: number;
  /** Market price per unit; omitted when the market does not stock it. */
  buyPrice?: number;
  /** Player level needed before the market sells it. */
  unlockLevel?: number;
  /** Crops draw their own icon, so only non-crop items need one. */
  icon?: ItemIcon;
}

export interface ItemsData {
  items: ItemDef[];
}

export type Quantities = Record<string, number>;

export interface RecipeDef {
  id: string;
  building: string;
  inputs: Quantities;
  outputs: Quantities;
  durationSec: number;
  unlockLevel: number;
  xp: number;
}

export interface RecipesData {
  recipes: RecipeDef[];
}

export interface BuildingLevel {
  /** Coins to upgrade into this level; level 1 is paid for by the catalog price. */
  cost: number;
  unlockLevel: number;
  /** Production queue length (production buildings). */
  slots?: number;
  /** Animals housed (animal housing). */
  capacity?: number;
  /** Production speed multiplier. */
  speed: number;
}

export type BuildingRole = 'production' | 'housing';

export interface BuildingDef {
  /** Matches the catalog item id that places this building. */
  id: string;
  role: BuildingRole;
  /** Housing only: the animal kept here. */
  animal?: string;
  buildSec: number;
  xp: number;
  levels: BuildingLevel[];
}

export interface StorageLevel {
  capacity: number;
  cost: number;
  unlockLevel: number;
}

export interface BuildingsData {
  storage: StorageLevel[];
  buildings: BuildingDef[];
}

export interface AnimalDef {
  id: string;
  name: string;
  housing: string;
  price: number;
  unlockLevel: number;
  feed: string;
  feedAmount: number;
  product: string;
  produceSec: number;
  xp: number;
}

export interface HappinessRules {
  start: number;
  max: number;
  feedGain: number;
  /** Happiness lost per game day while an animal waits to be fed or collected. */
  idleLossPerDay: number;
  /** At or above this an animal counts as productive. */
  productiveMin: number;
  /** Bonus product chance grows from 0 at this happiness to bonusChanceMax at max. */
  bonusFrom: number;
  bonusChanceMax: number;
}

export interface AnimalsData {
  happiness: HappinessRules;
  animals: AnimalDef[];
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface RarityDef {
  id: Rarity;
  name: string;
  weight: number;
  /** Seconds the player has to reel in after a bite. */
  reactionSec: number;
  xp: number;
}

export interface FishDef {
  id: string;
  name: string;
  rarity: Rarity;
  sellPrice: number;
  fishingLevel: number;
  spots: string[];
  icon: ItemIcon;
}

export interface RodDef {
  id: string;
  name: string;
  price: number;
  fishingLevel: number;
  reactionBonusSec: number;
  /** Multiplies the odds of uncommon and rarer fish. */
  luck: number;
}

export interface BaitDef {
  item: string;
  luck: number;
  /** Multiplies the wait for a bite (below 1 is faster). */
  biteSpeed: number;
  fishingLevel: number;
}

export interface SpotDef {
  id: string;
  name: string;
  unlockLevel: number;
  description: string;
}

export interface FishingData {
  biteDelaySec: { min: number; max: number };
  /** Fishing XP needed for each fishing level, starting with level 1 at 0. */
  levels: number[];
  rarities: RarityDef[];
  spots: SpotDef[];
  rods: RodDef[];
  baits: BaitDef[];
  fish: FishDef[];
}

export interface OrderCategoryDef {
  id: string;
  name: string;
  itemCategories: ItemCategory[];
  unlockLevel: number;
}

export interface OrderDifficultyDef {
  id: string;
  name: string;
  unlockLevel: number;
  /** Distinct items requested, as [min, max]. */
  items: [number, number];
  /** Sell value of the requested goods at level 1, as [min, max]. */
  value: [number, number];
  /** Extra value fraction per player level above 1. */
  valuePerLevel: number;
  rewardMultiplier: number;
  xpPerCoin: number;
  deadlineDays: number;
  reputation: number;
}

export interface OrdersData {
  boardSlots: Array<{ reputation: number; slots: number }>;
  maxActive: number;
  refreshCooldownSec: number;
  historySize: number;
  maxQuantity: number;
  bonus: { withinFraction: number; coinsFraction: number; reputation: number };
  daily: { unlockLevel: number; difficulty: string; rewardMultiplier: number; reputation: number };
  categories: OrderCategoryDef[];
  difficulties: OrderDifficultyDef[];
  customers: string[];
}

export interface Reward {
  coins?: number;
  xp?: number;
  items?: Quantities;
  /** Catalog items (cosmetics) this reward makes available. */
  unlocks?: string[];
}

export interface AchievementCategoryDef {
  id: string;
  name: string;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: string;
  stat: string;
  target: number;
  reward: Reward;
}

export interface AchievementsData {
  categories: AchievementCategoryDef[];
  achievements: AchievementDef[];
}

export interface LevelDef {
  /** Total XP needed to reach this level. */
  xp: number;
  /** Coins granted on reaching it. */
  coins: number;
}

export interface ProgressionData {
  levels: LevelDef[];
}
