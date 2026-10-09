import type * as Phaser from 'phaser';

const toCss = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export type MaskPalette = Record<string, number>;

// Integer-only canvas painter: every call lands on whole art pixels, so nothing anti-aliases.
export class PixelPainter {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  rect(x: number, y: number, w: number, h: number, color: number): this {
    this.ctx.fillStyle = toCss(color);
    this.ctx.fillRect(x, y, w, h);
    return this;
  }

  /** Draws rows of characters; '.' and ' ' are transparent, other chars map through the palette. */
  mask(rows: readonly string[], palette: MaskPalette, ox = 0, oy = 0): this {
    rows.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const color = palette[char];
        if (color !== undefined) this.rect(ox + x, oy + y, 1, 1, color);
      });
    });
    return this;
  }
}

export function paintTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (painter: PixelPainter) => void,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`Could not create canvas texture ${key}`);
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(new PixelPainter(ctx));
  texture.refresh();
}

export const maskSize = (rows: readonly string[]) => ({
  width: Math.max(...rows.map((row) => row.length)),
  height: rows.length,
});
