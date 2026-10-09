import catalogJson from '@data/catalog.json';
import cropsJson from '@data/crops.json';
import farmJson from '@data/farm.json';
import seasonsJson from '@data/seasons.json';
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
});
