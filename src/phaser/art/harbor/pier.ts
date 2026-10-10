import type * as Phaser from 'phaser';
import { PALETTE } from '../../theme';
import { fillPrism, isoPixel, type IsoCanvas } from '../isoPrism';

/** The pier runs out along +row (screen down-left) from the shore; a = across, b = along. */
export const PIER = {
  length: 8,
  halfWidth: 0.45,
  head: { from: 6.8, across: [-0.6, 1.7] as const },
  deck: 5,
  thickness: 2,
  postDepth: 4,
  boardsPerTile: 3,
} as const;

const PAD = 4;
const POST_STEP = 1;
const BOLLARD = 0xd9b06a;
const FOAM = 0xe8f6f2;

/** Texture layout: big enough for the whole pier, with the shore point as the origin. */
export function pierCanvas(): IsoCanvas {
  const { length, head } = PIER;
  const left = (head.across[0] - length) * 20;
  const right = head.across[1] * 20;
  return {
    width: Math.ceil(right - left) + PAD * 2,
    height: Math.ceil((length + head.across[1]) * 10 + PIER.deck + PIER.postDepth) + PAD * 2,
    origin: { x: Math.ceil(-left) + PAD, y: PIER.deck + PAD },
  };
}

const onWalk = (a: number, b: number) =>
  Math.abs(a) <= PIER.halfWidth && b >= 0 && b <= PIER.length;
const onHead = (a: number, b: number) =>
  a >= PIER.head.across[0] && a <= PIER.head.across[1] && b >= PIER.head.from && b <= PIER.length;
const onDeck = (a: number, b: number) => onWalk(a, b) || onHead(a, b);

// A plank pier on pilings with a wide head for mooring, seen from the isometric camera.
export function drawPier(g: Phaser.GameObjects.Graphics): void {
  const canvas = pierCanvas();
  const posts: Array<[number, number]> = [];
  for (let b = POST_STEP; b <= PIER.length; b += POST_STEP) {
    posts.push([-PIER.halfWidth, b], [PIER.halfWidth, b]);
  }
  posts.push([PIER.head.across[0], PIER.length], [PIER.head.across[1], PIER.length]);
  posts.push([PIER.head.across[1], PIER.head.from]);
  for (const [a, b] of posts) {
    const top = isoPixel(canvas, a, b, PIER.deck - PIER.thickness);
    const x = Math.round(top.x);
    const y = Math.round(top.y);
    const height = PIER.deck - PIER.thickness + PIER.postDepth;
    g.fillStyle(PALETTE.woodDarker).fillRect(x - 1, y, 3, height);
    g.fillStyle(PALETTE.woodDark).fillRect(x - 1, y, 1, height);
    g.fillStyle(FOAM).fillRect(x - 2, y + height, 5, 1);
  }
  fillPrism(g, canvas, onDeck, PIER.deck - PIER.thickness, PIER.deck, (face, a, b) => {
    if (face === 'west') return PALETTE.woodDark;
    if (face === 'east') return PALETTE.woodDarker;
    const board = b * PIER.boardsPerTile;
    if (board - Math.floor(board) < 0.18) return PALETTE.woodDark;
    const rim = onHead(a, b) ? false : PIER.halfWidth - Math.abs(a) < 0.08;
    if (rim) return PALETTE.woodDarker;
    return Math.floor(board) % 2 === 0 ? PALETTE.wood : PALETTE.woodLight;
  });
  for (const a of [PIER.head.across[0] + 0.15, PIER.head.across[1] - 0.15]) {
    const at = isoPixel(canvas, a, PIER.length - 0.2, PIER.deck);
    g.fillStyle(PALETTE.woodDarker).fillRect(Math.round(at.x) - 1, Math.round(at.y) - 3, 3, 3);
    g.fillStyle(BOLLARD).fillRect(Math.round(at.x) - 1, Math.round(at.y) - 4, 3, 1);
  }
}
