import type * as Phaser from 'phaser';
import type { IsoGrid } from '../iso/IsoGrid';
import type { FOLIAGE } from '../theme';
import { PALETTE, type FoliageColors } from '../theme';
import { bake, seededRandom, shade, SHADOW } from './paint';
import { lookFor, SEASON_LOOKS, seasonalKey, SNOW, type SeasonLook } from './seasonLooks';

export const PROP_TEXTURES = {
  treeOrange: 'tree-orange',
  treeAmber: 'tree-amber',
  treeRed: 'tree-red',
  bush: 'bush-autumn',
  rock: 'rock',
  pine: 'tree-pine',
  pineTall: 'tree-pine-tall',
} as const;

// Evergreens stay green; winter only adds snow on the boughs.
const PINE = { dark: 0x24503a, base: 0x356b45, light: 0x4f8a52, trunk: 0x5a3a22 } as const;

const BASE_TILE_WIDTH = 128;
const TREES: Array<[key: string, family: keyof typeof FOLIAGE, seed: number]> = [
  [PROP_TEXTURES.treeOrange, 'orange', 11],
  [PROP_TEXTURES.treeAmber, 'amber', 23],
  [PROP_TEXTURES.treeRed, 'red', 37],
];

/** Every prop gets a variant per season; the base key is the autumn look used for icons. */
export function generatePropTextures(scene: Phaser.Scene, grid: IsoGrid): void {
  bakeProps(scene, grid, lookFor('autumn'), (key) => key);
  for (const seasonId of Object.keys(SEASON_LOOKS)) {
    bakeProps(scene, grid, lookFor(seasonId), (key) => seasonalKey(key, seasonId));
  }
}

function bakeProps(
  scene: Phaser.Scene,
  grid: IsoGrid,
  look: SeasonLook,
  keyFor: (key: string) => string,
): void {
  const w = grid.art.tileW;
  const s = w / BASE_TILE_WIDTH;
  for (const [key, family, seed] of TREES) {
    bake(scene, keyFor(key), w * 0.8, w * 1.15, (g) =>
      drawTree(g, w * 0.4, w * 1.1, s, look.foliage[family], look.snow, seed),
    );
  }
  bake(scene, keyFor(PROP_TEXTURES.pine), w * 0.6, w * 1.1, (g) =>
    drawPine(g, w * 0.3, w * 1.06, s, 1, look.snow),
  );
  bake(scene, keyFor(PROP_TEXTURES.pineTall), w * 0.7, w * 1.45, (g) =>
    drawPine(g, w * 0.35, w * 1.4, s, 1.35, look.snow),
  );
  bake(scene, keyFor(PROP_TEXTURES.bush), w * 0.5, w * 0.4, (g) =>
    drawBush(g, w * 0.25, w * 0.37, s, look.foliage.red, look.snow),
  );
  bake(scene, keyFor(PROP_TEXTURES.rock), w * 0.4, w * 0.25, (g) =>
    drawRock(g, w * 0.2, w * 0.22, s, look.snow),
  );
}

function drawTree(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  colors: FoliageColors | null,
  snow: boolean,
  seed: number,
): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(x, y - 4 * s, 70 * s, 22 * s);
  g.fillStyle(PALETTE.trunk).fillRect(x - 6 * s, y - 50 * s, 12 * s, 46 * s);
  g.fillStyle(shade(PALETTE.trunk, 0.7)).fillRect(x + 2 * s, y - 50 * s, 4 * s, 46 * s);
  if (!colors) {
    drawBareBranches(g, x, y, s, snow);
    return;
  }
  g.fillStyle(colors.dark).fillCircle(x, y - 74 * s, 40 * s);
  g.fillStyle(colors.base).fillCircle(x - 16 * s, y - 86 * s, 28 * s);
  g.fillStyle(colors.base).fillCircle(x + 16 * s, y - 92 * s, 26 * s);
  g.fillStyle(colors.light).fillCircle(x - 8 * s, y - 104 * s, 15 * s);

  const random = seededRandom(seed);
  for (let i = 0; i < 26; i++) {
    const angle = random() * Math.PI * 2;
    const radius = random() * 34 * s;
    g.fillStyle(random() > 0.5 ? colors.light : colors.dark);
    g.fillRect(x + Math.cos(angle) * radius, y - 82 * s + Math.sin(angle) * radius, 2, 1);
  }
}

