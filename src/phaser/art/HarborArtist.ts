import type * as Phaser from 'phaser';
import { PALETTE } from '../theme';
import { bake, SHADOW, shade } from './paint';
import { ROCK } from './terrain/colors';

export const HARBOR_TEXTURES = {
  dock: 'harbor-dock',
  boathouse: 'harbor-boathouse',
  goods: 'harbor-goods',
  forSale: 'harbor-for-sale',
  lighthouse: 'lighthouse',
  lighthouseGlow: 'lighthouse-glow',
  bridge: 'bridge',
} as const;

export const boatKey = (boatId: string) => `boat-${boatId}`;
export const isletKey = (size: number) => `islet-${size}`;

export const DOCK_SIZE = { width: 20, length: 76 } as const;
const BRIDGE = { width: 64, depth: 18 } as const;
const RED = 0xb8432a;
const WHITE = 0xf4f0e6;
const SAIL = 0xfff8ec;

export function generateHarborTextures(scene: Phaser.Scene): void {
  bake(scene, HARBOR_TEXTURES.dock, DOCK_SIZE.width + 16, DOCK_SIZE.length + 10, drawDock);
  bake(scene, HARBOR_TEXTURES.boathouse, 56, 46, drawBoathouse);
  bake(scene, HARBOR_TEXTURES.goods, 34, 18, drawGoods);
  bake(scene, HARBOR_TEXTURES.forSale, 14, 16, drawForSale);
  bake(scene, HARBOR_TEXTURES.lighthouse, 34, 86, drawLighthouse);
  bake(scene, HARBOR_TEXTURES.lighthouseGlow, 18, 10, (g) => {
    g.fillStyle(0xffe89a, 0.9).fillEllipse(9, 5, 18, 8);
    g.fillStyle(0xffffff).fillEllipse(9, 5, 6, 4);
  });
  bake(scene, HARBOR_TEXTURES.bridge, BRIDGE.width, BRIDGE.depth + 8, drawBridge);
  bake(scene, boatKey('rowboat'), 34, 18, (g) => drawHull(g, 34, 4, 0x8a5a32, false));
  bake(scene, boatKey('sailboat'), 40, 50, (g) => {
    drawHull(g, 40, 36, 0x3b6fb6, false);
    drawSail(g);
  });
  bake(scene, boatKey('trawler'), 48, 44, (g) => {
    drawHull(g, 48, 28, RED, true);
    drawCabin(g);
  });
  bake(scene, isletKey(0), 30, 22, drawRockStack);
  bake(scene, isletKey(1), 64, 34, (g) => drawIslet(g, 64, false));
  bake(scene, isletKey(2), 96, 60, (g) => drawIslet(g, 96, true));
}

// A plank walkway running straight out to sea, with a T-head for mooring.
function drawDock(g: Phaser.GameObjects.Graphics): void {
  const x = 8;
  const { width, length } = DOCK_SIZE;
  g.fillStyle(PALETTE.woodDarker);
  for (let y = 6; y < length; y += 14) {
    g.fillRect(x - 1, y, 2, 9);
    g.fillRect(x + width - 1, y, 2, 9);
  }
  for (let y = 0; y < length; y += 3) {
    g.fillStyle(y % 6 === 0 ? PALETTE.wood : PALETTE.woodLight).fillRect(x, y, width, 3);
    g.fillStyle(PALETTE.woodDark).fillRect(x, y + 2, width, 1);
  }
  const headY = length - 12;
  g.fillStyle(PALETTE.wood).fillRect(0, headY, width + 16, 9);
  g.fillStyle(PALETTE.woodLight).fillRect(0, headY, width + 16, 2);
  g.fillStyle(PALETTE.woodDarker).fillRect(0, headY + 9, width + 16, 2);
  for (const post of [1, width + 13])
    g.fillStyle(PALETTE.woodDarker).fillRect(post, headY - 4, 3, 7);
  g.fillStyle(0xd9b06a).fillCircle(4, headY - 3, 2);
}

