import type * as Phaser from 'phaser';
import { PixelBuffer } from './PixelBuffer';
import { FRESH } from './TerrainArtist';

export const WATERFALL_FRAMES = 3;
export const WATERFALL_SIZE = { width: 26, height: 100 } as const;
export const FOAM_SIZE = { width: 48, height: 14 } as const;

export const waterfallKey = (frame: number) => `waterfall-${frame}`;
export const waterfallFoamKey = (frame: number) => `waterfall-foam-${frame}`;

const WHITE = 0xf4fbff;
const STREAK_GAP = 7;

// Falling water as a few frames of streaks that slide down a column each frame.
export function generateWaterfallTextures(scene: Phaser.Scene): void {
  for (let frame = 0; frame < WATERFALL_FRAMES; frame++) {
    const fall = new PixelBuffer(WATERFALL_SIZE.width, WATERFALL_SIZE.height);
    const { width, height } = WATERFALL_SIZE;
    for (let y = 0; y < height; y++) {
      // The sheet narrows slightly near the lip and widens as it falls.
      const inset = Math.max(0, 4 - Math.floor(y / 6));
      for (let x = inset; x < width - inset; x++) {
        const edge = x === inset || x === width - inset - 1;
        const streak = (y + frame * 3 + ((x * 5) % STREAK_GAP)) % STREAK_GAP === 0;
        const color = edge
          ? FRESH.deep
          : streak
            ? WHITE
            : x % 4 === 1
              ? FRESH.light
              : FRESH.shallow;
        fall.set(x, y, color);
      }
    }
    fall.toTexture(scene, waterfallKey(frame));

    const foam = new PixelBuffer(FOAM_SIZE.width, FOAM_SIZE.height);
    for (let y = 0; y < FOAM_SIZE.height; y++) {
      for (let x = 0; x < FOAM_SIZE.width; x++) {
        const dx = (x - FOAM_SIZE.width / 2) / (FOAM_SIZE.width / 2);
        const dy = (y - FOAM_SIZE.height / 2) / (FOAM_SIZE.height / 2);
        const d = dx * dx + dy * dy;
        const churn = ((x * 7 + y * 3 + frame * 5) % 6) / 6;
        if (d > 1 || churn < d * 0.8) continue;
        foam.set(x, y, churn > 0.6 ? WHITE : FRESH.shallow);
      }
    }
    foam.toTexture(scene, waterfallFoamKey(frame));
  }
}
