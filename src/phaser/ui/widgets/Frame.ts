import type * as Phaser from 'phaser';
import { FRAME_SLICE, frameKey, type FrameName } from '../uiTextures';
import { UI_PX } from '../uiTheme';

// Nine-slice frame sized in screen px; it is built in art px and upscaled for crisp borders.
export function createFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  frame: FrameName,
): Phaser.GameObjects.NineSlice {
  return scene.add
    .nineslice(
      x,
      y,
      frameKey(frame),
      undefined,
      Math.round(width / UI_PX),
      Math.round(height / UI_PX),
      FRAME_SLICE,
      FRAME_SLICE,
      FRAME_SLICE,
      FRAME_SLICE,
    )
    .setOrigin(0)
    .setScale(UI_PX);
}

export const setFrame = (target: Phaser.GameObjects.NineSlice, frame: FrameName) =>
  target.setTexture(frameKey(frame));
