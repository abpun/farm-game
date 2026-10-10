import type * as Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE } from '../layout';
import { PALETTE } from '../theme';
import { bake, SHADOW } from './paint';
import { PixelBuffer } from './PixelBuffer';
import { bayer, createNoise } from './terrain/noise';

export const MINE_TEXTURES = {
  backdrop: 'mine-backdrop',
  floor: 'mine-floor',
  rubble: 'mine-rubble',
  pickaxe: 'mine-pickaxe',
  glow: 'mine-glow',
} as const;

export const depositKey = (depositId: string) => `mine-deposit-${depositId}`;

/** Floor diamond in art pixels: 8×8 tiles of 40×20. */
export const MINE_FLOOR = { columns: 8, rows: 8, tileW: 40, tileH: 20 } as const;

const WALL = { deep: 0x1e1719, dark: 0x2c2426, base: 0x372e2f, light: 0x463b3c, edge: 0x6a5c58 };
const FLOOR = { dark: 0x3a3230, base: 0x4c4240, light: 0x5e5250, crack: 0x2a2224 };
const DAYLIGHT = 0xf6e2b0;

const ORE_FLECKS: Record<string, number[]> = {
  stone: [0xc8c4ba, 0xa8a49a],
  coal: [0x1e1a1c, 0x3a3434],
  copper: [0xe08a4a, 0xf8c08a],
  iron: [0xc8d0d8, 0xeef2f6],
  gem: [0xa078c8, 0xe0c8f8],
};

export function generateMineTextures(scene: Phaser.Scene, depositIds: string[]): void {
  if (!scene.textures.exists(MINE_TEXTURES.backdrop)) bakeBackdrop(scene);
  if (!scene.textures.exists(MINE_TEXTURES.floor)) bakeFloor(scene);
  for (const id of depositIds) {
    bake(scene, depositKey(id), 34, 30, (g) => drawDeposit(g, id));
  }
  bake(scene, MINE_TEXTURES.rubble, 24, 10, (g) => {
    g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(12, 8, 22, 4);
    [
      [6, 6, 3],
      [12, 5, 4],
      [18, 7, 3],
    ].forEach(([x = 0, y = 0, r = 0]) => {
      g.fillStyle(WALL.base).fillCircle(x, y, r);
      g.fillStyle(WALL.light).fillCircle(x - 1, y - 1, r / 2);
    });
  });
  bake(scene, MINE_TEXTURES.pickaxe, 14, 14, (g) => {
    g.fillStyle(PALETTE.woodDark).fillRect(6, 3, 2, 11);
    g.fillStyle(0x8a8278).fillTriangle(0, 4, 7, 0, 7, 4);
    g.fillStyle(0xc8d0d8).fillTriangle(14, 4, 7, 0, 7, 4);
  });
  bake(scene, MINE_TEXTURES.glow, 40, 24, (g) => {
    g.fillStyle(0xffd75e, 0.18).fillEllipse(20, 12, 40, 24);
    g.fillStyle(0xffd75e, 0.3).fillEllipse(20, 12, 20, 12);
  });
}

// Walls, timber supports and a daylit exit tunnel, filling the whole screen.
function bakeBackdrop(scene: Phaser.Scene): void {
  const width = Math.ceil(GAME_WIDTH / PIXEL_SCALE);
  const height = Math.ceil(GAME_HEIGHT / PIXEL_SCALE);
  const noise = createNoise(41);
  const buffer = new PixelBuffer(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = noise.fbm(x * 0.03, y * 0.05) + (bayer(x, y) - 0.5) * 0.08;
      const depth = y / height;
      const color = v < 0.38 ? WALL.deep : v < 0.5 ? WALL.dark : v < 0.66 ? WALL.base : WALL.light;
      buffer.set(x, y, depth < 0.12 && v < 0.55 ? WALL.deep : color);
      if (noise.hash(x, y) > 0.995) buffer.set(x, y, WALL.edge);
    }
  }
  for (const postX of [36, 120, 306, 390]) supportBeam(buffer, postX, 40, 150);
  exitTunnel(buffer, 26, 170);
  buffer.toTexture(scene, MINE_TEXTURES.backdrop);
}