function drawBoathouse(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(28, 42, 54, 10);
  g.fillStyle(PALETTE.woodDark).fillRect(6, 20, 44, 22);
  for (let x = 6; x < 50; x += 4) g.fillStyle(PALETTE.wood).fillRect(x, 20, 3, 22);
  g.fillStyle(0x3b4f63).fillRect(14, 26, 8, 7);
  g.fillStyle(0x7fa8de).fillRect(15, 27, 3, 3);
  g.fillStyle(PALETTE.woodDarker).fillRect(30, 26, 14, 16);
  g.fillStyle(PALETTE.woodDark).fillRect(32, 28, 10, 14);
  g.fillStyle(RED).fillTriangle(2, 22, 54, 22, 28, 4);
  g.fillStyle(shade(RED, 1.25)).fillTriangle(2, 22, 28, 22, 28, 4);
  g.fillStyle(shade(RED, 0.7)).fillRect(2, 21, 52, 2);
  g.fillStyle(WHITE).fillRect(24, 12, 8, 2);
}

function drawGoods(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(17, 16, 32, 5);
  g.fillStyle(PALETTE.woodDark).fillRect(2, 4, 12, 11);
  g.fillStyle(PALETTE.wood).fillRect(3, 5, 10, 9);
  g.fillStyle(PALETTE.woodDark).fillRect(3, 9, 10, 1);
  g.fillStyle(0x6e4423).fillEllipse(22, 10, 9, 12);
  g.fillStyle(0x9a6436).fillEllipse(21, 9, 6, 9);
  g.fillStyle(0x3a2414).fillRect(17, 8, 10, 1);
  g.fillStyle(0xd9b06a).fillEllipse(30, 13, 7, 4);
  g.fillStyle(0xb8903e).fillEllipse(30, 13, 3, 2);
}

function drawForSale(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(PALETTE.woodDarker).fillRect(6, 6, 2, 10);
  g.fillStyle(PALETTE.wood).fillRect(0, 0, 14, 8);
  g.fillStyle(0xffd75e).fillRect(2, 2, 3, 4);
  g.fillStyle(0x3a2414).fillRect(7, 2, 5, 1);
  g.fillStyle(0x3a2414).fillRect(7, 5, 4, 1);
}

function drawLighthouse(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(17, 82, 32, 8);
  g.fillStyle(ROCK.dark).fillEllipse(17, 78, 32, 12);
  g.fillStyle(ROCK.base).fillEllipse(14, 76, 22, 8);
  for (let y = 22; y < 76; y++) {
    const half = 6 + Math.floor((y - 22) / 13);
    const band = Math.floor((y - 22) / 9) % 2 === 0;
    g.fillStyle(band ? WHITE : RED).fillRect(17 - half, y, half * 2, 1);
    g.fillStyle(band ? 0xd6cfc2 : shade(RED, 0.75)).fillRect(17 + half - 3, y, 3, 1);
  }
  g.fillStyle(0x3a3434).fillRect(9, 18, 16, 4);
  g.fillStyle(0x2a3a4a).fillRect(11, 10, 12, 8);
  g.fillStyle(0xffe89a).fillRect(13, 11, 8, 6);
  g.fillStyle(0x3a3434).fillTriangle(9, 10, 25, 10, 17, 2);
  g.fillStyle(0x3b4f63).fillRect(15, 44, 4, 6);
}

function drawBridge(g: Phaser.GameObjects.Graphics): void {
  const { width, depth } = BRIDGE;
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillRect(2, depth + 2, width - 4, 4);
  for (let x = 0; x < width; x += 4) {
    g.fillStyle(x % 8 === 0 ? PALETTE.wood : PALETTE.woodLight).fillRect(x, 6, 4, depth - 4);
    g.fillStyle(PALETTE.woodDark).fillRect(x + 3, 6, 1, depth - 4);
  }
  for (const y of [2, depth]) {
    g.fillStyle(PALETTE.woodDarker).fillRect(0, y + 2, width, 2);
    g.fillStyle(PALETTE.woodLight).fillRect(0, y + 1, width, 1);
    for (let x = 0; x <= width - 3; x += 15)
      g.fillStyle(PALETTE.woodDarker).fillRect(x, y - 3, 3, 8);
  }
}

