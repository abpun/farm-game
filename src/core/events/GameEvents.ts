import type { PlacedObject } from '../entities/types';

export interface GameEvents {
  MoneyChanged: { balance: number; delta: number };
  InventoryChanged: { cropId: string; count: number };
  PlotUpdated: { plotId: number };
  CropPlanted: { plotId: number; cropId: string };
  CropHarvested: { plotId: number; cropId: string; amount: number };
  CropSold: { cropId: string; amount: number; revenue: number };
  ObjectPlaced: { object: PlacedObject };
  ObjectRemoved: { object: PlacedObject };
  SeasonChanged: { seasonId: string };
  GameSaved: { savedAt: number };
}
