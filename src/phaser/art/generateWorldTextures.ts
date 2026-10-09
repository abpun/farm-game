import type * as Phaser from 'phaser';
import type { CropDef } from '@core/entities/types';
import type { IsoGrid } from '../iso/IsoGrid';
import { COTTAGE_ART } from '../world/itemArt';
import { generateBedTextures } from './BedArtist';
import { generateCropTextures } from './CropArtist';
import { generateFenceTextures } from './FenceArtist';
import { generateHouseTexture } from './HouseArtist';
import { generatePropTextures } from './PropArtist';

export function generateWorldTextures(scene: Phaser.Scene, grid: IsoGrid, crops: CropDef[]): void {
  generateBedTextures(scene, grid);
  generateFenceTextures(scene, grid);
  generatePropTextures(scene, grid);
  generateHouseTexture(scene, grid, COTTAGE_ART);
  generateCropTextures(scene, crops, grid);
}
