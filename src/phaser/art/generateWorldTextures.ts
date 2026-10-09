import type * as Phaser from 'phaser';
import type { CropDef } from '@core/entities/types';
import type { IsoGrid } from '../iso/IsoGrid';
import { COTTAGE_ART } from '../world/itemArt';
import { generateBedTextures } from './BedArtist';
import { generateBuildingTextures } from './BuildingArtist';
import { generateCaveTextures } from './CaveArtist';
import { generateCropTextures } from './CropArtist';
import { generateExtraTextures } from './ExtraArtist';
import { generateFenceTextures } from './FenceArtist';
import { generateHarborTextures } from './HarborArtist';
import { generateHouseTexture } from './HouseArtist';
import { generatePropTextures } from './PropArtist';
import { generateWaterfallTextures } from './WaterfallArtist';
import { generateWildTextures } from './WildArtist';

export function generateWorldTextures(scene: Phaser.Scene, grid: IsoGrid, crops: CropDef[]): void {
  generateBedTextures(scene, grid);
  generateFenceTextures(scene, grid);
  generatePropTextures(scene, grid);
  generateHouseTexture(scene, grid, COTTAGE_ART);
  generateBuildingTextures(scene, grid);
  generateExtraTextures(scene, grid);
  generateCropTextures(scene, crops, grid);
  generateCaveTextures(scene);
  generateWaterfallTextures(scene);
  generateHarborTextures(scene);
  generateWildTextures(scene);
}
