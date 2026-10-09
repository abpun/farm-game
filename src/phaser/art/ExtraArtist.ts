import type * as Phaser from 'phaser';
import { diamondPoint, insetDiamond, type IsoGrid } from '../iso/IsoGrid';
import { PALETTE } from '../theme';
import { maskSize, paintTexture, type MaskPalette } from '../ui/pixelPaint';
import { bake, fillPoly, shade, SHADOW, strokePoly } from './paint';

export const EXTRA_TEXTURES = {
  orchardPlot: 'orchard-plot',
  scarecrow: 'scarecrow',
  fishStatue: 'fish-statue',
  bobber: 'bobber',
  lockedTile: 'land-locked',
  bubble: 'status-bubble',
} as const;

export const animalTextureKey = (animalId: string) => `animal-${animalId}`;

const ANIMAL_PALETTE: MaskPalette = {
  o: 0x3a1f0e,
  w: 0xfff1d0,
  W: 0xffffff,
  b: 0x8a5a32,
  B: 0xd9b06a,
  k: 0x4a3a30,
  p: 0xf4b6c8,
  P: 0xe08aa0,
  y: 0xf6c544,
  r: 0xb8432a,
  g: 0xb8b0a0,
  G: 0x8a8278,
};

// Tiny side-on animals that wander their yards; one art pixel per mask cell.
const ANIMALS: Record<string, readonly string[]> = {
  chicken: ['..r....', '.owo...', 'yowwoo.', '.owwwwo', '.owwwwo', '..oyo..', '..y.y..'],
  cow: [
    'o.......o...',
    'owo...owwo..',
    '.owwwwwkwwo.',
    'okwwkkwwwwwo',
    'owwwwwwkkwpo',
    '.owwwwwwwoo.',
    '.ok.ok.ok...',
    '.o..o..o....',
  ],
  sheep: ['..ooooo....', '.oWWWWWoo..', 'oWWWWWWWkko', 'oWWWWWWWkko', '.oWWWWWoo..', '..ok.ok....'],
  goat: [
    '.......oo.',
    '.......ogo',
    '..oooooggo',
    '.ogggggggo',
    'oggGgggoo.',
    '.ogggggo..',
    '..ok.ok...',
  ],
  pig: ['.o.....o..', '.oppppppo.', 'opppppppPo', 'oppppppPPo', '.oppppppo.', '..oP.oP...'],
};

const FISH_STATUE = [
  '..oooo....',
  '.oyyyyoo.o',
  'oyyoyyyyoo',
  'oyyyyyyyyo',
  '.oyyyyoo.o',
  '..oooo....',
  '...ogo....',
  '..ogggo...',
  '.ogGGGgo..',
  '.ooooooo..',
];

const SCARECROW = [
  '...ooo....',
  '..oBBBo...',
  '.ooooooo..',
  '..owkwo...',
  '..owwwo...',
  'oooorooooo',
  'oBrrrrrrBo',
  'ooorrrrooo',
  '...orro...',
  '...obbo...',
  '...obbo...',
  '...obbo...',
];

