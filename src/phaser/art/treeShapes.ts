import type * as Phaser from 'phaser';
import { PALETTE } from '../theme';
import type { Plant } from './cropShapes';
import { lineWidth, seededRandom, shade, SHADOW } from './paint';

type G = Phaser.GameObjects.Graphics;

/** Art-pixel tile width the tree sizes below were designed for. */
export const TREE_DESIGN_WIDTH = 40;
/** Extra height above an orchard tile for a grown tree, as a fraction of tile width. */
export const TREE_HEADROOM_RATIO = 1;

const FRUIT_SPOTS: Array<[number, number]> = [
  [-0.55, -0.15],
  [0.45, -0.35],
  [-0.1, -0.7],
  [0.6, 0.25],
  [-0.4, 0.4],
  [0.1, 0.1],
];

// Orchard tree: sapling → young → leafy → fruiting. The fruitless stage doubles as regrowth.
export function drawFruitTree(g: G, { x, y, s, t, leaf, produce }: Plant): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(x, y, (8 + 18 * t) * s, (3 + 6 * t) * s);
  if (t === 0) {
    g.lineStyle(lineWidth(1.2 * s), PALETTE.trunk).lineBetween(x, y, x, y - 8 * s);
    g.fillStyle(leaf).fillEllipse(x - 2 * s, y - 8 * s, 4 * s, 2.5 * s);
    g.fillStyle(shade(leaf, 1.2)).fillEllipse(x + 2 * s, y - 9 * s, 4 * s, 2.5 * s);
    return;
  }
  const trunk = (6 + 8 * t) * s;
  const r = (4 + 9 * t) * s;
  g.fillStyle(PALETTE.trunk).fillRect(
    Math.round(x - 1.5 * s),
    Math.round(y - trunk),
    Math.max(2, Math.round(3 * s)),
    Math.round(trunk),
  );
  g.fillStyle(shade(PALETTE.trunk, 0.7)).fillRect(
    Math.round(x + 0.5 * s),
    Math.round(y - trunk),
    1,
    Math.round(trunk),
  );
  const cy = y - trunk - r * 0.6;
  g.fillStyle(shade(leaf, 0.7)).fillCircle(x, cy, r);
  g.fillStyle(leaf).fillCircle(x - r * 0.35, cy - r * 0.25, r * 0.75);
  g.fillStyle(leaf).fillCircle(x + r * 0.4, cy - r * 0.15, r * 0.65);
  g.fillStyle(shade(leaf, 1.25)).fillCircle(x - r * 0.3, cy - r * 0.55, r * 0.35);
  const random = seededRandom(7);
  for (let i = 0; i < 10; i++) {
    g.fillStyle(random() > 0.5 ? shade(leaf, 1.3) : shade(leaf, 0.6));
    g.fillRect(
      Math.round(x + (random() - 0.5) * r * 1.6),
      Math.round(cy + (random() - 0.5) * r * 1.4),
      1,
      1,
    );
  }
  if (t < 1) return;
  for (const [dx, dy] of FRUIT_SPOTS) {
    const fx = Math.round(x + dx * r);
    const fy = Math.round(cy + dy * r);
    g.fillStyle(produce).fillCircle(fx, fy, Math.max(1.3, 1.6 * s));
    g.fillStyle(shade(produce, 1.35)).fillRect(fx - 1, fy - 1, 1, 1);
  }
}

// Banana palm: a leaning ringed trunk, drooping fronds and a hanging bunch.
export function drawPalm(g: G, { x, y, s, t, leaf, produce }: Plant): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(x, y, (8 + 16 * t) * s, (3 + 5 * t) * s);
  const height = (8 + 20 * t) * s;
  const lean = 3 * t * s;
  const top = { x: x + lean, y: y - height };
  g.lineStyle(lineWidth(2.5 * s), PALETTE.trunk).lineBetween(x, y, top.x, top.y);
  g.fillStyle(shade(PALETTE.trunk, 0.7));
  for (let k = 1; k < 5; k++) {
    g.fillRect(
      Math.round(x + (lean * k) / 5 - s),
      Math.round(y - (height * k) / 5),
      Math.max(2, Math.round(2.5 * s)),
      1,
    );
  }
  const frond = (5 + 9 * t) * s;
  g.lineStyle(lineWidth(1.6 * s), leaf);
  for (const [dx, dy] of [
    [-1, 0.3],
    [1, 0.4],
    [-0.6, -0.4],
    [0.7, -0.3],
    [0, -0.6],
  ] as const) {
    g.lineBetween(top.x, top.y, top.x + dx * frond, top.y + dy * frond + frond * 0.3);
  }
  g.lineStyle(lineWidth(1 * s), shade(leaf, 1.25));
  g.lineBetween(top.x, top.y, top.x - frond * 0.8, top.y + frond * 0.5);
  if (t < 1) return;
  g.fillStyle(produce);
  for (let k = 0; k < 3; k++) {
    g.fillEllipse(top.x + (k - 1) * 2 * s, top.y + 4 * s + (k % 2) * s, 1.8 * s, 4 * s);
  }
}
