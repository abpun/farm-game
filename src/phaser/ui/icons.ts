import type * as Phaser from 'phaser';

/** An image scaled to fit in `size` px, shrinking or growing as needed. */
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
  return image.setScale(size / largest);
}
