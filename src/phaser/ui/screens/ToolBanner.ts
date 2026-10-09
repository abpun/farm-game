import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { GAME_HEIGHT, HUD, TOAST_ANCHOR } from '../../layout';
import type { Tool, ToolState } from '../../tools';
import { formatMoney } from '../format';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, uiTextOnWood } from '../uiTheme';
import { Button } from '../widgets/Button';
import { createFrame } from '../widgets/Frame';

const HEIGHT = HUD.height;
const PADDING = UI_PX * 6;
const BANNER_DEPTH = 800;

// Bottom-centre plaque describing the active tool, with a button to put it away.
export class ToolBanner {
  private container: Phaser.GameObjects.Container | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    tools: ToolState,
  ) {
    tools.bus.on('ToolChanged', ({ tool }) => this.show(tool, () => tools.clear()));
  }

  private show(tool: Tool, onDone: () => void): void {
    this.container?.destroy();
    this.container = null;
    const message = this.describe(tool);
    if (!message) return;

    const scene = this.scene;
    const text = scene.add
      .text(PADDING, HEIGHT / 2, message, uiTextOnWood(FONT_SIZE.body))
      .setOrigin(0, 0.5);
    const buttonSize = HEIGHT - UI_PX * 4;
    const width = Math.ceil((PADDING * 2 + text.width + buttonSize + UI_PX * 4) / UI_PX) * UI_PX;
    const done = new Button(scene, width - buttonSize - UI_PX * 2, UI_PX * 2, {
      width: buttonSize,
      height: buttonSize,
      icon: iconKey('close'),
      iconSize: UI_PX * 8,
      align: 'center',
      onClick: onDone,
    });
    const x = Math.round((TOAST_ANCHOR.x - width / 2) / UI_PX) * UI_PX;
    const y = GAME_HEIGHT - HUD.margin - HEIGHT;
    this.container = scene.add
      .container(x, y, [createFrame(scene, 0, 0, width, HEIGHT, 'plaque'), text, done])
      .setDepth(BANNER_DEPTH);
  }

  private describe(tool: Tool): string | null {
    const { crops, catalog } = this.session;
    switch (tool.kind) {
      case 'plant':
        return `Planting ${crops.get(tool.cropId).name} · tap empty beds`;
      case 'build': {
        const item = catalog.get(tool.itemId);
        return `Placing ${item.name} ($${formatMoney(item.price)}) · tap tiles`;
      }
      case 'remove':
        return 'Remove mode · tap something to remove it';
      default:
        return null;
    }
  }
}
