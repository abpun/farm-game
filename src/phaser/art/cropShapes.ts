import type * as Phaser from 'phaser';
import { PALETTE } from '../theme';
import { lineWidth, shade } from './paint';

export interface Plant {
  x: number;
  y: number;
  s: number;
  /** Growth 0..1; 1 is ripe. */
  t: number;
  leaf: number;
  produce: number;
}

type G = Phaser.GameObjects.Graphics;

// Corn: tall stalks with arching leaves and a cob that yellows when ripe.
export function drawStalk(g: G, { x, y, s, t, leaf, produce }: Plant): void {
  const height = (8 + 30 * t) * s;
  g.lineStyle(lineWidth(1.8 * s), shade(leaf, 0.85)).lineBetween(x, y, x, y - height);
  g.lineStyle(lineWidth(1.2 * s), leaf);
  for (const [dir, at] of [
    [-1, 0.35],
    [1, 0.55],
    [-1, 0.75],
  ] as const) {
    const ly = y - height * at;
    g.lineBetween(x, ly, x + dir * 6 * s, ly - 3 * s);
  }
  if (t < 0.6) return;
  const cob = t >= 1 ? produce : shade(leaf, 1.3);
  g.fillStyle(cob).fillEllipse(x + 2 * s, y - height * 0.55, 3.5 * s, 8 * s);
  g.fillStyle(shade(leaf, 1.15)).fillTriangle(
    x,
    y - height * 0.45,
    x + 4 * s,
    y - height * 0.45,
    x + 2 * s,
    y - height * 0.7,
  );
}

// Strawberry: a low leafy mound with berries that blush from white to red.
export function drawBerry(g: G, { x, y, s, t, leaf, produce }: Plant): void {
  const r = (3 + 4 * t) * s;
  g.fillStyle(shade(leaf, 0.75)).fillEllipse(x, y - r * 0.5, r * 2.6, r * 1.4);
  g.fillStyle(leaf).fillEllipse(x - r * 0.4, y - r * 0.8, r * 1.6, r);
  g.fillStyle(shade(leaf, 1.2)).fillEllipse(x + r * 0.5, y - r * 0.9, r * 1.2, r * 0.8);
  if (t < 0.6) return;
  const berry = t >= 1 ? produce : 0xf2f0d8;
  for (const [dx, dy] of [
    [-0.9, -0.2],
    [0.8, -0.1],
    [0, 0.1],
  ] as const) {
    g.fillStyle(berry).fillCircle(x + dx * r, y + dy * r, Math.max(1.2, 1.4 * s));
  }
}

// Onion: spiky upright leaves over a bulb that swells at the base.
export function drawBulb(g: G, { x, y, s, t, leaf, produce }: Plant): void {
  const height = (8 + 16 * t) * s;
  g.lineStyle(lineWidth(1.4 * s), leaf);
  for (const dx of [-2, 0, 2]) g.lineBetween(x + dx * s * 0.5, y - 2 * s, x + dx * s, y - height);
  if (t < 0.5) return;
  const r = (2 + 3 * t) * s;
  g.fillStyle(t >= 1 ? produce : shade(produce, 0.85)).fillEllipse(x, y - r * 0.6, r * 2, r * 1.6);
  g.fillStyle(shade(produce, 1.2)).fillRect(Math.round(x - r * 0.4), Math.round(y - r), 1, 1);
}

// Sugarcane: segmented green canes that pale when ready.
export function drawCane(g: G, { x, y, s, t, leaf, produce }: Plant): void {
  const height = (8 + 32 * t) * s;
  const cane = t >= 1 ? produce : shade(leaf, 0.9);
  for (const dx of [-2.5, 0, 2.5]) {
    const top = y - height * (dx === 0 ? 1 : 0.85);
    g.lineStyle(lineWidth(2 * s), cane).lineBetween(x + dx * s, y, x + dx * s, top);
    g.fillStyle(shade(cane, 0.7));
    for (let k = 1; k < 4; k++)
      g.fillRect(Math.round(x + dx * s - s), Math.round(y - (height * k) / 4), lineWidth(2 * s), 1);
    g.lineStyle(lineWidth(1 * s), leaf).lineBetween(
      x + dx * s,
      top,
      x + dx * s + 4 * s,
      top + 3 * s,
    );
  }
}

// Pumpkin and watermelon: sprawling leaves with one big fruit on the ground.
export function drawVine(g: G, { x, y, s, t, leaf, produce }: Plant): void {
  const spread = (4 + 6 * t) * s;
  g.fillStyle(shade(leaf, 0.75)).fillEllipse(
    x - spread * 0.7,
    y - spread * 0.2,
    spread,
    spread * 0.6,
  );
  g.fillStyle(leaf).fillEllipse(x + spread * 0.7, y - spread * 0.3, spread, spread * 0.6);
  g.lineStyle(1, shade(leaf, 0.6)).lineBetween(x - spread, y, x + spread, y - spread * 0.2);
  if (t < 0.5) return;
  const r = (2 + 5 * t) * s;
  const fruit = t >= 1 ? produce : shade(produce, 0.75);
  g.fillStyle(fruit).fillEllipse(x, y - r * 0.7, r * 2.2, r * 1.6);
  g.lineStyle(1, shade(fruit, 0.75));
  g.lineBetween(x - r * 0.4, y - r * 1.4, x - r * 0.4, y - r * 0.1);
  g.lineBetween(x + r * 0.4, y - r * 1.4, x + r * 0.4, y - r * 0.1);
  g.fillStyle(shade(fruit, 1.25)).fillRect(Math.round(x - r * 0.7), Math.round(y - r * 1.1), 1, 1);
  g.fillStyle(PALETTE.trunk).fillRect(Math.round(x), Math.round(y - r * 1.6), 1, 2);
}

// Grapes: a wooden trellis post with leaves and hanging purple bunches.
export function drawTrellis(g: G, { x, y, s, t, leaf, produce }: Plant): void {
  const height = (10 + 18 * t) * s;
  g.lineStyle(lineWidth(1.5 * s), PALETTE.stake).lineBetween(x, y, x, y - height);
  g.lineBetween(x - 5 * s, y - height, x + 5 * s, y - height);
  const r = (2 + 3 * t) * s;
  g.fillStyle(shade(leaf, 0.8)).fillCircle(x - 3 * s, y - height + r * 0.6, r);
  g.fillStyle(leaf).fillCircle(x + 3 * s, y - height + r * 0.4, r);
  if (t < 0.6) return;
  const bunch = t >= 1 ? produce : shade(leaf, 1.35);
  g.fillStyle(bunch);
  for (const bx of [-3, 3]) {
    const cx = x + bx * s;
    const cy = y - height + r * 1.6;
    g.fillCircle(cx, cy, Math.max(1, 1.3 * s));
    g.fillCircle(cx - s, cy + 1.6 * s, Math.max(1, 1.1 * s));
    g.fillCircle(cx + s, cy + 1.6 * s, Math.max(1, 1.1 * s));
    g.fillCircle(cx, cy + 3 * s, Math.max(1, s));
  }
}
