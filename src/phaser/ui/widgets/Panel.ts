import * as Phaser from 'phaser';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, uiTextOnWood } from '../uiTheme';
import { Button } from './Button';
import { createFrame } from './Frame';

export const PANEL_INSET = UI_PX * 6;
const PLAQUE_HEIGHT = UI_PX * 14;
const PLAQUE_PADDING = UI_PX * 8;
const CLOSE_SIZE = UI_PX * 14;

export interface PanelOptions {
  title?: string;
  /** Adds a close button in the top-right corner. */
  onClose?: () => void;
}

// Parchment panel with an optional wooden title plaque; children go in `content`.
export class Panel extends Phaser.GameObjects.Container {
  readonly content: Phaser.GameObjects.Container;
  readonly innerWidth: number;
  readonly innerHeight: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly panelWidth: number,
    readonly panelHeight: number,
    options: PanelOptions = {},
  ) {
    super(scene, x, y);
    this.add(createFrame(scene, 0, 0, panelWidth, panelHeight, 'panel').setInteractive());

    const top = options.title ? PLAQUE_HEIGHT / 2 + PANEL_INSET : PANEL_INSET;
    if (options.title) this.addPlaque(options.title);
    this.innerWidth = panelWidth - PANEL_INSET * 2;
    this.innerHeight = panelHeight - top - PANEL_INSET;
    this.content = scene.add.container(PANEL_INSET, top);
    this.add(this.content);
    if (options.onClose) this.addCloseButton(options.onClose);
    scene.add.existing(this);
  }

  private addPlaque(title: string): void {
    const text = this.scene.add.text(0, 0, title, uiTextOnWood(FONT_SIZE.title)).setOrigin(0.5);
    const width = Math.ceil((text.width + PLAQUE_PADDING * 2) / UI_PX) * UI_PX;
    const x = Math.round((this.panelWidth - width) / 2 / UI_PX) * UI_PX;
    const plaque = createFrame(this.scene, x, -PLAQUE_HEIGHT / 2, width, PLAQUE_HEIGHT, 'plaque');
    text.setPosition(x + width / 2, 0);
    this.add([plaque, text]);
  }

  private addCloseButton(onClose: () => void): void {
    const close = new Button(this.scene, this.panelWidth - CLOSE_SIZE + UI_PX * 3, -UI_PX * 3, {
      width: CLOSE_SIZE,
      height: CLOSE_SIZE,
      icon: iconKey('close'),
      iconSize: UI_PX * 8,
      align: 'center',
      // Whatever closes plays its own close sound.
      sound: null,
      onClick: onClose,
    });
    this.add(close);
  }
}
