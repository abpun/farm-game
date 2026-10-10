import type { DiscoveryKind, Quantities } from '../entities/content';
import type { Order, PlacedObject } from '../entities/types';

export type MoneySource = 'sale' | 'order' | 'reward' | 'refund' | 'spend';

export interface GameEvents {
  MoneyChanged: { balance: number; delta: number; source: MoneySource };
  InventoryChanged: { itemId: string; count: number };
  PlotUpdated: { plotId: number };
  CropPlanted: { plotId: number; cropId: string };
  CropWatered: { plotId: number };
  CropHarvested: { plotId: number; cropId: string; amount: number; xp: number };
  ItemSold: { itemId: string; amount: number; revenue: number };
  ItemBought: { itemId: string; amount: number; cost: number };
  ObjectPlaced: { object: PlacedObject };
  ObjectRemoved: { object: PlacedObject };
  SeasonChanged: { seasonId: string };
  DayChanged: { day: number };
  GameSaved: { savedAt: number };
  SaveFailed: Record<string, never>;
  XpGained: { amount: number; xp: number };
  LevelUp: { level: number; coins: number };
  LandExpanded: { size: number };
  StorageUpgraded: { capacity: number };
  BuildingCompleted: { objectId: number };
  BuildingUpgraded: { objectId: number; level: number };
  ProductionStarted: { objectId: number; recipeId: string };
  ProductionReady: { objectId: number; recipeId: string };
  ProductionCollected: { objectId: number; items: Quantities; batches: number };
  AnimalBought: { objectId: number; animalId: string };
  AnimalsFed: { objectId: number; count: number };
  AnimalProductsCollected: { objectId: number; itemId: string; amount: number };
  FishingCast: { spotId: string };
  FishBite: { spotId: string };
  FishCaught: { fishId: string; firstCatch: boolean; spotId: string };
  BoatUpgraded: { boatId: string };
  FishEscaped: { reason: 'early' | 'late' };
  RodUpgraded: { rodId: string };
  OrdersChanged: Record<string, never>;
  OrderCompleted: { order: Order };
  OrderExpired: { order: Order };
  AchievementCompleted: { id: string };
  AchievementClaimed: { id: string };
  DepositStruck: { nodeId: string; hp: number };
  DepositMined: { nodeId: string; depositId: string; items: Quantities };
  PickaxeUpgraded: { pickaxeId: string };
  DiscoveryFound: { id: string; kind: DiscoveryKind };
}
