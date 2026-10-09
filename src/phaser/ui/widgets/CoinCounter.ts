import * as Phaser from 'phaser';
import { formatMoney } from '../format';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiTextOnWood } from '../uiTheme';
import { createFrame } from './Frame';

const COUNT_MS = 450;
const BUMP_SCALE = 1.15;
const BUMP_MS = 90;

// Wooden plaque with a coin icon whose number rolls toward the new value.
export class CoinCounter extends Phaser.GameObjects.Container {
  private readonly text: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image;
  private shown: number;
  private counter: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    value: number,
  ) {
    super(scene, x, y);
    this.shown = value;
    const iconSize = height - UI_PX * 6;
    this.icon = scene.add.image(UI_PX * 5 + iconSize / 2, height / 2, iconKey('coin'));
    this.icon.setScale(Math.floor(iconSize / this.icon.height));
    this.text = scene.add
      .text(
        UI_PX * 8 + iconSize,
        height / 2,
        formatMoney(value),
        uiTextOnWood(FONT_SIZE.big, UI_TEXT.gold),
      )
      .setOrigin(0, 0.5);
    this.add([createFrame(scene, 0, 0, width, height, 'plaque'), this.icon, this.text]);
    scene.add.existing(this);
  }

  setValue(value: number): void {
    this.counter?.stop();
    const from = this.shown;
    this.counter = this.scene.tweens.addCounter({
      from,
      to: value,
      duration: COUNT_MS,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => this.render(Math.round(tween.getValue() ?? value)),
      onComplete: () => this.render(value),
    });
    const baseScale = this.icon.scaleX;
    this.scene.tweens.add({
      targets: this.icon,
      scale: baseScale * BUMP_SCALE,
      duration: BUMP_MS,
      yoyo: true,
      onComplete: () => this.icon.setScale(baseScale),
    });
  }

  private render(value: number): void {
    this.shown = value;
    this.text.setText(formatMoney(value));
  }
}
