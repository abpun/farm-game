import { BASE, DEEP, hash, LIGHT, ramp, SHADE, SHINE, type Pixels, type Ramp } from './pixelKit';

/** One bed plant frame: 20×32 art px, rooted at GROUND. */
export const PLANT_FRAME = { w: 20, h: 32 } as const;
export const GROUND = { x: 10, y: 29 } as const;

export interface PlantLook {
  leaf: Ramp;
  produce: Ramp;
}

export type PlantPainter = (p: Pixels, t: number, look: PlantLook) => void;

const SOIL = ramp(0x7a4e2c);
const STAKE = ramp(0xa0723f);
const FLOWER_YELLOW = ramp(0xf2d04a);
const FLOWER_WHITE = ramp(0xf4f0e6);
const GOLD = ramp(0xd8b048);
const SILK = 0x8a5a2a;
const { x: GX, y: GY } = GROUND;
const UP = -Math.PI / 2;

/** Stage 0 for every bed crop: a hilled mound with a two-leaf sprout. */
export function sprout(p: Pixels, look: PlantLook): void {
  for (let dx = -4; dx <= 4; dx++) {
    const h = dx === 0 ? 2 : Math.abs(dx) < 3 ? 1 : 0;
    for (let dy = 0; dy <= h; dy++) p.set(GX + dx, GY - dy, SOIL[dy === h ? LIGHT : BASE]);
  }
  p.line(GX, GY - 2, GX, GY - 4, look.leaf[SHADE]);
  p.leaf(GX, GY - 4, UP - 0.9, 3, 2, look.leaf);
  p.leaf(GX, GY - 4, UP + 0.9, 3, 2, look.leaf);
}

// Carrot: feathery fronds; when ripe its orange shoulder shows at the soil.
function root(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const height = 6 + 15 * t;
  if (t >= 1) {
    p.ball(GX, GY - 1, 3, 2, produce);
    p.line(GX - 2, GY - 1, GX + 2, GY - 1, produce[SHADE]);
  }
  const fronds = [-0.55, -0.25, 0, 0.3, 0.6];
  fronds.forEach((lean, i) => {
    const angle = UP + lean;
    const length = height * (1 - Math.abs(lean) * 0.35);
    const ex = GX + Math.cos(angle) * length;
    const ey = GY - 2 + Math.sin(angle) * length;
    p.line(GX, GY - 2, ex, ey, leaf[SHADE]);
    for (let s = 0.35; s <= 1; s += 0.16) {
      const x = GX + (ex - GX) * s;
      const y = GY - 2 + (ey - GY + 2) * s;
      const side = (s * 10 + i) % 2 < 1 ? -1 : 1;
      p.set(x + side, y, leaf[s > 0.8 ? SHINE : LIGHT]);
      p.set(x - side, y + 1, leaf[BASE]);
    }
  });
}

// Cabbage: a rosette of broad leaves cupping a pale, veined head.
function head(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const spread = 3 + 4 * t;
  // Outer wrapper leaves sit low and wide; their veins fan out from the stem.
  for (const [dx, dy, scale] of [
    [-0.75, -0.55, 0.85],
    [0.75, -0.6, 0.85],
    [0, -1, 0.7],
  ] as Array<[number, number, number]>) {
    const x = GX + dx * spread;
    const y = GY + dy * spread * 0.7;
    p.ball(x, y, spread * scale * 0.7, spread * scale * 0.5, leaf);
    p.line(GX, GY - 1, x + dx * 2, y - 1, leaf[SHADE]);
  }
  if (t < 0.3) return;
  const r = 1.5 + 3 * t;
  const cy = GY - r - 1;
  p.ball(GX, cy, r + 0.5, r, produce);
  p.line(GX - 1, cy - r + 1, GX + r * 0.6, cy + 1, produce[SHADE]);
  p.line(GX - r * 0.7, cy, GX - 1, cy + r - 1, produce[SHADE]);
  // Two front leaves cup the head.
  p.ball(GX - spread * 0.55, GY - 1, spread * 0.55, spread * 0.38, leaf);
  p.ball(GX + spread * 0.55, GY - 1, spread * 0.55, spread * 0.38, leaf);
  p.line(GX - spread * 0.9, GY - 1, GX - 1, GY - 2, leaf[LIGHT]);
  p.line(GX + 1, GY - 2, GX + spread * 0.9, GY - 1, leaf[SHADE]);
}

