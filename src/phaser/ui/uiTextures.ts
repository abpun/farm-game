import type * as Phaser from 'phaser';
import { drawIcon } from './iconArt';
import { paintTexture, type PixelPainter } from './pixelPaint';
import { UI_COLORS as C } from './uiTheme';

export const FRAME_SIZE = 12;
export const FRAME_SLICE = 4;
/** Vector icons are baked onto a canvas this many pixels square, then scaled down in the UI. */
const ICON_SIZE = 128;

interface FrameColors {
  outline: number;
  light: number;
  base: number;
  dark: number;
  fill: number;
  inner?: number;
}

const FRAMES = {
  panel: {
    outline: C.outline,
    light: C.woodLight,
    base: C.wood,
    dark: C.woodDark,
    fill: C.parchment,
    inner: C.parchmentShade,
  },
  plaque: {
    outline: C.outline,
    light: C.woodLight,
    base: C.wood,
    dark: C.woodDark,
    fill: C.plaque,
  },
  woodButton: {
    outline: C.outline,
    light: C.woodLight,
    base: C.wood,
    dark: C.woodDark,
    fill: C.wood,
  },
  woodButtonHover: {
    outline: C.outline,
    light: C.parchmentLight,
    base: C.woodLight,
    dark: C.wood,
    fill: C.woodLight,
  },
  woodButtonPressed: {
    outline: C.outline,
    light: C.woodDeep,
    base: C.woodDark,
    dark: C.wood,
    fill: C.woodDark,
  },
  woodButtonSelected: {
    outline: C.outline,
    light: C.selectLight,
    base: C.select,
    dark: C.woodDark,
    fill: C.select,
  },
  woodButtonDisabled: {
    outline: C.disabledDark,
    light: C.disabledLight,
    base: C.disabled,
    dark: C.disabledDark,
    fill: C.disabled,
  },
  slot: {
    outline: C.parchmentDark,
    light: C.parchmentDark,
    base: C.parchmentShade,
    dark: C.parchmentLight,
    fill: C.parchmentShade,
  },
  slotHover: {
    outline: C.parchmentDark,
    light: C.parchmentDark,
    base: C.parchment,
    dark: C.parchmentLight,
    fill: C.parchment,
  },
  slotPressed: {
    outline: C.woodDark,
    light: C.woodDark,
    base: C.parchmentDark,
    dark: C.parchmentShade,
    fill: C.parchmentShade,
  },
  slotSelected: {
    outline: C.select,
    light: C.select,
    base: C.selectLight,
    dark: C.parchmentLight,
    fill: C.selectFill,
  },
  slotDisabled: {
    outline: C.disabledDark,
    light: C.disabled,
    base: C.disabledLight,
    dark: C.parchmentShade,
    fill: C.disabledLight,
  },
  tab: { outline: C.outline, light: C.wood, base: C.woodDark, dark: C.woodDeep, fill: C.woodDark },
  tabActive: {
    outline: C.outline,
    light: C.woodLight,
    base: C.wood,
    dark: C.parchment,
    fill: C.parchment,
  },
} satisfies Record<string, FrameColors>;

export type FrameName = keyof typeof FRAMES;
export const frameKey = (name: FrameName) => `ui-frame-${name}`;