function drawHull(
  g: Phaser.GameObjects.Graphics,
  width: number,
  top: number,
  color: number,
  deep: boolean,
): void {
  const h = deep ? 14 : 10;
  g.fillStyle(0x1a4a66, 0.5).fillEllipse(width / 2, top + h + 2, width, 6);
  g.fillStyle(shade(color, 0.6)).fillRect(4, top + 2, width - 8, h - 2);
  g.fillStyle(color).fillRect(2, top, width - 4, h - 4);
  g.fillStyle(shade(color, 1.3)).fillRect(2, top, width - 4, 2);
  g.fillStyle(WHITE).fillRect(4, top + h - 5, width - 8, 1);
  g.fillStyle(PALETTE.woodDark).fillRect(6, top - 2, width - 12, 3);
}

function drawSail(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(PALETTE.woodDarker).fillRect(19, 2, 2, 36);
  g.fillStyle(SAIL).fillTriangle(21, 4, 21, 34, 36, 34);
  g.fillStyle(0xe2d8c4).fillTriangle(21, 20, 21, 34, 30, 34);
  g.fillStyle(SAIL).fillTriangle(18, 8, 18, 32, 8, 32);
  g.fillStyle(RED).fillRect(21, 2, 6, 3);
}

function drawCabin(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(WHITE).fillRect(14, 16, 18, 14);
  g.fillStyle(0xd6cfc2).fillRect(28, 16, 4, 14);
  g.fillStyle(0x3b4f63).fillRect(17, 19, 5, 4);
  g.fillStyle(0x3b4f63).fillRect(24, 19, 3, 4);
  g.fillStyle(RED).fillRect(12, 13, 22, 3);
  g.fillStyle(PALETTE.woodDarker).fillRect(38, 2, 2, 28);
  g.lineStyle(1, 0x5a4a3a).lineBetween(39, 4, 46, 30);
  g.fillStyle(0x3a3434).fillRect(18, 9, 4, 4);
}

function drawRockStack(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xe8f6f2, 0.8).fillEllipse(15, 19, 30, 5);
  g.fillStyle(ROCK.deep).fillTriangle(4, 19, 26, 19, 13, 2);
  g.fillStyle(ROCK.base).fillTriangle(4, 19, 13, 19, 13, 2);
  g.fillStyle(ROCK.light).fillTriangle(7, 16, 11, 16, 12, 6);
  g.fillStyle(0xfff1d0).fillRect(12, 2, 2, 2);
}

// Sandy islands with palms; the big one carries a little lantern tower (Lantern Isle).
function drawIslet(g: Phaser.GameObjects.Graphics, width: number, lantern: boolean): void {
  const h = width * 0.32;
  const cx = width / 2;
  const base = width * 0.55;
  g.fillStyle(0xe8f6f2, 0.8).fillEllipse(cx, base + 2, width - 2, h * 0.7);
  g.fillStyle(PALETTE.sandShade).fillEllipse(cx, base, width - 8, h * 0.6);
  g.fillStyle(PALETTE.sand).fillEllipse(cx - 2, base - 2, width - 14, h * 0.45);
  g.fillStyle(0x4f8f34).fillEllipse(cx, base - h * 0.35, width * 0.55, h * 0.6);
  g.fillStyle(0x7cc04a).fillEllipse(cx - 4, base - h * 0.45, width * 0.35, h * 0.35);
  for (const [px, tilt] of [
    [cx - width * 0.22, -1],
    [cx + width * 0.18, 1],
  ] as const) {
    g.fillStyle(PALETTE.trunk).fillRect(px, base - h * 1.1, 2, h * 0.75);
    g.fillStyle(0x356f2c).fillEllipse(px + tilt * 3, base - h * 1.15, 14, 5);
    g.fillStyle(0x4f9a3a).fillEllipse(px - tilt * 3, base - h * 1.2, 12, 4);
  }
  if (!lantern) return;
  g.fillStyle(WHITE).fillRect(cx + 4, base - h * 1.25, 6, h * 0.7);
  g.fillStyle(RED).fillRect(cx + 3, base - h * 1.35, 8, 3);
  g.fillStyle(0xffe89a).fillRect(cx + 5, base - h * 1.32, 4, 2);
}