// Tomato: a staked vine with pinnate leaves, yellow flowers, then green and red fruit.
function bush(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const height = 9 + 16 * t;
  p.line(GX + 3, GY, GX + 3, GY - height - 1, STAKE[BASE]);
  p.set(GX + 3, GY - height - 1, STAKE[LIGHT]);
  let x: number = GX;
  for (let y = GY; y > GY - height; y -= 3) {
    const nx = GX + (((GY - y) / 3) % 2 === 0 ? -1 : 1);
    p.line(x, y, nx, y - 3, leaf[SHADE]);
    const side = nx < GX ? -1 : 1;
    p.leaf(nx, y - 3, side < 0 ? Math.PI + 0.4 : -0.4, 4 + 2 * t, 3, leaf);
    x = nx;
  }
  p.leaf(x, GY - height, UP - 0.3, 3, 3, leaf);
  if (t < 0.5) return;
  const fruit = t >= 1 ? produce : ramp(0x7cb342);
  const spots: Array<[number, number]> = [
    [GX - 3, GY - height * 0.35],
    [GX + 1, GY - height * 0.5],
    [GX - 2, GY - height * 0.7],
  ];
  if (t < 0.7) {
    for (const [fx, fy] of spots) p.set(fx, fy, FLOWER_YELLOW[LIGHT]);
    return;
  }
  for (const [fx, fy] of spots) {
    p.ball(fx, fy, 2, 2, fruit);
    p.set(fx, fy - 2, leaf[DEEP]);
  }
}

// Wheat: a tuft of blades that heads out into bearded ears and turns gold.
function grain(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const height = 8 + 17 * t;
  const ripe = t >= 1;
  const stem = ripe ? GOLD : leaf;
  for (const lean of [-0.32, -0.16, 0, 0.14, 0.3]) {
    const tx = GX + lean * height;
    const ty = GY - height * (1 - Math.abs(lean) * 0.3);
    p.line(GX + lean * 3, GY, tx, ty, stem[Math.abs(lean) > 0.2 ? SHADE : BASE]);
    if (t < 0.5) continue;
    const ear = ripe ? produce : ramp(0xa8c860);
    for (let k = 0; k < 5; k++) {
      p.set(tx - (k % 2), ty - k, ear[k % 2 ? LIGHT : BASE]);
      p.set(tx + 1 - (k % 2), ty - k, ear[SHADE]);
    }
    p.line(tx, ty - 5, tx - 1 + lean * 4, ty - 8, ear[SHINE]);
  }
  p.leaf(GX, GY - 1, UP - 0.9, 7, 2, leaf);
  p.leaf(GX, GY - 1, UP + 1, 6, 2, leaf);
}

// Corn: a tall stalk with arching strap leaves, a tassel and a husked cob that opens when ripe.
function stalk(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const height = 10 + 17 * t;
  p.line(GX, GY, GX, GY - height, leaf[SHADE]);
  p.line(GX + 1, GY, GX + 1, GY - height + 2, leaf[BASE]);
  [0.25, 0.45, 0.65, 0.82].forEach((at, i) => {
    const side = i % 2 ? 1 : -1;
    const y0 = GY - height * at;
    for (let k = 0; k <= 8; k++) {
      const x = GX + side * k;
      const y = y0 - Math.sin((k / 8) * Math.PI * 0.9) * 4 + k * 0.2;
      p.set(x, y, leaf[k > 6 ? LIGHT : BASE]);
      p.set(x, y + 1, leaf[SHADE]);
    }
  });
  if (t < 0.6) return;
  for (let k = 0; k < 4; k++)
    p.set(GX + (k % 2 ? 1 : -1) * (k > 1 ? 1 : 0), GY - height - k, GOLD[LIGHT]);
  const cy = GY - height * 0.5;
  p.ball(GX + 3, cy, 2, 4, leaf);
  if (t < 1) return;
  p.ball(GX + 3, cy - 1, 1.5, 3, produce);
  for (let k = -2; k <= 2; k += 2) p.set(GX + 3, cy + k, produce[SHADE]);
  p.line(GX + 3, cy - 4, GX + 5, cy - 7, SILK);
}

