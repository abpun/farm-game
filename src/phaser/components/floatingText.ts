import type * as Phaser from 'phaser';
import { textStyle } from '../theme';

const RISE_PX = 48;
const DURATION_MS = 900;
const FLOAT_DEPTH = 20000;

export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  color: string,
) {
  const text = scene.add
    .text(x, y, message, textStyle(22, color))
    .setOrigin(0.5)
    .setDepth(FLOAT_DEPTH);
  scene.tweens.add({
    targets: text,
    y: y - RISE_PX,
    alpha: 0,
    duration: DURATION_MS,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  });
}
