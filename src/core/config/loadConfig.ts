import achievementsJson from '@data/achievements.json';
import animalsJson from '@data/animals.json';
import buildingsJson from '@data/buildings.json';
import catalogJson from '@data/catalog.json';
import cropsJson from '@data/crops.json';
import explorationJson from '@data/exploration.json';
import farmJson from '@data/farm.json';
import fishingJson from '@data/fishing.json';
import itemsJson from '@data/items.json';
import miningJson from '@data/mining.json';
import ordersJson from '@data/orders.json';
import progressionJson from '@data/progression.json';
import recipesJson from '@data/recipes.json';
import seasonsJson from '@data/seasons.json';
import type {
  AchievementsData,
  AnimalsData,
  BuildingsData,
  ExplorationData,
  FishingData,
  ItemsData,
  MiningData,
  OrdersData,
  ProgressionData,
  RecipesData,
} from '../entities/content';
import type {
  CatalogData,
  CropDef,
  FarmConfig,
  GameConfig,
  SeasonsConfig,
} from '../entities/types';

export const loadConfig = (): GameConfig => ({
  crops: cropsJson.crops as CropDef[],
  seasons: seasonsJson as SeasonsConfig,
  catalog: catalogJson as CatalogData,
  farm: farmJson as FarmConfig,
  items: itemsJson as ItemsData,
  recipes: recipesJson as unknown as RecipesData,
  buildings: buildingsJson as BuildingsData,
  animals: animalsJson as AnimalsData,
  fishing: fishingJson as FishingData,
  orders: ordersJson as OrdersData,
  achievements: achievementsJson as AchievementsData,
  progression: progressionJson as ProgressionData,
  mining: miningJson as MiningData,
  exploration: explorationJson as unknown as ExplorationData,
});
