import * as Phaser from 'phaser';
import { generateWorldTextures } from '../art/generateWorldTextures';
import { loadTerrainSheets } from '../art/TerrainSheet';
import { createFarmGrid } from '../iso/createFarmGrid';
import { getSession } from '../session';
import { generateItemIcons } from '../ui/itemIcons';
import { generateUiTextures } from '../ui/uiTextures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    loadTerrainSheets(this);
  }

  create(): void {
    const session = getSession(this);
    generateWorldTextures(this, createFarmGrid(session), session.crops.all());
    generateUiTextures(this);
    generateItemIcons(this, session.content);
    this.scene.start('Farm');
    this.scene.launch('UI');
  }
}
