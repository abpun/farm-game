import type { PlantLook } from './bedPlants';
import { fruit, type FruitShape } from './orchardPlants';
import { BASE, DEEP, LIGHT, ramp, SHADE, SHINE, type Pixels } from './pixelKit';

/** Produce icons are painted around this centre of their frame. */
export const ICON_CENTER = { x: 10, y: 16 } as const;

export type ProducePainter = (p: Pixels, look: PlantLook, shape: FruitShape) => void;

const STRAW = ramp(0xd8b048);
const HUSK = ramp(0x9ac060);
const { x: CX, y: CY } = ICON_CENTER;

const carrot: ProducePainter = (p, { leaf, produce }) => {
  for (let k = 0; k < 9; k++) {
    const w = Math.max(0.5, 2.5 - k * 0.28);
    p.ball(CX - 3 + k, CY - 3 + k, w, w, produce, false);
  }
  for (let k = 1; k < 8; k += 3) p.set(CX - 3 + k, CY - 2 + k, produce[SHADE]);
  for (const a of [-2.4, -1.9, -1.4]) p.leaf(CX - 4, CY - 4, a, 6, 2, leaf);
};

const cabbage: ProducePainter = (p, { leaf, produce }) => {
  p.leaf(CX, CY + 3, -2.8, 7, 5, leaf);
  p.leaf(CX, CY + 3, -0.35, 7, 5, leaf);
  p.ball(CX, CY, 5, 4.5, produce);
  for (const dx of [-2, 1]) p.line(CX + dx, CY - 3, CX + dx + 1, CY + 3, produce[SHADE]);
};

const ball =
  (r: number, stalk: boolean): ProducePainter =>
  (p, { leaf, produce }) => {
    p.ball(CX, CY, r, r * 0.9, produce);
    if (!stalk) return;
    p.set(CX, CY - r, leaf[DEEP]);
    p.set(CX - 1, CY - r + 1, leaf[BASE]);
    p.set(CX + 1, CY - r + 1, leaf[BASE]);
  };

const wheat: ProducePainter = (p, { produce }) => {
  for (const dx of [-3, 0, 3]) {
    p.line(CX + dx * 0.4, CY + 6, CX + dx, CY - 2, STRAW[SHADE]);
    for (let k = 0; k < 6; k++) {
      p.set(CX + dx - (k % 2), CY - 2 - k, produce[k % 2 ? LIGHT : BASE]);
      p.set(CX + dx + 1 - (k % 2), CY - 2 - k, produce[SHADE]);
    }
    p.line(CX + dx, CY - 8, CX + dx - 1, CY - 10, produce[SHINE]);
  }
  p.line(CX - 3, CY + 3, CX + 3, CY + 3, STRAW[DEEP]);
};

const corn: ProducePainter = (p, { produce }) => {
  p.ball(CX + 1, CY, 3, 6, HUSK);
  p.ball(CX, CY - 1, 2.5, 5.5, produce);
  for (let y = -5; y <= 4; y += 2) p.line(CX - 2, CY + y, CX + 2, CY + y, produce[SHADE]);
  p.line(CX + 2, CY + 6, CX - 2, CY + 2, HUSK[SHADE]);
};

const potato: ProducePainter = (p, { produce }) => {
  p.ball(CX, CY, 6, 4.5, produce);
  for (const [dx, dy] of [
    [-2, -1],
    [2, 1],
    [3, -2],
  ] as Array<[number, number]>) {
    p.set(CX + dx, CY + dy, produce[DEEP]);
  }
};

const strawberry: ProducePainter = (p, { leaf, produce }) => {
  for (let k = 0; k < 8; k++) {
    const w = 4.5 - k * 0.5;
    p.ball(CX, CY - 3 + k, w, 1.4, produce, false);
  }
  for (const [dx, dy] of [
    [-2, -2],
    [1, -1],
    [-1, 1],
    [2, 2],
    [0, 3],
  ] as Array<[number, number]>) {
    p.set(CX + dx, CY + dy, ramp(0xf2d04a)[SHINE]);
  }
  p.leaf(CX, CY - 4, -2.6, 4, 2, leaf);
  p.leaf(CX, CY - 4, -0.5, 4, 2, leaf);
};

