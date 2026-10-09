import type * as Phaser from 'phaser';
import { FONT_SIZE, UI_PX, UI_TEXT, uiTextOnWood } from '../uiTheme';
import { createFrame } from './Frame';

export interface ToastOptions {
  icon?: string;
  color?: string;
}

const HEIGHT = UI_PX * 15;
const PADDING = UI_PX * 5;
const GAP = UI_PX * 2;
const MAX_VISIBLE = 4;
const SHOW_MS = 2600;
const SLIDE_MS = 180;
const TOAST_DEPTH = 900;

// Stack of short-lived plaques centred under `anchor`; newest on top.
export class ToastManager {
  private readonly toasts: Phaser.GameObjects.Container[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly anchor: { x: number; y: number },
  ) {}

  show(message: string, options: ToastOptions = {}): void {
    const scene = this.scene;
    const toast = scene.add.container(0, 0).setDepth(TOAST_DEPTH).setAlpha(0);
    const text = scene.add.text(
      0,
      HEIGHT / 2,
      message,
      uiTextOnWood(FONT_SIZE.body, options.color ?? UI_TEXT.light),
    );
    text.setOrigin(0, 0.5);
    let cursor = PADDING;
    if (options.icon) {
      const icon = scene.add.image(cursor, HEIGHT / 2, options.icon).setOrigin(0, 0.5);
      icon.setScale(Math.max(1, Math.floor((HEIGHT - UI_PX * 6) / icon.height)));
      cursor += icon.displayWidth + UI_PX * 2;
      toast.add(icon);
    }
    text.setX(cursor);
    const width = Math.ceil((cursor + text.width + PADDING) / UI_PX) * UI_PX;
    toast.addAt(createFrame(scene, 0, 0, width, HEIGHT, 'plaque'), 0);
    toast.add(text);
    toast.setX(Math.round((this.anchor.x - width / 2) / UI_PX) * UI_PX);

    this.toasts.unshift(toast);
    while (this.toasts.length > MAX_VISIBLE) this.toasts.pop()?.destroy();
    this.layout();
    scene.tweens.add({ targets: toast, alpha: 1, duration: SLIDE_MS });
    scene.time.delayedCall(SHOW_MS, () => this.dismiss(toast));
  }

  private dismiss(toast: Phaser.GameObjects.Container): void {
    if (!toast.active) return;
    this.scene.tweens.add({
      targets: toast,
      alpha: 0,
      duration: SLIDE_MS,
      onComplete: () => {
        const index = this.toasts.indexOf(toast);
        if (index >= 0) this.toasts.splice(index, 1);
        toast.destroy();
        this.layout();
      },
    });
  }

  private layout(): void {
    this.toasts.forEach((toast, index) => {
      const y = this.anchor.y + index * (HEIGHT + GAP);
      this.scene.tweens.add({ targets: toast, y, duration: SLIDE_MS, ease: 'Quad.easeOut' });
    });
  }
}
