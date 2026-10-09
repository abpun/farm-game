import type * as Phaser from 'phaser';
import { PixelBuffer } from './PixelBuffer';
import { seasonalKey } from './seasonLooks';
import { bayer } from './terrain/noise';

const SKY_WIDTH = 8;
const BANDS = 6;

// Top-to-horizon colour stops per season; dithered between, never smoothly blended.
const SKIES: Record<string, number[]> = {
  spring: [0x5fa8d8, 0x7cbce2, 0x9ccfe8, 0xbde0ee, 0xd8ecf0, 0xeef6f2],
  summer: [0x4f9ad6, 0x68b0e0, 0x88c6e8, 0xaad8ee, 0xcce8f0, 0xe8f4f0],
  autumn: [0x6a9ac8, 0x86aed2, 0xa4c2d8, 0xc6d4d8, 0xe2dccc, 0xf2e2c4],
  winter: [0x8aa4c0, 0x9ab4cc, 0xaec4d6, 0xc2d2e0, 0xd8e2ea, 0xeef2f6],
};

export const skyKey = (seasonId: string) => seasonalKey('sky', seasonId);

/** A narrow gradient strip; the scene stretches it sideways (columns stay crisp). */
export function bakeSky(scene: Phaser.Scene, seasonId: string, heightArt: number): string {
  const key = skyKey(seasonId);
  if (scene.textures.exists(key)) return key;
  const stops = SKIES[seasonId] ?? SKIES.autumn ?? [];
  const buffer = new PixelBuffer(SKY_WIDTH, heightArt);
  for (let py = 0; py < heightArt; py++) {
    const t = (py / heightArt) * (BANDS - 1);
    const band = Math.floor(t);
    const color = bayer(0, py) < t - band ? stops[band + 1] : stops[band];
    for (let px = 0; px < SKY_WIDTH; px++) {
      const dithered = bayer(px, py) < t - band ? stops[band + 1] : stops[band];
      buffer.set(px, py, dithered ?? color ?? 0xffffff);
    }
  }
  buffer.toTexture(scene, key);
  return key;
}