// Potato: a leafy mound of compound leaves, small flowers, and tubers peeking out when ripe.
function tuber(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const r = 3 + 4 * t;
  for (const [dx, dy] of [
    [-r * 0.6, -r * 0.6],
    [r * 0.6, -r * 0.7],
    [0, -r * 1.2],
  ] as Array<[number, number]>) {
    p.ball(GX + dx, GY + dy, r * 0.7, r * 0.6, leaf);
  }
  for (let k = 0; k < 10 * t; k++) {
    const x = GX + (hash(k, 3) - 0.5) * r * 2;
    const y = GY - hash(k, 9) * r * 1.8;
    p.set(x, y, leaf[hash(k, 5) > 0.5 ? SHADE : SHINE]);
  }
  if (t >= 0.6) {
    for (const [dx, dy] of [
      [-2, -r * 1.6],
      [2, -r * 1.4],
    ] as Array<[number, number]>) {
      p.set(GX + dx, GY + dy, FLOWER_WHITE[LIGHT]);
      p.set(GX + dx, GY + dy + 1, FLOWER_YELLOW[BASE]);
    }
  }
  if (t < 1) return;
  p.ball(GX - 4, GY, 2.5, 1.8, produce);
  p.ball(GX + 4, GY - 0.5, 2, 1.6, produce);
}

// Strawberry: low trifoliate leaves, white flowers, and seeded red berries hanging out.
function berry(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const size = 3 + 3 * t;
  for (const a of [-2.6, -1.9, -1.25, -0.55]) {
    const ex = GX + Math.cos(a) * size;
    const ey = GY - 1 + Math.sin(a) * size;
    p.line(GX, GY - 1, ex, ey, leaf[SHADE]);
    p.ball(ex, ey, 2, 1.5, leaf);
  }
  if (t < 0.4) return;
  const spots: Array<[number, number]> = [
    [GX - size, GY],
    [GX + size, GY - 1],
    [GX + 1, GY + 1],
  ];
  for (const [x, y] of spots) {
    if (t < 0.7) {
      p.ball(x, y - 1, 1.5, 1.5, FLOWER_WHITE);
      p.set(x, y - 1, FLOWER_YELLOW[BASE]);
      continue;
    }
    const fruit = t >= 1 ? produce : ramp(0xe8f0c8);
    p.ball(x, y, 1.8, 2.2, fruit);
    p.set(x, y - 2, leaf[LIGHT]);
    p.set(x - 0.5, y, FLOWER_YELLOW[SHINE]);
  }
}

// Onion: hollow upright leaves over a swelling papery bulb; ripe tops flop over.
function bulb(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const r = 1 + 3 * t;
  const height = 8 + 12 * t;
  [-0.25, -0.1, 0.05, 0.2].forEach((lean, i) => {
    const flop = t >= 1 && i % 2 === 0 ? 0.9 : 0;
    const angle = UP + lean + flop * Math.sign(lean || 1);
    const length = height * (1 - Math.abs(lean));
    p.line(
      GX,
      GY - r,
      GX + Math.cos(angle) * length,
      GY - r + Math.sin(angle) * length,
      (s) => leaf[s > 0.85 ? LIGHT : s < 0.2 ? SHADE : BASE],
    );
  });
  p.ball(GX, GY - r, r + 0.5, r, produce);
  if (r > 2) p.line(GX - 1, GY - r * 1.7, GX - 1, GY - 1, produce[LIGHT]);
}

// Sugarcane: jointed canes with leaves sprouting high up.
function cane(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const height = 9 + 17 * t;
  for (const [dx, scale] of [
    [-3, 0.85],
    [1, 1],
    [4, 0.7],
  ] as const) {
    const top = GY - height * scale;
    for (let y = GY; y > top; y--) {
      const node = (GY - y) % 5 === 4;
      p.set(GX + dx, y, node ? produce[DEEP] : produce[BASE]);
      p.set(GX + dx + 1, y, node ? produce[DEEP] : produce[SHADE]);
      if (!node) p.set(GX + dx, y, produce[(GY - y) % 5 === 0 ? LIGHT : BASE]);
    }
    p.leaf(GX + dx, top + 1, UP - 0.8, 6 * scale + 2, 2, leaf);
    p.leaf(GX + dx + 1, top + 2, UP + 0.9, 6 * scale + 2, 2, leaf);
  }
}

// Pumpkin: a running vine with big lobed leaves, a yellow flower, then a ribbed pumpkin.
function vine(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const reach = 4 + 5 * t;
  p.line(GX - reach, GY, GX + reach, GY - 1, leaf[SHADE]);
  for (const dx of [-reach * 0.7, reach * 0.1, reach * 0.8]) {
    const size = 2.5 + 2 * t;
    p.ball(GX + dx, GY - size - 1, size, size * 0.8, leaf);
    p.set(GX + dx, GY - size * 1.6 - 1, leaf[DEEP]);
  }
  p.set(GX + reach + 1, GY - 2, leaf[LIGHT]);
  p.set(GX + reach + 2, GY - 3, leaf[LIGHT]);
  if (t < 0.4) return;
  if (t < 0.7) {
    p.ball(GX - 1, GY - 2, 1.5, 1.5, FLOWER_YELLOW);
    return;
  }
  const fruit = t >= 1 ? produce : ramp(0x6a9a3a);
  const rx = t >= 1 ? 5 : 3;
  const ry = rx * 0.7;
  p.ball(GX, GY - ry, rx, ry, fruit);
  for (const dx of [-rx * 0.5, rx * 0.15, rx * 0.65]) {
    for (let y = -ry * 0.7; y <= ry * 0.7; y++) p.set(GX + dx, GY - ry + y, fruit[SHADE]);
  }
  p.line(GX, GY - ry * 2, GX + 1, GY - ry * 2 - 2, leaf[DEEP]);
}

