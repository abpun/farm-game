import type * as Phaser from 'phaser';

/** An image scaled by a whole factor so it fits in `size` px (pixel art stays crisp). */
export function iconImage(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  size: number,
  originX = 0.5,
  originY = 0.5,
): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, key).setOrigin(originX, originY);
  const largest = Math.max(image.width, image.height, 1);
  return image.setScale(Math.max(1, Math.floor(size / largest)));
}
