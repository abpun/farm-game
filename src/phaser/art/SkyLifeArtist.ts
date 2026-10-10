import type * as Phaser from 'phaser';
import { PixelBuffer } from './PixelBuffer';
import { createNoise } from './terrain/noise';

export const CLOUD_VARIANTS = 4;
export const cloudKey = (variant: number) => `cloud-${variant}`;
export const birdKey = (kind: 'dark' | 'gull', frame: number) => `bird-${kind}-${frame}`;
export const GULL_PERCHED = 'bird-gull-perched';
export const FLOW_STREAK = 'water-streak';

const CLOUD = { light: 0xffffff, base: 0xf0f4f8, shade: 0xd2dce6, edge: 0xb8c6d4 };

// Puffy pixel clouds: overlapping lobes, flat-ish base, a cooler shade underneath.
export function generateSkyLifeTextures(scene: Phaser.Scene): void {
  for (let variant = 0; variant < CLOUD_VARIANTS; variant++) bakeCloud(scene, variant);
  const wings: Record<'dark' | 'gull', number> = { dark: 0x3a3434, gull: 0xf4f6f8 };
  for (const kind of ['dark', 'gull'] as const) {
    const color = wings[kind];
    const up = new PixelBuffer(7, 4);
    [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 1],
      [6, 0],
    ].forEach(([x = 0, y = 0]) => up.set(x, y, color));
    if (kind === 'gull') up.set(3, 3, 0x3a3434);
    up.toTexture(scene, birdKey(kind, 0));
    const down = new PixelBuffer(7, 4);
    [
      [0, 2],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
      [6, 2],
    ].forEach(([x = 0, y = 0]) => down.set(x, y, color));
    down.toTexture(scene, birdKey(kind, 1));
  }
  const perched = new PixelBuffer(6, 6);
  const gull: Array<[number, number, number]> = [
    [1, 0, 0xf4f6f8],
    [2, 0, 0xf4f6f8],
    [3, 0, 0xf0a030],
    [1, 1, 0xf4f6f8],
    [2, 1, 0xf4f6f8],
    [0, 2, 0x9aa8b8],
    [1, 2, 0xf4f6f8],
    [2, 2, 0xf4f6f8],
    [3, 2, 0xf4f6f8],
    [0, 3, 0x9aa8b8],
    [1, 3, 0xd8e0e8],
    [2, 3, 0xf4f6f8],
    [3, 3, 0xf4f6f8],
    [1, 4, 0xd8e0e8],
    [2, 4, 0xd8e0e8],
    [1, 5, 0xf0a030],
    [2, 5, 0xf0a030],
  ];
  gull.forEach(([x, y, c]) => perched.set(x, y, c));
  perched.toTexture(scene, GULL_PERCHED);
  const streak = new PixelBuffer(4, 1);
  for (let x = 0; x < 4; x++) streak.set(x, 0, x === 0 ? 0xa8dce8 : 0xe8f6f2);
  streak.toTexture(scene, FLOW_STREAK);
}

function bakeCloud(scene: Phaser.Scene, variant: number): void {
  const key = cloudKey(variant);
  if (scene.textures.exists(key)) return;
  const width = 48 + variant * 14;
  const height = 18 + (variant % 2) * 6;
  const noise = createNoise(variant * 13 + 3);
  const lobes = 3 + variant;
  const buffer = new PixelBuffer(width, height);
  const centers = Array.from({ length: lobes }, (_, i) => ({
    x: ((i + 0.5) / lobes) * width,
    y: height * (0.45 + noise.hash(i, 1) * 0.15),
    r: height * (0.32 + noise.hash(i, 2) * 0.28),
  }));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = centers.some((c) => Math.hypot((x - c.x) / 1.3, y - c.y) < c.r);
      const base = y > height * 0.78;
      if (!inside || base) continue;
      const below = !centers.some((c) => Math.hypot((x - c.x) / 1.3, y + 2 - c.y) < c.r);
      const above = !centers.some((c) => Math.hypot((x - c.x) / 1.3, y - 2 - c.y) < c.r);
      const color = below
        ? CLOUD.edge
        : y > height * 0.6
          ? CLOUD.shade
          : above
            ? CLOUD.light
            : CLOUD.base;
      buffer.set(x, y, color);
    }
  }
  buffer.toTexture(scene, key);
}
