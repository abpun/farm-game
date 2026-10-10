import type * as Phaser from 'phaser';
import { bake, SHADOW } from './paint';
import { PixelBuffer } from './PixelBuffer';
import { FRESH, ROCK } from './terrain/colors';

export const WATERFALL_FRAMES = 3;
export const WATERFALL_SIZE = { width: 26, height: 46 } as const;
export const WATERFALL_CLIFF = 'waterfall-cliff';
const CLIFF_SIZE = { width: 84, height: 58 } as const;
export const FOAM_SIZE = { width: 48, height: 14 } as const;

export const waterfallKey = (frame: number) => `waterfall-${frame}`;
export const waterfallFoamKey = (frame: number) => `waterfall-foam-${frame}`;

const WHITE = 0xf4fbff;
const STREAK_GAP = 7;
const MOSS = 0x4f8a3a;

// Falling water as a few frames of streaks that slide down a column each frame.
export function generateWaterfallTextures(scene: Phaser.Scene): void {
  bake(scene, WATERFALL_CLIFF, CLIFF_SIZE.width, CLIFF_SIZE.height, drawCliff);
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

// A mossy stone ledge the stream spills over, heaped from boulders lit from the upper left.
function drawCliff(g: Phaser.GameObjects.Graphics): void {
  const { width, height } = CLIFF_SIZE;
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(width / 2, height - 5, width - 4, 12);
  const boulders: Array<[number, number, number, number]> = [
    [42, 22, 50, 36],
    [18, 34, 32, 34],
    [66, 34, 32, 34],
    [12, 48, 22, 18],
    [72, 48, 22, 18],
  ];
  for (const [x, y, w, h] of boulders) {
    g.fillStyle(ROCK.deep).fillEllipse(x, y, w, h);
    g.fillStyle(ROCK.dark).fillEllipse(x - 1, y - 1, w - 4, h - 4);
    g.fillStyle(ROCK.base).fillEllipse(x - 4, y - 4, w * 0.6, h * 0.55);
    g.fillStyle(ROCK.light).fillEllipse(x - 7, y - 7, w * 0.25, h * 0.2);
  }
  // Moss along the lip and a dark notch where the water pours out.
  g.fillStyle(MOSS).fillEllipse(30, 7, 22, 6).fillEllipse(56, 8, 18, 5);
  g.fillStyle(ROCK.deep).fillRect(width / 2 - 13, 6, 26, 6);
}
