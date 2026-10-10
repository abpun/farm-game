import type * as Phaser from 'phaser';
import { PALETTE } from '../theme';
import { bake, SHADOW } from './paint';
import { ROCK } from './terrain/colors';

export const CAVE_TEXTURES = {
  open: 'cave-entrance',
  boarded: 'cave-entrance-boarded',
  cart: 'mine-cart',
  lantern: 'mine-lantern',
} as const;

export const CAVE_SIZE = { width: 96, height: 74 } as const;
const MOUTH = { x: 34, y: 26, width: 28, height: 34 } as const;
const DARK = 0x1c1614;
const DEEPER = 0x0e0a0a;
const LANTERN = 0xffd75e;

/** Entrance in a boulder outcrop at the woods' edge: timber frame, rails and a cart of ore. */
export function generateCaveTextures(scene: Phaser.Scene): void {
  bake(scene, CAVE_TEXTURES.open, CAVE_SIZE.width, CAVE_SIZE.height, (g) => drawCave(g, false));
  bake(scene, CAVE_TEXTURES.boarded, CAVE_SIZE.width, CAVE_SIZE.height, (g) => drawCave(g, true));
  bake(scene, CAVE_TEXTURES.cart, 22, 16, (g) => drawCart(g, 1, 2));
  bake(scene, CAVE_TEXTURES.lantern, 6, 12, (g) => drawLantern(g, 3, 1));
}

function drawCave(g: Phaser.GameObjects.Graphics, boarded: boolean): void {
  const { width, height } = CAVE_SIZE;
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(width / 2, height - 6, width - 6, 14);
  // Boulders heaped around the mouth, lit from the upper left.
  const boulders: Array<[number, number, number, number]> = [
    [20, 38, 34, 40],
    [76, 40, 34, 38],
    [48, 20, 52, 30],
    [14, 56, 22, 18],
    [84, 58, 22, 18],
  ];
  for (const [x, y, w, h] of boulders) {
    g.fillStyle(ROCK.deep).fillEllipse(x, y, w, h);
    g.fillStyle(ROCK.dark).fillEllipse(x - 1, y - 1, w - 4, h - 4);
    g.fillStyle(ROCK.base).fillEllipse(x - 4, y - 4, w * 0.6, h * 0.55);
    g.fillStyle(ROCK.light).fillEllipse(x - 7, y - 7, w * 0.25, h * 0.2);
  }
  g.fillStyle(DARK).fillRect(MOUTH.x, MOUTH.y + 8, MOUTH.width, MOUTH.height - 8);
  g.fillStyle(DARK).fillEllipse(MOUTH.x + MOUTH.width / 2, MOUTH.y + 9, MOUTH.width, 18);
  g.fillStyle(DEEPER).fillRect(MOUTH.x + 6, MOUTH.y + 14, MOUTH.width - 12, MOUTH.height - 14);
  drawTimbers(g);
  drawRails(g);
  if (boarded) drawBoards(g);
  else drawCart(g, MOUTH.x + 24, MOUTH.y + MOUTH.height - 4);
  drawLantern(g, MOUTH.x - 6, MOUTH.y + 6);
}

function drawTimbers(g: Phaser.GameObjects.Graphics): void {
  const left = MOUTH.x - 2;
  const right = MOUTH.x + MOUTH.width - 2;
  const top = MOUTH.y + 4;
  const bottom = MOUTH.y + MOUTH.height;
  g.fillStyle(PALETTE.woodDarker).fillRect(left, top, 5, bottom - top);
  g.fillStyle(PALETTE.woodDarker).fillRect(right - 1, top, 5, bottom - top);
  g.fillStyle(PALETTE.wood).fillRect(left + 1, top, 2, bottom - top);
  g.fillStyle(PALETTE.wood).fillRect(right, top, 2, bottom - top);
  g.fillStyle(PALETTE.woodDarker).fillRect(left - 3, top - 3, MOUTH.width + 10, 6);
  g.fillStyle(PALETTE.woodLight).fillRect(left - 2, top - 2, MOUTH.width + 8, 2);
}

function drawRails(g: Phaser.GameObjects.Graphics): void {
  const startX = MOUTH.x + 8;
  const startY = MOUTH.y + MOUTH.height;
  g.fillStyle(PALETTE.woodDark);
  for (let i = 0; i < 4; i++) g.fillRect(startX - 2 + i * 4, startY + 2 + i * 3, 16, 2);
  g.lineStyle(1, 0x8a8278);
  g.lineBetween(startX, startY, startX + 14, startY + 13);
  g.lineBetween(startX + 10, startY, startX + 24, startY + 13);
}

function drawBoards(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(PALETTE.wood);
  for (let i = 0; i < 4; i++) g.fillRect(MOUTH.x + 1, MOUTH.y + 12 + i * 6, MOUTH.width - 2, 4);
  g.fillStyle(PALETTE.woodDark);
  for (let i = 0; i < 4; i++) g.fillRect(MOUTH.x + 1, MOUTH.y + 15 + i * 6, MOUTH.width - 2, 1);
  g.fillStyle(0xb8432a).fillRect(MOUTH.x + 8, MOUTH.y + 18, 12, 8);
  g.fillStyle(0xfff1d0).fillRect(MOUTH.x + 10, MOUTH.y + 20, 8, 1);
  g.fillStyle(0xfff1d0).fillRect(MOUTH.x + 10, MOUTH.y + 23, 6, 1);
}

function drawCart(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x3a3434).fillRect(x, y - 2, 4, 4);
  g.fillStyle(0x3a3434).fillRect(x + 14, y - 2, 4, 4);
  g.fillStyle(0x5e574f).fillRect(x - 1, y - 11, 20, 9);
  g.fillStyle(0x8a8278).fillRect(x, y - 10, 18, 2);
  g.fillStyle(0x76716a).fillRect(x, y - 8, 18, 5);
  const ore = [0xe08a4a, 0xa8a49a, 0xc8d0d8, 0x4a4448, 0xe08a4a];
  ore.forEach((color, i) => g.fillStyle(color).fillRect(x + 1 + i * 3.5, y - 14 + (i % 2), 3, 3));
}

function drawLantern(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(PALETTE.woodDarker).fillRect(x, y, 1, 10);
  g.fillStyle(0x3a3434).fillRect(x - 2, y + 1, 5, 6);
  g.fillStyle(LANTERN).fillRect(x - 1, y + 2, 3, 4);
}