const onion: ProducePainter = (p, { produce }) => {
  p.ball(CX, CY + 1, 5, 4.5, produce);
  p.line(CX, CY - 4, CX + 1, CY - 7, produce[SHADE]);
  for (const dx of [-2, 1]) p.line(CX + dx, CY - 2, CX + dx, CY + 4, produce[LIGHT]);
};

const sugarcane: ProducePainter = (p, { leaf, produce }) => {
  for (const dx of [-3, 0, 3]) {
    for (let y = -7; y <= 7; y++) {
      const node = (y + 7) % 5 === 4;
      p.set(CX + dx, CY + y + dx * 0.3, produce[node ? DEEP : LIGHT]);
      p.set(CX + dx + 1, CY + y + dx * 0.3, produce[node ? DEEP : SHADE]);
    }
  }
  p.leaf(CX, CY - 7, -2.2, 5, 2, leaf);
};

const pumpkin: ProducePainter = (p, { leaf, produce }) => {
  p.ball(CX, CY + 1, 7, 5, produce);
  for (const dx of [-3.5, 0, 3.5]) p.line(CX + dx, CY - 3, CX + dx, CY + 5, produce[SHADE]);
  p.rect(CX, CY - 6, 1, 2, leaf[DEEP]);
  p.leaf(CX + 1, CY - 5, -0.3, 4, 2, leaf);
};

const blueberries: ProducePainter = (p, { leaf, produce }) => {
  for (const [dx, dy] of [
    [-3, 1],
    [2, 2],
    [0, -2],
  ] as Array<[number, number]>) {
    p.ball(CX + dx, CY + dy, 3, 3, produce);
    p.set(CX + dx, CY + dy - 2, produce[DEEP]);
  }
  p.leaf(CX, CY - 4, -0.6, 5, 3, leaf);
};

const watermelon: ProducePainter = (p, { produce }) => {
  p.ball(CX, CY, 8, 5.5, produce);
  for (let k = -2; k <= 2; k++) {
    for (let y = -4; y <= 4; y++) p.set(CX + k * 3 + (y / 4) ** 2 * k, CY + y, produce[DEEP]);
  }
};

const grapes: ProducePainter = (p, { leaf, produce }) => {
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5 - row; col++) {
      p.ball(CX - (4 - row) + col * 2, CY - 4 + row * 2.2, 1.4, 1.4, produce, false);
    }
  }
  p.line(CX, CY - 5, CX + 1, CY - 8, ramp(0x6e4a2a)[BASE]);
  p.leaf(CX + 1, CY - 7, -0.4, 5, 3, leaf);
};

const orchardFruit: ProducePainter = (p, { leaf, produce }, shape) =>
  fruit(p, CX, CY + 1, 5, produce, shape, leaf);

const bananas: ProducePainter = (p, { produce }) => {
  for (const offset of [-2, 0, 2]) {
    for (let k = 0; k < 10; k++) {
      const x = CX - 5 + k;
      const y = CY + offset - Math.sin((k / 9) * Math.PI) * 3;
      p.set(x, y, produce[LIGHT]);
      p.set(x, y + 1, produce[BASE]);
      p.set(x, y + 2, produce[SHADE]);
    }
  }
  p.rect(CX - 6, CY - 2, 1, 5, ramp(0x6e4a2a)[BASE]);
};

/** Icons of the harvested produce, by `visual.kind`. */
export const PRODUCE_PAINTERS: Record<string, ProducePainter> = {
  root: carrot,
  head: cabbage,
  bush: ball(5, true),
  grain: wheat,
  stalk: corn,
  tuber: potato,
  berry: strawberry,
  bulb: onion,
  cane: sugarcane,
  vine: pumpkin,
  shrub: blueberries,
  melon: watermelon,
  trellis: grapes,
  tree: orchardFruit,
  palm: bananas,
};
