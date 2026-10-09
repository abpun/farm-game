import * as Phaser from 'phaser';
import { generateWorldTextures } from '../art/generateWorldTextures';
import { createFarmGrid } from '../iso/createFarmGrid';
import { getSession } from '../session';
import { generateUiTextures } from '../ui/uiTextures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const session = getSession(this);
    generateWorldTextures(this, createFarmGrid(session), session.crops.all());
    generateUiTextures(this);
    this.scene.start('Farm');
    this.scene.launch('UI');
  }
}
