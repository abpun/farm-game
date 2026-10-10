import type { PlantLook } from './bedPlants';
import { BASE, DEEP, hash, LIGHT, ramp, SHADE, SHINE, type Pixels, type Ramp } from './pixelKit';

/** One orchard frame: a whole tree on a 40×60 art px tile, rooted at TREE_GROUND. */
export const TREE_FRAME = { w: 40, h: 60 } as const;
export const TREE_GROUND = { x: 20, y: 50 } as const;

export type FruitShape = 'round' | 'pear' | 'oval';
export type TreePainter = (p: Pixels, t: number, look: PlantLook, shape: FruitShape) => void;

const BARK = ramp(0x7a5232);
const STAKE = ramp(0xa0723f);
const BLOSSOM = ramp(0xf6d2dc);
const HEART = ramp(0x8a3a5a);
const { x: TX, y: TY } = TREE_GROUND;
const UP = -Math.PI / 2;

/** A fruit of the given shape centred on (x, y), with a stem and a leaf. */
export function fruit(
  p: Pixels,
  x: number,
  y: number,
  size: number,
  shades: Ramp,
  shape: FruitShape,
  leaf: Ramp,
) {
  if (shape === 'pear') {
    p.ball(x, y + size * 0.4, size, size, shades);
    p.ball(x, y - size * 0.5, size * 0.6, size * 0.7, shades);
  } else if (shape === 'oval') {
    p.ball(x, y, size * 0.8, size * 1.25, shades);
  } else {
    p.ball(x, y, size, size, shades);
  }
  const top = shape === 'pear' ? y - size * 1.2 : shape === 'oval' ? y - size * 1.25 : y - size;
  p.set(x, top, BARK[DEEP]);
  if (size >= 2) p.set(x + 1, top - 1, leaf[LIGHT]);
}

// Orchard tree: staked sapling → young tree → full canopy (blossom) → laden with fruit.
function tree(p: Pixels, t: number, { leaf, produce }: PlantLook, shape: FruitShape): void {
  if (t === 0) {
    p.line(TX + 4, TY, TX + 4, TY - 13, STAKE[BASE]);
    p.line(TX + 4, TY - 8, TX + 1, TY - 8, STAKE[SHADE]);
    p.line(TX, TY, TX, TY - 12, BARK[SHADE]);
    for (const [y, angle] of [
      [8, UP - 1.1],
      [10, UP + 1],
      [12, UP - 0.5],
      [12, UP + 0.45],
      [13, UP],
    ] as Array<[number, number]>) {
      p.leaf(TX, TY - y, angle, 4, 3, leaf);
    }
    return;
  }
  const trunk = 10 + 8 * t;
  const width = t < 0.5 ? 2 : 3;
  for (let y = 0; y < trunk; y++) {
    for (let dx = 0; dx < width; dx++) {
      const bark = dx === 0 ? LIGHT : dx === width - 1 ? SHADE : BASE;
      p.set(TX - 1 + dx, TY - y, BARK[(y * 7 + dx) % 5 === 0 ? DEEP : bark]);
    }
  }
  p.set(TX - 2, TY, BARK[SHADE]);
  p.set(TX + width - 1, TY, BARK[DEEP]);
  const r = 6 + 9 * t;
  const cy = TY - trunk - r * 0.55;
  const blobs: Array<[number, number, number]> = [
    [0, 0, 1],
    [-0.55, 0.25, 0.7],
    [0.55, 0.2, 0.72],
    [-0.25, -0.45, 0.65],
    [0.3, -0.4, 0.6],
  ];
  for (const [bx, by, br] of blobs) p.ball(TX + bx * r, cy + by * r, r * br, r * br * 0.8, leaf);
  for (let k = 0; k < r * 6; k++) {
    const x = TX + (hash(k, 7) - 0.5) * r * 1.9;
    const y = cy + (hash(k, 8) - 0.5) * r * 1.4;
    if (!p.isSet(Math.round(x), Math.round(y))) continue;
    p.set(x, y, leaf[hash(k, 9) > 0.55 ? SHINE : SHADE]);
  }
  if (t < 0.6) return;
  if (t < 1) {
    for (let k = 0; k < 8; k++) {
      const x = TX + (hash(k, 31) - 0.5) * r * 1.6;
      const y = cy + (hash(k, 32) - 0.5) * r;
      p.set(x, y, BLOSSOM[hash(k, 33) > 0.5 ? SHINE : LIGHT]);
    }
    return;
  }
  const spots: Array<[number, number]> = [
    [-0.55, 0.15],
    [0.45, -0.1],
    [-0.1, -0.5],
    [0.6, 0.35],
    [-0.35, 0.5],
    [0.15, 0.3],
  ];
  for (const [fx, fy] of spots) fruit(p, TX + fx * r, cy + fy * r, 2, produce, shape, leaf);
}

// Banana palm: a ringed, leaning trunk under arching fronds, with a hand of bananas.
function palm(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const height = 10 + 22 * t;
  const lean = (y: number) => Math.sin((y / height) * 1.2) * 3 * t;
  for (let y = 0; y < height; y++) {
    const x = TX + lean(y);
    const ring = y % 3 === 0;
    p.set(x - 1, TY - y, BARK[ring ? SHADE : LIGHT]);
    p.set(x, TY - y, BARK[ring ? DEEP : BASE]);
    p.set(x + 1, TY - y, BARK[ring ? DEEP : SHADE]);
  }
  const topX = TX + lean(height);
  const topY = TY - height;
  const span = 6 + 10 * t;
  // Fronds: a thick midrib with leaflets, drooping toward the tip.
  for (const angle of [-2.95, -2.45, -1.95, -1.15, -0.65, -0.2]) {
    for (let k = 0; k <= span; k++) {
      const droop = (k / span) ** 2 * span * 0.5;
      const x = topX + Math.cos(angle) * k;
      const y = topY + Math.sin(angle) * k * 0.7 + droop;
      p.set(x, y, leaf[SHADE]);
      if (k < 2) continue;
      const tip = k > span * 0.7;
      p.set(x, y - 1, leaf[tip ? SHINE : LIGHT]);
      p.set(x, y + 1, leaf[BASE]);
      if (k % 2 === 0) p.set(x, y + 2, leaf[tip ? LIGHT : SHADE]);
    }
  }
  if (t < 0.6) return;
  // The bunch hangs from the crown: tiers of up-curving fingers, the purple heart below.
  const hand = t >= 1 ? produce : ramp(0x8ab84a);
  const stemX = topX + 1;
  p.line(stemX, topY + 1, stemX, topY + 11, BARK[SHADE]);
  for (let tier = 0; tier < 3; tier++) {
    const y = topY + 3 + tier * 2.5;
    for (let k = -2; k <= 2; k++) {
      const x = stemX + k * 1.5;
      p.set(x, y + 1, hand[BASE]);
      p.set(x + Math.sign(k), y, hand[LIGHT]);
      p.set(x, y + 2, hand[SHADE]);
    }
  }
  p.ball(stemX, topY + 12, 1.5, 2, HEART);
}

export const TREE_PAINTERS: Record<string, TreePainter> = { tree, palm };
