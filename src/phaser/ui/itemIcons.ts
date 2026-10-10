import type * as Phaser from 'phaser';
import type { Content } from '@core/config/Content';
import { cropIconKey } from '../art/CropArtist';
import { hex } from '../art/paint';
import { maskSize, paintTexture, type MaskPalette } from './pixelPaint';
import { UI_COLORS } from './uiTheme';

// Shape masks for item icons: 'a' main, 'b' shade, 'c' accent, 'd' detail, 'o' outline, 'w' shine.
const SHAPES: Record<string, readonly string[]> = {
  fish: [
    '...oooo.....',
    '..oaaaaoo.oo',
    '.oaawaaaaoco',
    'oaaoaaaaaacco',
    'oaaaaaaaaacco',
    '.obbbbbbbocco',
    '..obbbboo.oo',
    '...oooo.....',
  ],
  egg: ['..ooo..', '.oaaao.', 'oawaaao', 'oaaaaao', 'oaaaabo', 'oabbbbo', '.ooooo.'],
  bottle: [
    '..ooo..',
    '..oco..',
    '..oao..',
    '.oaaao.',
    'oawaaao',
    'oaaaaao',
    'occccco',
    'oaaaabo',
    'obbbbbo',
    '.ooooo.',
  ],
  jar: ['.ooooo.', 'occccco', '.ooooo.', 'oawaaao', 'oaaaaao', 'oaccaao', 'oaaaabo', '.ooooo.'],
  jug: ['..oooo..', '.oaaaaoo', 'oawaaaoo', 'oaaaaao.', 'oaaaabo.', 'occccco.', '.ooooo..'],
  sack: [
    '..o.o..',
    '...o...',
    '.occco.',
    'oaaaaao',
    'oawaaao',
    'oaaaaao',
    'oaaaabo',
    '.obbbo.',
    '..ooo..',
  ],
  wool: ['..ooo...', '.oaaao..', 'oaawaaoo', 'oaaaaaao', 'oabaaaao', '.obbabbo', '..oooo..'],
  cheese: ['....ooo', '..ooaao', 'ooaaaao', 'oaabaao', 'oaaaabo', 'obbabbo', 'ooooooo'],
  butter: ['.oooooo.', 'oaaaaaao', 'oawaaaao', 'oaaaaaao', 'obbbbbbo', '.oooooo.'],
  bread: ['..oooo..', '.oaaaao.', 'oawabaao', 'oaabaabo', 'obbbbbbo', '.oooooo.'],
  cake: [
    '...oco...',
    '...ooo...',
    '.ooooooo.',
    'oaaaaaaao',
    'obbbbbbbo',
    'oaaaaaaao',
    'obbbbbbbo',
    '.ooooooo.',
  ],
  pie: ['..oooooo..', '.oaabaabo.', 'oaabaabaao', 'obbbbbbbbo', '.oooooooo.'],
  bowl: ['.oooooo.', 'oaabaaao', 'obaaaabo', 'occcccco', '.occcco.', '..oooo..'],
  plate: ['..oooo....', '.oaaaao...', 'oaawaaabo.', 'oabbbbbbo.', 'ocooooooco', '.oooooooo.'],
  truffle: ['..ooo..', '.oaaao.', 'oacaaao', 'oaaacao', 'oabaaao', '.obbbo.', '..ooo..'],
  worm: ['....oo.', '...oaao', '..oabo.', '.oaao..', 'oaaao..', 'obbo...', '.oo....'],
  bait: ['...o...', '..oco..', '.oaaao.', 'oawaaao', 'oaaaaao', '.oabao.', '..ooo..'],
  lump: ['..ooo...', '.oaaaoo.', 'oawaaaao', 'oaaacaao', 'oacaaabo', '.obbabbo', '..ooooo.'],
  ore: ['..oooo..', '.oaacaoo', 'oaccaaao', 'oaaaacco', 'oacaaaco', 'obbbcbbo', '.oooooo.'],
  bar: ['...oooooo', '..ocwccco', '.oaaaaaoo', 'oaaaaaabo', 'obbbbbbo.', '.ooooooo.'],
  gem: ['..ooooo..', '.ocwccco.', 'oaawaaabo', '.oaaaabo.', '..oaabo..', '...obo...', '....o....'],
};

const OUTLINE = UI_COLORS.outline;
const SHINE = 0xffffff;

export const itemIconTextureKey = (itemId: string) => `item-icon-${itemId}`;

/** Icon texture for any inventory item: crops use their crop art, others a shape icon. */
export function itemIconKey(content: Content, itemId: string): string {
  return content.crops.has(itemId) ? cropIconKey(itemId) : itemIconTextureKey(itemId);
}

export function generateItemIcons(scene: Phaser.Scene, content: Content): void {
  for (const item of content.items.all()) {
    if (!item.icon || content.crops.has(item.id)) continue;
    const rows = SHAPES[item.icon.shape];
    if (!rows) throw new Error(`${item.id}: unknown icon shape ${item.icon.shape}`);
    const [a = '#ffffff', b, c, d] = item.icon.colors;
    const main = hex(a);
    const palette: MaskPalette = {
      o: OUTLINE,
      w: SHINE,
      a: main,
      b: b ? hex(b) : main,
      c: c ? hex(c) : main,
      d: d ? hex(d) : main,
    };
    const { width, height } = maskSize(rows);
    paintTexture(scene, itemIconTextureKey(item.id), width, height, (p) => p.mask(rows, palette));
  }
}
