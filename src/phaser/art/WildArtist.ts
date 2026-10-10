import type * as Phaser from 'phaser';
import { PALETTE } from '../theme';
import { bake, SHADOW, shade } from './paint';
import { SEASON_LOOKS, seasonalKey } from './seasonLooks';
import { ROCK } from './TerrainArtist';

export const WILD_TEXTURES = {
  chest: 'wild-chest',
  chestOpen: 'wild-chest-open',
  crate: 'wild-crate',
  bench: 'wild-bench',
  rockfall: 'wild-rockfall',
  cairn: 'wild-cairn',
  cairnFlag: 'wild-cairn-flag',
  signpost: 'wild-signpost',
  reeds: 'wild-reeds',
  lily: 'wild-lily',
  shell: 'wild-shell',
  driftwood: 'wild-driftwood',
  hay: 'wild-hay',
  sparkle: 'wild-sparkle',
  hedge: 'wild-hedge',
} as const;

// Box-hedge greens by season: [dark, base, light]; winter keeps them under snow.
const HEDGE: Record<string, [number, number, number]> = {
  spring: [0x4f8f34, 0x6faa3e, 0x9ccc5a],
  summer: [0x356f2c, 0x4f8f34, 0x79bf4c],
  autumn: [0x6e6a2a, 0x8a8a34, 0xb8a848],
  winter: [0x4a6a44, 0x5e7a52, 0xf4f8fc],
};

const BRASS = 0xf6c544;
const REEDS: Record<string, [number, number, number]> = {
  spring: [0x6a9a3e, 0x8cbf4a, 0x7a5a3a],
  summer: [0x568a36, 0x7cb342, 0x6e4423],
  autumn: [0xb8903e, 0xd9b25a, 0x6e4423],
  winter: [0xc4b898, 0xe2d8c0, 0x8a7a5a],
};

export function generateWildTextures(scene: Phaser.Scene): void {
  bake(scene, WILD_TEXTURES.chest, 16, 14, (g) => drawChest(g, false));
  bake(scene, WILD_TEXTURES.chestOpen, 16, 14, (g) => drawChest(g, true));
  bake(scene, WILD_TEXTURES.crate, 26, 14, drawCrate);
  bake(scene, WILD_TEXTURES.bench, 22, 16, drawBench);
  bake(scene, WILD_TEXTURES.rockfall, 34, 22, drawRockfall);
  bake(scene, WILD_TEXTURES.cairn, 16, 26, (g) => drawCairn(g, false));
  bake(scene, WILD_TEXTURES.cairnFlag, 16, 26, (g) => drawCairn(g, true));
  bake(scene, WILD_TEXTURES.signpost, 16, 20, drawSignpost);
  bake(scene, WILD_TEXTURES.shell, 4, 3, (g) => {
    g.fillStyle(0xf4d0d8).fillRect(0, 1, 4, 2);
    g.fillStyle(0xfff1d0).fillRect(1, 0, 2, 1);
  });
  bake(scene, WILD_TEXTURES.driftwood, 18, 6, (g) => {
    g.fillStyle(0xa89a84).fillRect(1, 2, 16, 3);
    g.fillStyle(0xc8bca4).fillRect(2, 2, 13, 1);
    g.fillStyle(0x7a6e5e).fillRect(0, 3, 2, 2);
    g.fillStyle(0x7a6e5e).fillRect(12, 0, 2, 2);
  });
  bake(scene, WILD_TEXTURES.hay, 12, 10, (g) => {
    g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(6, 9, 12, 3);
    g.fillStyle(PALETTE.thatchDark).fillEllipse(6, 5, 12, 9);
    g.fillStyle(PALETTE.thatch).fillEllipse(5, 4, 9, 6);
    g.fillStyle(PALETTE.thatchLight).fillRect(3, 2, 4, 1);
    g.fillStyle(0x8a5a32).fillRect(5, 1, 1, 8);
  });
  bake(scene, WILD_TEXTURES.sparkle, 5, 5, (g) => {
    g.fillStyle(0xfff3c0).fillRect(2, 0, 1, 5).fillRect(0, 2, 5, 1);
    g.fillStyle(0xffffff).fillRect(2, 2, 1, 1);
  });
  for (const seasonId of Object.keys(SEASON_LOOKS)) {
    const reeds = REEDS[seasonId] ?? REEDS.autumn ?? [0, 0, 0];
    bake(scene, seasonalKey(WILD_TEXTURES.reeds, seasonId), 10, 14, (g) => drawReeds(g, reeds));
    const hedge = HEDGE[seasonId] ?? HEDGE.summer ?? [0, 0, 0];
    bake(scene, seasonalKey(WILD_TEXTURES.hedge, seasonId), 18, 12, (g) => drawHedge(g, hedge));
    bake(scene, seasonalKey(WILD_TEXTURES.lily, seasonId), 10, 5, (g) =>
      drawLily(g, seasonId === 'spring' || seasonId === 'summer', seasonId === 'winter'),
    );
  }
}