function supportBeam(buffer: PixelBuffer, x: number, top: number, bottom: number): void {
  for (let y = top; y < bottom; y++) {
    for (let dx = 0; dx < 5; dx++) {
      const color = dx === 0 ? PALETTE.woodLight : dx === 4 ? PALETTE.woodDarker : PALETTE.wood;
      buffer.set(x + dx, y, color);
    }
  }
  for (let dx = -8; dx < 13; dx++) {
    buffer.set(x + dx, top, PALETTE.woodLight);
    for (let dy = 1; dy < 5; dy++)
      buffer.set(x + dx, top + dy, dy === 4 ? PALETTE.woodDarker : PALETTE.wood);
  }
}

// An arched opening framed in timber, with daylight spilling in from outside.
function exitTunnel(buffer: PixelBuffer, x: number, y: number): void {
  const width = 30;
  const height = 44;
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const arch =
        dy < width / 2
          ? ((dx - width / 2) / (width / 2)) ** 2 + ((dy - width / 2) / (width / 2)) ** 2
          : 0;
      if (arch > 1) continue;
      const glow = dy > height - 10 ? 0xd8c088 : bayer(dx, dy) > dy / height ? DAYLIGHT : 0xe8d098;
      buffer.set(x + dx, y - height + dy, glow);
    }
  }
  supportBeam(buffer, x - 4, y - height - 2, y);
  supportBeam(buffer, x + width - 1, y - height - 2, y);
}

function bakeFloor(scene: Phaser.Scene): void {
  const { columns, rows, tileW, tileH } = MINE_FLOOR;
  const width = ((columns + rows) * tileW) / 2;
  const height = ((columns + rows) * tileH) / 2 + 8;
  const noise = createNoise(77);
  const buffer = new PixelBuffer(width, height);
  for (let y = 0; y < height - 8; y++) {
    for (let x = 0; x < width; x++) {
      const a = (x - (rows * tileW) / 2) / (tileW / 2);
      const b = y / (tileH / 2);
      const col = (a + b) / 2;
      const row = (b - a) / 2;
      if (col < 0 || row < 0 || col > columns || row > rows) continue;
      const seam = Math.abs(col - Math.round(col)) < 0.04 || Math.abs(row - Math.round(row)) < 0.06;
      const v = noise.fbm(x * 0.12, y * 0.2) + (bayer(x, y) - 0.5) * 0.1;
      const rail = Math.abs(row - 6.5) < 0.05 || Math.abs(row - 6.9) < 0.05;
      const color = rail
        ? 0x8a8278
        : seam
          ? FLOOR.crack
          : v < 0.42
            ? FLOOR.dark
            : v < 0.62
              ? FLOOR.base
              : FLOOR.light;
      buffer.set(x, y, color);
    }
  }
  // A lip of rock under the floor's front edges.
  for (let x = 0; x < width; x++) {
    const edge =
      x < (rows * tileW) / 2
        ? (x / (tileW / 2)) * (tileH / 2) + (rows * tileH) / 2
        : ((width - x) / (tileW / 2)) * (tileH / 2) + (columns * tileH) / 2;
    for (let dy = 0; dy < 8; dy++)
      buffer.set(x, Math.floor(edge) + dy, dy < 2 ? WALL.light : WALL.dark);
  }
  buffer.toTexture(scene, MINE_TEXTURES.floor);
}

function drawDeposit(g: Phaser.GameObjects.Graphics, id: string): void {
  const flecks = ORE_FLECKS[id] ?? ORE_FLECKS.stone ?? [0xffffff];
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(17, 27, 30, 6);
  g.fillStyle(WALL.deep).fillEllipse(17, 18, 30, 20);
  g.fillStyle(WALL.base).fillEllipse(16, 17, 26, 16);
  g.fillStyle(WALL.light).fillEllipse(12, 13, 12, 7);
  g.fillStyle(WALL.edge).fillRect(9, 11, 4, 1);
  const spots: Array<[number, number]> = [
    [10, 18],
    [20, 14],
    [24, 20],
    [15, 22],
    [18, 18],
    [8, 15],
  ];
  spots.forEach(([x, y], i) => {
    g.fillStyle(flecks[i % flecks.length] ?? 0xffffff).fillRect(x, y, 2 + (i % 2), 2);
  });
  if (id !== 'gem') return;
  for (const [x, h] of [
    [12, 12],
    [17, 16],
    [22, 11],
  ] as const) {
    g.fillStyle(0x6a4a9a).fillTriangle(x - 3, 16, x + 3, 16, x, 16 - h);
    g.fillStyle(0xe0c8f8).fillTriangle(x - 2, 16, x, 16, x, 16 - h + 2);
  }
}
