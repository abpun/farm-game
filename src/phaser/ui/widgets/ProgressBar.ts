import * as Phaser from 'phaser';
import { UI_COLORS, UI_PX } from '../uiTheme';

export const BAR_COLORS = {
  grow: 0x7cb342,
  xp: 0xf6c544,
  happy: 0xe0603a,
  water: 0x3b6fb6,
  full: 0xb8432a,
} as const;

// Pixel bar: dark outline, recessed track and a fill that snaps to whole UI pixels.
export class ProgressBar extends Phaser.GameObjects.Container {
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly trackWidth: number;
  private target = 0;
  private easing: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number = BAR_COLORS.grow,
  ) {
    super(scene, x, y);
    this.trackWidth = width - UI_PX * 2;
    const outline = scene.add.rectangle(0, 0, width, height, UI_COLORS.outline).setOrigin(0);
    const track = scene.add
      .rectangle(UI_PX, UI_PX, this.trackWidth, height - UI_PX * 2, UI_COLORS.woodDeep)
      .setOrigin(0);
    this.fill = scene.add.rectangle(UI_PX, UI_PX, 0, height - UI_PX * 2, color).setOrigin(0);
    this.add([outline, track, this.fill]);
    scene.add.existing(this);
  }

  setProgress(fraction: number): this {
    this.easing?.stop();
    this.easing = null;
    this.target = clamp(fraction);
    return this.draw(this.target);
  }

  /** Glides toward a new value when it grows; drops (e.g. a new level) snap at once. */
  easeTo(fraction: number, durationMs: number): this {
    const next = clamp(fraction);
    if (next === this.target) return this;
    if (next < this.target || durationMs <= 0) return this.setProgress(next);
    const from = this.target;
    this.target = next;
    this.easing?.stop();
    this.easing = this.scene.tweens.addCounter({
      from,
      to: next,
      duration: durationMs,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => this.draw(tween.getValue() ?? next),
    });
    return this;
  }

  private draw(fraction: number): this {
    const width = Math.round((this.trackWidth * fraction) / UI_PX) * UI_PX;
    this.fill.width = width;
    this.fill.setVisible(width > 0);
    return this;
  }

  setColor(color: number): this {
    this.fill.setFillStyle(color);
    return this;
  }
}

const clamp = (fraction: number) =>
  Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