function drawChest(g: Phaser.GameObjects.Graphics, open: boolean): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(8, 13, 16, 3);
  g.fillStyle(PALETTE.woodDarker).fillRect(1, 5, 14, 8);
  g.fillStyle(PALETTE.wood).fillRect(2, 6, 12, 6);
  g.fillStyle(BRASS).fillRect(1, 8, 14, 1);
  if (open) {
    g.fillStyle(0x3a2414).fillRect(2, 4, 12, 2);
    g.fillStyle(PALETTE.woodDark).fillRect(2, 0, 12, 4);
    g.fillStyle(BRASS).fillRect(4, 3, 8, 2);
    return;
  }
  g.fillStyle(PALETTE.woodDark).fillRect(1, 2, 14, 4);
  g.fillStyle(PALETTE.woodLight).fillRect(2, 2, 12, 1);
  g.fillStyle(BRASS).fillRect(7, 5, 2, 3);
}

function drawCrate(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(13, 13, 26, 3);
  g.fillStyle(0x9a8a70).fillRect(2, 2, 12, 10);
  g.fillStyle(0xbcae92).fillRect(3, 3, 10, 8);
  g.lineStyle(1, 0x7a6e5e).lineBetween(3, 3, 12, 10).lineBetween(12, 3, 3, 10);
  g.fillStyle(0xa89a84).fillRect(14, 9, 11, 3);
  g.fillStyle(0xc8bca4).fillRect(15, 9, 8, 1);
}

function drawBench(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(11, 15, 20, 3);
  g.fillStyle(PALETTE.woodDarker).fillRect(3, 9, 2, 6).fillRect(15, 9, 2, 6);
  g.fillStyle(PALETTE.wood).fillRect(1, 8, 18, 3);
  g.fillStyle(PALETTE.woodLight).fillRect(1, 8, 18, 1);
  g.fillStyle(PALETTE.wood).fillRect(1, 3, 18, 3);
  g.fillStyle(PALETTE.woodDarker).fillRect(19, 0, 2, 15);
  g.fillStyle(0xfff1d0).fillRect(18, 1, 4, 3);
}

function drawRockfall(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(17, 20, 32, 4);
  const stones: Array<[number, number, number]> = [
    [9, 14, 8],
    [22, 15, 9],
    [15, 8, 7],
    [27, 9, 5],
    [5, 7, 4],
  ];
  for (const [x, y, r] of stones) {
    g.fillStyle(ROCK.deep).fillCircle(x, y, r);
    g.fillStyle(ROCK.base).fillCircle(x - 1, y - 1, r - 1);
    g.fillStyle(ROCK.light).fillCircle(x - r / 3, y - r / 3, r / 3);
  }
  g.fillStyle(PALETTE.woodDark).fillRect(2, 16, 30, 2);
}

function drawCairn(g: Phaser.GameObjects.Graphics, flag: boolean): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(8, 25, 14, 3);
  [
    [8, 22, 6],
    [8, 17, 4],
    [8, 13, 3],
  ].forEach(([x, y, r]) => {
    g.fillStyle(ROCK.dark).fillEllipse(x ?? 0, y ?? 0, (r ?? 0) * 2, r ?? 0);
    g.fillStyle(ROCK.light).fillEllipse((x ?? 0) - 1, (y ?? 0) - 1, r ?? 0, (r ?? 0) / 2);
  });
  g.fillStyle(PALETTE.woodDarker).fillRect(8, 0, 1, 12);
  const cloth = flag ? 0xb8432a : shade(0xb8432a, 0.5);
  if (flag) g.fillStyle(cloth).fillTriangle(9, 0, 9, 6, 15, 3);
  else g.fillStyle(cloth).fillRect(9, 7, 2, 4);
}

function drawSignpost(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(8, 19, 8, 2);
  g.fillStyle(PALETTE.woodDarker).fillRect(7, 2, 2, 17);
  g.fillStyle(PALETTE.wood).fillRect(2, 3, 12, 4);
  g.fillStyle(PALETTE.wood).fillTriangle(14, 3, 14, 7, 16, 5);
  g.fillStyle(PALETTE.woodLight).fillRect(1, 9, 12, 4);
  g.fillStyle(PALETTE.woodLight).fillTriangle(1, 9, 1, 13, -1, 11);
  g.fillStyle(PALETTE.woodDark).fillRect(3, 5, 9, 1).fillRect(2, 11, 9, 1);
}

function drawReeds(
  g: Phaser.GameObjects.Graphics,
  [dark, light, head]: [number, number, number],
): void {
  const stems: Array<[number, number]> = [
    [1, 9],
    [3, 13],
    [5, 11],
    [7, 12],
    [9, 8],
  ];
  for (const [x, h] of stems) {
    g.fillStyle(dark).fillRect(x, 14 - h, 1, h);
    g.fillStyle(light).fillRect(x, 14 - h, 1, Math.floor(h / 2));
  }
  g.fillStyle(head).fillRect(3, 1, 1, 3).fillRect(7, 2, 1, 3);
}

function drawHedge(
  g: Phaser.GameObjects.Graphics,
  [dark, base, light]: [number, number, number],
): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(9, 11, 18, 3);
  g.fillStyle(dark).fillEllipse(9, 7, 17, 9);
  g.fillStyle(base).fillEllipse(8, 6, 14, 7);
  g.fillStyle(light).fillEllipse(6, 4, 7, 3);
}

function drawLily(g: Phaser.GameObjects.Graphics, bloom: boolean, frozen: boolean): void {
  const pad = frozen ? 0x9fb2c8 : 0x4f8f34;
  g.fillStyle(pad).fillEllipse(4, 3, 8, 4);
  g.fillStyle(frozen ? 0xc4d2e2 : 0x7cc04a).fillEllipse(3, 2, 4, 2);
  if (bloom) g.fillStyle(0xf4b6c8).fillRect(6, 1, 2, 2);
}