export function generateExtraTextures(scene: Phaser.Scene, grid: IsoGrid): void {
  const { tileW: w, tileH: h } = grid.art;
  for (const [id, rows] of Object.entries(ANIMALS)) {
    const { width, height } = maskSize(rows);
    paintTexture(scene, animalTextureKey(id), width, height, (p) => p.mask(rows, ANIMAL_PALETTE));
  }
  const statuePalette = { ...ANIMAL_PALETTE, y: 0xf6c544 };
  paintTexture(scene, EXTRA_TEXTURES.fishStatue, 10, FISH_STATUE.length, (p) =>
    p.mask(FISH_STATUE, statuePalette),
  );
  paintTexture(scene, EXTRA_TEXTURES.scarecrow, 10, SCARECROW.length, (p) =>
    p.mask(SCARECROW, ANIMAL_PALETTE),
  );

  // Orchard plot: grass ring with a mulched, mounded circle for a tree.
  bake(scene, EXTRA_TEXTURES.orchardPlot, w, h, (g) => {
    g.fillStyle(PALETTE.grassShadow);
    fillPoly(g, insetDiamond(w, h, 0.96));
    g.fillStyle(PALETTE.grassDark);
    fillPoly(g, insetDiamond(w, h, 0.88));
    const c = diamondPoint(0.5, 0.5, w, h);
    g.fillStyle(PALETTE.soilDark).fillEllipse(c.x, c.y + 1, w * 0.46, h * 0.46);
    g.fillStyle(PALETTE.soil).fillEllipse(c.x, c.y, w * 0.4, h * 0.38);
    g.fillStyle(shade(PALETTE.soil, 1.2)).fillRect(Math.round(c.x - 3), Math.round(c.y - 2), 2, 1);
  });

  bake(scene, EXTRA_TEXTURES.lockedTile, w, h, (g) => {
    g.fillStyle(0x3a2414, 0.35);
    fillPoly(g, insetDiamond(w, h, 1));
    g.lineStyle(1, 0xe6cf98, 0.6);
    strokePoly(g, insetDiamond(w, h, 0.9));
  });

  bake(scene, EXTRA_TEXTURES.bobber, 5, 7, (g) => {
    g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(2.5, 6, 5, 2);
    g.fillStyle(0xe0603a).fillRect(1, 1, 3, 2);
    g.fillStyle(0xffffff).fillRect(1, 3, 3, 2);
    g.fillStyle(0x3a1f0e).fillRect(2, 0, 1, 1);
  });

  paintTexture(scene, EXTRA_TEXTURES.bubble, 14, 16, (p) => {
    p.rect(1, 0, 12, 1, 0x3a1f0e).rect(1, 13, 12, 1, 0x3a1f0e);
    p.rect(0, 1, 1, 12, 0x3a1f0e).rect(13, 1, 1, 12, 0x3a1f0e);
    p.rect(1, 1, 12, 12, 0xfff1d0).rect(1, 11, 12, 2, 0xe2bd7c);
    p.rect(5, 14, 4, 1, 0x3a1f0e).rect(6, 15, 2, 1, 0x3a1f0e).rect(6, 13, 2, 1, 0xe2bd7c);
  });
}

/** Art-pixel corners of a pier running from a shore point in a grid direction. */
export interface PierGeometry {
  key: string;
  /** Screen position of the texture's top-left corner. */
  x: number;
  y: number;
}

/**
 * Bakes a plank pier between two grid points and returns where to place it.
 * `toScreen` maps grid coords to world px; the texture is drawn in art px.
 */
export function bakePier(
  scene: Phaser.Scene,
  key: string,
  corners: Array<{ x: number; y: number }>,
  pixelScale: number,
  planks: number,
): PierGeometry {
  const xs = corners.map((p) => p.x / pixelScale);
  const ys = corners.map((p) => p.y / pixelScale);
  const left = Math.floor(Math.min(...xs)) - 2;
  const top = Math.floor(Math.min(...ys)) - 2;
  const width = Math.ceil(Math.max(...xs)) - left + 2;
  const height = Math.ceil(Math.max(...ys)) - top + 10;
  const local = corners.map((p) => ({ x: p.x / pixelScale - left, y: p.y / pixelScale - top }));
  bake(scene, key, width, height, (g) => {
    const [a, b, c, d] = local as [
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
    ];
    g.fillStyle(PALETTE.woodDarker);
    for (const post of [a, b, c, d]) g.fillRect(Math.round(post.x), Math.round(post.y), 2, 7);
    g.fillStyle(PALETTE.wood);
    fillPoly(g, [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]);
    g.lineStyle(1, PALETTE.woodDark);
    for (let i = 1; i < planks; i++) {
      const t = i / planks;
      g.lineBetween(
        a.x + (d.x - a.x) * t,
        a.y + (d.y - a.y) * t,
        b.x + (c.x - b.x) * t,
        b.y + (c.y - b.y) * t,
      );
    }
    g.lineStyle(1, PALETTE.woodLight);
    g.lineBetween(a.x, a.y, d.x, d.y);
  });
  return { key, x: left * pixelScale, y: top * pixelScale };
}