// The names registered here are the UI's icon set; each is drawn as smooth vector art by
// `iconArt`. The old pixel-mask rows are kept only as the source of these names.
const ICONS = {
  coin: [
    '..oooo..',
    '.ohyyho.',
    'ohyYYyho',
    'ohyYyyho',
    'ohyyyyho',
    'ohhyyhho',
    '.ohhhho.',
    '..oooo..',
  ],
  clock: [
    '..oooo..',
    '.owwwwo.',
    'owwwowwo',
    'owwwowwo',
    'owwwoowo',
    'owwwwwwo',
    '.owgggo.',
    '..oooo..',
  ],
  seed: [
    '..o..o..',
    '...oo...',
    '.oooooo.',
    'oBBBBBBo',
    'oBBbBBBo',
    'oBbBbBBo',
    'oBBBBBBo',
    '.oooooo.',
  ],
  barn: [
    '....o....',
    '...oro...',
    '..orrro..',
    '.orrrrro.',
    'orrwwwrro',
    'orrwbwrro',
    'orrwbwrro',
    'ooooooooo',
  ],
  menu: [
    'oooooooo',
    'owwwwwwo',
    'oooooooo',
    '........',
    'oooooooo',
    'owwwwwwo',
    'oooooooo',
    '........',
    'oooooooo',
    'owwwwwwo',
    'oooooooo',
  ],
  close: [
    'oo....oo',
    'oRo..oRo',
    '.oRooRo.',
    '..oRRo..',
    '..oRRo..',
    '.oRooRo.',
    'oRo..oRo',
    'oo....oo',
  ],
  save: [
    'oooooooo',
    'ouUUUUuo',
    'ouUkkUuo',
    'ouuuuuuo',
    'oukkkkuo',
    'oukbbkuo',
    'oukkkkuo',
    'oooooooo',
  ],
  export: [
    '...oo...',
    '..onno..',
    '.onnnno.',
    'ooonnooo',
    '..onno..',
    '..onno..',
    'oooooooo',
    'owwwwwwo',
    'oooooooo',
  ],
  import: [
    '..onno..',
    '..onno..',
    'ooonnooo',
    '.onnnno.',
    '..onno..',
    '...oo...',
    'oooooooo',
    'owwwwwwo',
    'oooooooo',
  ],
  build: [
    '..oooooo',
    '..oggggo',
    '..ooogwo',
    '....obo.',
    '...obo..',
    '..obo...',
    '.obo....',
    'oo......',
  ],
  plants: [
    '..oooo..',
    '.onnNno.',
    'onnNNnno',
    'onNnnnno',
    'onnnnnno',
    '.onnnno.',
    '..obbo..',
    '...bo...',
    '..oooo..',
  ],
  chicken: [
    '...oo....',
    '..oRwo...',
    '..owwoo..',
    'oowwwwwo.',
    'owwwwwwwo',
    '.owwwwwo.',
    '..ooyoo..',
    '...y.y...',
  ],
  cow: [
    '..o....o..',
    '.owwwwwwo.',
    'owbwwwbbwo',
    'owwbbwwwwo',
    'owwwwwbbwo',
    '.oowwwwoo.',
    '..o.oo.o..',
    '..o....o..',
  ],
  decor: ['.o.o.o.', 'oRoRoRo', '.oRYRo.', 'oRoRoRo', '.o.n.o.', '...n...', '..nnn..', '.ooooo.'],
  lock: ['..ooo..', '.o...o.', '.o...o.', 'ooooooo', 'oyyhyyo', 'oyyoyyo', 'oyyyyyo', 'ooooooo'],
  market: [
    'rwrwrwrwr',
    'rwrwrwrwr',
    '.ooooooo.',
    '.ob...bo.',
    '.ob...bo.',
    '.obBBBbo.',
    '.obBBBbo.',
    '.ooooooo.',
  ],
  crafting: [
    '...o.o...',
    '..o.o....',
    'ooooooooo',
    'obbbbbbbo',
    '.obbbbbo.',
    '.obbbbbo.',
    '..ooooo..',
    '..o...o..',
  ],
  orders: ['oooooooo', 'oBbBBbBo', 'oBBbbBBo', 'obBBBBbo', 'oBBbbBBo', 'oBbBBbBo', 'oooooooo'],
  fishing: ['..oooo....', '.ouuuuo..o', 'ouUuuuuooo', 'ouuuuuuooo', '.ouuuuo..o', '..oooo....'],
  quests: [
    'oooooooo',
    'owwwwwwo',
    'owwrrwwo',
    'owwrrwwo',
    'owwrrwwo',
    'owwwwwwo',
    'owwrrwwo',
    'owwwwwwo',
    'oooooooo',
  ],
  achievements: [
    'ooooooooo',
    'oyYyyyyyo',
    '.oyyyyyo.',
    '..oyyyo..',
    '...oyo...',
    '..ooooo..',
    '..ohhho..',
    '..ooooo..',
  ],
  farmhands: [
    '...oooo...',
    '..oBBBBo..',
    '..oBBBBo..',
    '..orrrro..',
    'ooBBBBBBoo',
    'oBBBBBBBBo',
    'oooooooooo',
  ],
  friends: [
    '.ooo..ooo.',
    'oYYYooYYYo',
    'oYYYooYYYo',
    '.ooo..ooo.',
    'ouuuoouuuo',
    'ouuuoouuuo',
    'oooooooooo',
  ],
  mail: ['ooooooooo', 'oWoWWWoWo', 'oWWoWoWWo', 'oWWWoWWWo', 'oWWWWWWWo', 'oWWWWWWWo', 'ooooooooo'],
  spring: ['.pp.pp.', 'ppppppp', '.ppypp.', 'ppppppp', '.pp.pp.'],
  summer: [
    '....y....',
    '.y..y..y.',
    '..yyyyy..',
    '..yYYYy..',
    'yyyYYYyyy',
    '..yYYYy..',
    '..yyyyy..',
    '.y..y..y.',
    '....y....',
  ],
  autumn: [
    '......oo',
    '....ollo',
    '..olllLo',
    '.olllLlo',
    'ollLlllo',
    'olLlllo.',
    'oLlloo..',
    'oo......',
  ],
  winter: ['...s...', '.s.s.s.', '..sss..', 'sssWsss', '..sss..', '.s.s.s.', '...s...'],
  reset: [
    '..ooooo.',
    '.oRRRRRo',
    'oRo...oo',
    'oRo.....',
    'oRo...o.',
    'oRo..oRo',
    '.oRRRRo.',
    '..oooo..',
  ],
  move: [
    '...o...',
    '..oyo..',
    '...y...',
    'oy.y.yo',
    'yyyyyyy',
    'oy.y.yo',
    '...y...',
    '..oyo..',
    '...o...',
  ],
  rotate: [
    '..oooo.o',
    '.oyyyyoy',
    'oyo...yy',
    'oyo..yyy',
    'oyo.....',
    'oyo...o.',
    '.oyyyyo.',
    '..oooo..',
  ],
  star: ['...o...', '..oyo..', 'oooyooo', 'oyyYyyo', '.oyyyo.', '.oyoyo.', 'oo...oo'],
  heart: ['.oo.oo.', 'oRRoRRo', 'oRRRRRo', '.oRRRo.', '..oRo..', '...o...'],
  water: ['...o...', '..oUo..', '.oUuuo.', 'ouUuuuo', 'ouuuuuo', '.ouuuo.', '..ooo..'],
  hammer: ['.oooo..', 'oBBBBo.', '.oooBo.', '...obo.', '...obo.', '...obo.', '...ooo.'],
  check: ['......o', '.....on', 'o...on.', 'no.on..', '.nonn..', '..nn...'],
  left: ['...o', '..oo', '.oyo', 'oyyo', '.oyo', '..oo', '...o'],
  right: ['o...', 'oo..', 'oyo.', 'oyyo', 'oyo.', 'oo..', 'o...'],
  plus: ['..ooo..', '..oNo..', 'oooNooo', 'oNNNNNo', 'oooNooo', '..oNo..', '..ooo..'],
  minus: ['ooooooo', 'oRRRRRo', 'ooooooo'],
  orchard: ['..ooo..', '.onnno.', 'onnRnno', 'onRnnRo', '.onnno.', '..obo..', '..obo..', '.ooooo.'],
  supplies: ['..o.o..', '...o...', '.oBBBo.', 'oBBBBBo', 'oBbBBBo', 'oBBBBBo', '.ooooo.'],
  production: ['..o.o..', '.ooooo.', 'oobbboo', '.obobo.', 'oobbboo', '.ooooo.', '..o.o..'],
  sheep: ['..oooo...', '.owwwwoo.', 'owwwwwwbo', 'owwwwwwbo', '.owwwwoo.', '..o..o...'],
  goat: ['.......oo', '..ooooobo', '.oBBBBBBo', 'oBBBBBBo.', '.oBBBBo..', '..o..o...'],
  pig: ['.o....o..', '.oppppoo.', 'opppppppo', 'oppppppRo', '.oppppoo.', '..o..o...'],
  ribbon: ['.ooooo.', 'oRRRRRo', 'oRYYYRo', 'oRRRRRo', '.ooooo.', '.oRoRo.', '.oo.oo.'],
  land: ['o......', 'oRRRo..', 'oRRRRo.', 'oRRRo..', 'o......', 'o......', 'ooo....'],
  basket: ['.ooooo.', 'o.....o', 'ooooooo', 'oBbBbBo', 'obBbBbo', '.ooooo.'],
  sound: [
    '....o....',
    '...oo..o.',
    'oooWo...o',
    'oWWWo.o.o',
    'oWWWo.o.o',
    'oooWo...o',
    '...oo..o.',
    '....o....',
  ],
  mute: [
    '....o....',
    '...oo....',
    'oooWo....',
    'oWWWo.R.R',
    'oWWWo..R.',
    'oooWo.R.R',
    '...oo....',
    '....o....',
  ],
  boat: [
    '....o....',
    '...owo...',
    '...owwo..',
    '...owwwo.',
    '...ooooo.',
    'ooooooooo',
    'obbbbbbbo',
    '.obbbbbo.',
    '..ooooo..',
  ],
  compass: [
    '..oooo..',
    '.owwRwo.',
    'owwwRwwo',
    'owwoowwo',
    'owwoowwo',
    'owwuwwwo',
    '.owuwwo.',
    '..oooo..',
  ],
  pickaxe: [
    '.oooooo.',
    'oggggggo',
    'oo.ob.oo',
    '...ob...',
    '...ob...',
    '...ob...',
    '...ob...',
    '...oo...',
  ],
  chest: ['.oooooo.', 'obbbbbbo', 'oBBBBBBo', 'oyyooyyo', 'obbyybbo', 'obbbbbbo', 'oooooooo'],
  gear: [
    '...oo...',
    '.o.gg.o.',
    'ooggggoo',
    '.ggoogg.',
    '.ggoogg.',
    'ooggggoo',
    '.o.gg.o.',
    '...oo...',
  ],
} as const;

