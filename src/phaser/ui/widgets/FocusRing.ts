import type * as Phaser from 'phaser';
import { UI_PX } from '../uiTheme';

export interface Focusable {
  target: Phaser.GameObjects.Container;
  activate?: () => void;
  /** Left/right arrows, e.g. to move a slider. */
  adjust?: (direction: -1 | 1) => void;
}

const RING_COLOR = 0xffd75e;
const RING_PAD = UI_PX * 2;
const NAV_KEYS = ['TAB', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER', 'SPACE'] as const;

// Keyboard navigation for a screen: Tab/arrows move a visible gold ring between controls,
// Enter/Space activate, Left/Right adjust. The ring appears only once a key is used.
export class FocusRing {
  private readonly ring: Phaser.GameObjects.Graphics;
  private index = 0;
  private shown = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly items: Focusable[],
    depth: number,
  ) {
    this.ring = scene.add.graphics().setDepth(depth).setVisible(false);
    const keyboard = scene.input.keyboard;
    keyboard?.addCapture(NAV_KEYS.join(','));
    keyboard?.on('keydown', this.onKey, this);
    scene.input.on('pointerdown', this.hide, this);
    scene.events.on('update', this.draw, this);
  }

  destroy(): void {
    const keyboard = this.scene.input.keyboard;
    keyboard?.removeCapture(NAV_KEYS.join(','));
    keyboard?.off('keydown', this.onKey, this);
    this.scene.input.off('pointerdown', this.hide, this);
    this.scene.events.off('update', this.draw, this);
    this.ring.destroy();
  }

  private onKey(event: KeyboardEvent): void {
    const item = this.items[this.index];
    if (!item) return;
    const wasShown = this.shown;
    this.shown = true;
    switch (event.key) {
      case 'Tab':
        this.move(event.shiftKey ? -1 : 1, wasShown);
        break;
      case 'ArrowDown':
        this.move(1, wasShown);
        break;
      case 'ArrowUp':
        this.move(-1, wasShown);
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (wasShown) item.adjust?.(event.key === 'ArrowLeft' ? -1 : 1);
        break;
      case 'Enter':
      case ' ':
        if (wasShown) item.activate?.();
        break;
    }
  }

  // The first key press only reveals the ring where it is.
  private move(step: number, wasShown: boolean): void {
    if (!wasShown) return;
    this.index = (this.index + step + this.items.length) % this.items.length;
  }

  private readonly hide = (): void => {
    this.shown = false;
  };

  private draw(): void {
    const target = this.items[this.index]?.target;
    this.ring.setVisible(this.shown && Boolean(target?.visible));
    if (!this.shown || !target) return;
    const bounds = target.getBounds();
    this.ring
      .clear()
      .lineStyle(UI_PX, RING_COLOR, 1)
      .strokeRect(
        bounds.x - RING_PAD,
        bounds.y - RING_PAD,
        bounds.width + RING_PAD * 2,
        bounds.height + RING_PAD * 2,
      );
  }
}