// Stacked bough tiers, each a flat triangle with a lit left flank and a shaded right one.
function drawPine(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  height: number,
  snow: boolean,
): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(x, y - 4 * s, 52 * s, 16 * s);
  g.fillStyle(PINE.trunk).fillRect(x - 4 * s, y - 26 * s, 8 * s, 24 * s);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const base = y - (22 + i * 24) * s * height;
    const half = (34 - i * 6) * s;
    const top = base - 34 * s * height;
    g.fillStyle(PINE.dark).fillTriangle(x - half, base, x + half, base, x, top);
    g.fillStyle(PINE.base).fillTriangle(x - half, base, x, base, x, top);
    g.fillStyle(PINE.light).fillTriangle(
      x - half * 0.7,
      base - 3 * s,
      x - half * 0.2,
      base - 3 * s,
      x - 2 * s,
      top + 8 * s,
    );
    if (snow) {
      g.fillStyle(SNOW.light).fillTriangle(
        x - half * 0.45,
        top + 16 * s,
        x + half * 0.3,
        top + 16 * s,
        x,
        top,
      );
      g.fillStyle(SNOW.shade).fillRect(x - half, base - 2 * s, half * 2, 2 * s);
    }
  }
}

// Winter silhouette: forked limbs with snow resting on the upper sides.
function drawBareBranches(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  snow: boolean,
): void {
  const limbs: Array<[number, number, number, number]> = [
    [0, -50, -26, -88],
    [0, -56, 24, -96],
    [0, -50, 2, -110],
    [-14, -72, -34, -82],
    [12, -78, 32, -86],
    [1, -90, -12, -104],
  ];
  g.lineStyle(2, PALETTE.trunk);
  for (const [x0, y0, x1, y1] of limbs)
    g.lineBetween(x + x0 * s, y + y0 * s, x + x1 * s, y + y1 * s);
  g.lineStyle(1, shade(PALETTE.trunk, 0.7));
  for (const [x0, , x1, y1] of limbs) {
    g.lineBetween(x + x1 * s, y + y1 * s, x + (x1 + (x1 - x0) * 0.3) * s, y + (y1 - 6) * s);
  }
  if (!snow) return;
  g.fillStyle(SNOW.light);
  for (const [, , x1, y1] of limbs) g.fillRect(x + x1 * s - 1, y + y1 * s - 1, 3, 1);
  g.fillStyle(SNOW.shade).fillEllipse(x, y - 2 * s, 40 * s, 10 * s);
}

function drawBush(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  colors: FoliageColors | null,
  snow: boolean,
): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(x, y - 2 * s, 56 * s, 14 * s);
  if (!colors) {
    g.lineStyle(1, PALETTE.trunk);
    for (const dx of [-12, -4, 4, 12]) g.lineBetween(x, y - 2 * s, x + dx * s, y - 26 * s);
    if (snow) g.fillStyle(SNOW.light).fillEllipse(x, y - 6 * s, 34 * s, 10 * s);
    return;
  }
  g.fillStyle(colors.dark).fillCircle(x - 10 * s, y - 14 * s, 15 * s);
  g.fillStyle(colors.base).fillCircle(x + 10 * s, y - 16 * s, 16 * s);
  g.fillStyle(colors.light).fillCircle(x, y - 24 * s, 11 * s);
}

function drawRock(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  s: number,
  snow: boolean,
): void {
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(x, y, 44 * s, 12 * s);
  g.fillStyle(PALETTE.rockDark).fillEllipse(x, y - 8 * s, 40 * s, 24 * s);
  g.fillStyle(PALETTE.rock).fillEllipse(x - 4 * s, y - 12 * s, 30 * s, 16 * s);
  g.fillStyle(shade(PALETTE.rock, 1.2)).fillEllipse(x - 8 * s, y - 16 * s, 12 * s, 6 * s);
  if (snow) g.fillStyle(SNOW.light).fillEllipse(x - 2 * s, y - 17 * s, 28 * s, 8 * s);
}