export type IconName = keyof typeof ICONS;
export const iconKey = (name: IconName) => `ui-icon-${name}`;

/** Season icon for a season id, falling back to the clock for seasons without art. */
export const seasonIconKey = (seasonId: string) =>
  seasonId in ICONS ? `ui-icon-${seasonId}` : iconKey('clock');

export function generateUiTextures(scene: Phaser.Scene): void {
  for (const [name, colors] of Object.entries(FRAMES)) {
    paintTexture(scene, frameKey(name as FrameName), FRAME_SIZE, FRAME_SIZE, (p) =>
      drawFrame(p, colors),
    );
  }
  for (const name of Object.keys(ICONS)) {
    const key = iconKey(name as IconName);
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, ICON_SIZE, ICON_SIZE);
    if (!texture) continue;
    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(ICON_SIZE / 100, ICON_SIZE / 100);
    drawIcon(ctx, name as IconName);
    texture.refresh();
  }
}

// 12×12 frame: outline with cut corners, bevel (light top-left, dark bottom-right), base ring, fill.
function drawFrame(p: PixelPainter, c: FrameColors): void {
  const s = FRAME_SIZE;
  p.rect(1, 0, s - 2, 1, c.outline).rect(1, s - 1, s - 2, 1, c.outline);
  p.rect(0, 1, 1, s - 2, c.outline).rect(s - 1, 1, 1, s - 2, c.outline);
  p.rect(1, 1, s - 2, 1, c.light).rect(1, 1, 1, s - 2, c.light);
  p.rect(1, s - 2, s - 2, 1, c.dark).rect(s - 2, 1, 1, s - 2, c.dark);
  p.rect(2, 2, s - 4, 1, c.base).rect(2, s - 3, s - 4, 1, c.base);
  p.rect(2, 2, 1, s - 4, c.base).rect(s - 3, 2, 1, s - 4, c.base);
  p.rect(3, 3, s - 6, s - 6, c.fill);
  if (c.inner === undefined) return;
  p.rect(3, 3, s - 6, 1, c.inner).rect(3, 3, 1, s - 6, c.inner);
}