// Blueberry: a woody shrub of small oval leaves with clusters that ripen green → blue.
function shrub(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const height = 6 + 13 * t;
  const wood = ramp(0x7a5a3a);
  for (const lean of [-0.4, 0, 0.35]) {
    p.line(GX, GY, GX + lean * height, GY - height, wood[BASE]);
  }
  for (let k = 0; k < 8 + 14 * t; k++) {
    const along = 0.3 + hash(k, 1) * 0.7;
    const lean = [-0.4, 0, 0.35][k % 3] ?? 0;
    const x = GX + lean * height * along + (hash(k, 2) - 0.5) * 4;
    const y = GY - height * along;
    p.leaf(x, y, hash(k, 4) > 0.5 ? -0.5 : Math.PI + 0.5, 3, 2, leaf);
  }
  if (t < 0.6) return;
  const fruit = t >= 1 ? produce : ramp(0x9ac070);
  for (let k = 0; k < 6; k++) {
    const x = GX + (hash(k, 11) - 0.5) * height * 0.8;
    const y = GY - height * (0.3 + hash(k, 12) * 0.5);
    p.ball(x, y, 1.2, 1.2, fruit, false);
    p.set(x - 0.4, y - 0.4, fruit[SHINE]);
  }
}

// Watermelon: a sprawling vine with cut leaves and a big striped melon.
function melon(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const reach = 4 + 5 * t;
  p.line(GX - reach, GY - 1, GX + reach, GY, leaf[SHADE]);
  for (let k = 0; k < 5; k++) {
    const dx = (k / 4 - 0.5) * reach * 2;
    p.leaf(GX + dx, GY - 1, UP + (k - 2) * 0.5, 3 + 2 * t, 3, leaf);
  }
  if (t < 0.6) return;
  const rx = t >= 1 ? 6 : 3.5;
  const ry = rx * 0.6;
  p.ball(GX + 1, GY - ry, rx, ry, produce);
  for (let k = -2; k <= 2; k++) {
    for (let y = -ry * 0.8; y <= ry * 0.8; y++) {
      const curve = (y / ry) ** 2 * k * 0.6;
      p.set(GX + 1 + k * rx * 0.33 + curve, GY - ry + y, produce[DEEP]);
    }
  }
}

// Grapes: a vine trained on a wooden trellis, lobed leaves, then hanging bunches.
function trellis(p: Pixels, t: number, { leaf, produce }: PlantLook): void {
  const top = GY - 22;
  p.line(GX - 6, GY, GX - 6, top, STAKE[BASE]);
  p.line(GX + 6, GY, GX + 6, top, STAKE[SHADE]);
  p.line(GX - 7, top + 1, GX + 7, top + 1, STAKE[LIGHT]);
  const reach = 0.3 + 0.7 * t;
  p.line(GX, GY, GX, GY - 20 * reach, ramp(0x6e4a2a)[BASE]);
  for (let k = 0; k < 3 + 6 * t; k++) {
    const x = GX + (hash(k, 21) - 0.5) * 14 * reach;
    const y = GY - 6 - hash(k, 22) * 16 * reach;
    p.ball(x, y, 2.2, 1.8, leaf);
    p.set(x, y - 2, leaf[LIGHT]);
  }
  if (t < 0.6) return;
  const fruit = t >= 1 ? produce : ramp(0x9ac070);
  for (const bx of [GX - 3, GX + 3]) {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4 - row; col++) {
        p.ball(bx - (3 - row) + col * 2, top + 6 + row * 2, 1, 1, fruit, false);
      }
    }
  }
}

/** Bed plant painters by `visual.kind` in crops.json. */
export const BED_PAINTERS: Record<string, PlantPainter> = {
  root,
  head,
  bush,
  grain,
  stalk,
  tuber,
  berry,
  bulb,
  cane,
  vine,
  shrub,
  melon,
  trellis,
};
