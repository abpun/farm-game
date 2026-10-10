import type * as Phaser from 'phaser';

// Writes straight into ImageData so every terrain pixel is deliberate (no vector anti-aliasing).
export class PixelBuffer {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  set(x: number, y: number, color: number, alpha = 255): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = (color >> 16) & 0xff;
    this.data[i + 1] = (color >> 8) & 0xff;
    this.data[i + 2] = color & 0xff;
    this.data[i + 3] = alpha;
  }

  toTexture(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const texture = scene.textures.createCanvas(key, this.width, this.height);
    if (!texture) throw new Error(`Could not create ${key}`);
    const ctx = texture.getContext();
    const image = ctx.createImageData(this.width, this.height);
    image.data.set(this.data);
    ctx.putImageData(image, 0, 0);
    texture.refresh();
  }
}
