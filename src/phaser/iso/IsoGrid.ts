import { ISO, PIXEL_SCALE } from '../layout';

export interface Point {
  x: number;
  y: number;
}

export type DiamondPoints = [number, number, number, number, number, number, number, number];

export interface ArtMetrics {
  tileW: number;
  tileH: number;
  soilDepth: number;
  islandDepth: number;
  cropHeadroom: number;
}

// Point inside a w×h diamond: u runs top→right edge, v runs top→left edge, both 0..1.
export const diamondPoint = (u: number, v: number, w: number, h: number): Point => ({
  x: w / 2 + ((u - v) * w) / 2,
  y: ((u + v) * h) / 2,
});

export const diamondOutline = (w: number, h: number): DiamondPoints => insetDiamond(w, h, 1);

export const insetDiamond = (w: number, h: number, scale: number): DiamondPoints => {
  const [cx, cy, rx, ry] = [w / 2, h / 2, (w / 2) * scale, (h / 2) * scale];
  return [cx, cy - ry, cx + rx, cy, cx, cy + ry, cx - rx, cy];
};

const toArtPixels = (value: number) => Math.round(value / PIXEL_SCALE) * PIXEL_SCALE;

export class IsoGrid {
  readonly tileW: number;
  readonly tileH: number;
  readonly soilDepth: number;
  readonly islandDepth: number;
  readonly cropHeadroom: number;
  readonly art: ArtMetrics;
  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {
    const unit = 4 * PIXEL_SCALE;
    if (ISO.tileWidth % unit !== 0) throw new Error(`ISO.tileWidth must be a multiple of ${unit}`);
    this.tileW = ISO.tileWidth;
    this.tileH = this.tileW / 2;
    this.soilDepth = toArtPixels(this.tileW * ISO.soilDepthRatio);
    this.islandDepth = toArtPixels(this.tileW * ISO.islandDepthRatio);
    this.cropHeadroom = toArtPixels(this.tileW * ISO.cropHeadroomRatio);
    this.art = {
      tileW: this.tileW / PIXEL_SCALE,
      tileH: this.tileH / PIXEL_SCALE,
      soilDepth: this.soilDepth / PIXEL_SCALE,
      islandDepth: this.islandDepth / PIXEL_SCALE,
      cropHeadroom: this.cropHeadroom / PIXEL_SCALE,
    };
  }

  // World-space position of a grid point; grid (0,0) sits at the world origin.
  toScreen(col: number, row: number): Point {
    return {
      x: Math.round(((col - row) * this.tileW) / 2),
      y: Math.round(((col + row) * this.tileH) / 2),
    };
  }

  // Axis-aligned world rectangle around the grid plus `margin` tiles on every side.
  extent(margin: number): { x: number; y: number; width: number; height: number } {
    const top = this.toScreen(-margin, -margin);
    const right = this.toScreen(this.columns + margin, -margin);
    const bottom = this.toScreen(this.columns + margin, this.rows + margin);
    const left = this.toScreen(-margin, this.rows + margin);
    return {
      x: left.x,
      y: top.y,
      width: right.x - left.x,
      height: bottom.y - top.y + this.islandDepth,
    };
  }

  tileTop(col: number, row: number): Point {
    return this.toScreen(col, row);
  }

  tileCenter(col: number, row: number): Point {
    return this.toScreen(col + 0.5, row + 0.5);
  }

  // Inverse of toScreen: fractional grid coordinates under a world-space point.
  toGrid(x: number, y: number): { col: number; row: number } {
    const a = x / (this.tileW / 2);
    const b = y / (this.tileH / 2);
    return { col: (a + b) / 2, row: (b - a) / 2 };
  }

  cellAt(x: number, y: number): { col: number; row: number } {
    const { col, row } = this.toGrid(x, y);
    return { col: Math.floor(col), row: Math.floor(row) };
  }

  /** Draw order for something whose footprint centre is at (col, row): further front = higher. */
  depthOf(col: number, row: number): number {
    return (col + row) * 10;
  }
}
