import type * as Phaser from 'phaser';
import { SHADOW, shade } from '../paint';
import { fillPrism, type IsoCanvas } from '../isoPrism';
import { ROCK } from '../terrain/colors';

export const LIGHTHOUSE_SIZE = { width: 44, height: 96 } as const;

const RED = 0xb8432a;
const WHITE = 0xf4f0e6;
const IRON = 0x3a3434;
const GLASS = 0xffe89a;
const DOOR = 0x3b4f63;
const BASE = { radius: 0.62, height: 6 } as const;
const TOWER = { bottom: 10, top: 7, height: 54, band: 9 } as const;
const GALLERY_OVERHANG = 3;
const LANTERN = { half: 5, roof: 13, aboveGallery: 7 } as const;

/** Texture pixel (ground level) of the tower's centre. */
const CENTER = { x: LIGHTHOUSE_SIZE.width / 2, y: LIGHTHOUSE_SIZE.height - 10 };
/** Texture row that sits on the map point (the plinth's ground centre). */
export const LIGHTHOUSE_GROUND = CENTER.y;
const GALLERY_Y = CENTER.y - BASE.height - TOWER.height;
/** Lantern centre measured from the top of the texture (where the glow goes). */
export const LANTERN_Y = GALLERY_Y - LANTERN.aboveGallery;

// A striped lighthouse on a round rock plinth: bands curve with the tower (2:1 ellipses)
// and it is lit from the upper left like everything else.
export function drawLighthouse(g: Phaser.GameObjects.Graphics): void {
  const canvas: IsoCanvas = { ...LIGHTHOUSE_SIZE, origin: CENTER };
  g.fillStyle(SHADOW.color, SHADOW.alpha).fillEllipse(CENTER.x + 3, CENTER.y + 2, 40, 14);
  fillPrism(
    g,
    canvas,
    (a, b) => Math.hypot(a, b) <= BASE.radius,
    0,
    BASE.height,
    (face, a, b, x, y) => {
      if (face === 'west') return (x + y) % 3 === 0 ? ROCK.deep : ROCK.dark;
      if (face === 'east') return ROCK.deep;
      return a + b < -0.3 ? ROCK.light : (x * 7 + y * 3) % 11 === 0 ? ROCK.dark : ROCK.base;
    },
  );
  const groundY = CENTER.y - BASE.height;
  for (let y = 0; y < TOWER.height; y++) {
    const t = y / TOWER.height;
    const half = Math.round(TOWER.bottom + (TOWER.top - TOWER.bottom) * t);
    const row = groundY - y;
    for (let dx = -half; dx < half; dx++) {
      // Bands are drawn on the cylinder, so their edges sag toward the viewer mid-tower.
      const sag = Math.sqrt(Math.max(0, 1 - (dx / half) ** 2)) * (half / 2);
      const band = Math.floor((y - sag + TOWER.band * 4) / TOWER.band) % 2 === 0;
      const base = band ? WHITE : RED;
      const lit = dx / half;
      const color =
        lit < -0.55
          ? shade(base, 1.08)
          : lit > 0.55
            ? shade(base, 0.72)
            : lit > 0.2
              ? shade(base, 0.88)
              : base;
      g.fillStyle(color).fillRect(CENTER.x + dx, row, 1, 1);
    }
  }
  g.fillStyle(DOOR).fillRect(CENTER.x - 4, groundY - 9, 5, 9);
  g.fillStyle(shade(DOOR, 1.4)).fillRect(CENTER.x - 4, groundY - 9, 5, 1);
  g.fillStyle(DOOR).fillRect(CENTER.x - 2, groundY - 32, 3, 4);
  const top = GALLERY_Y;
  const ring = TOWER.top + GALLERY_OVERHANG;
  const { half, roof } = LANTERN;
  g.fillStyle(IRON).fillEllipse(CENTER.x, top + 1, ring * 2, ring);
  g.fillStyle(shade(IRON, 1.6)).fillEllipse(CENTER.x, top, ring * 2 - 2, ring - 2);
  g.fillStyle(IRON).fillRect(CENTER.x - half, LANTERN_Y - half, half * 2, half * 2);
  g.fillStyle(GLASS).fillRect(
    CENTER.x - half + 1,
    LANTERN_Y - half + 1,
    half * 2 - 2,
    half * 2 - 2,
  );
  g.fillStyle(0xffffff).fillRect(CENTER.x - half + 2, LANTERN_Y - half + 2, 2, 3);
  g.fillStyle(IRON).fillRect(CENTER.x - 1, LANTERN_Y - half + 1, 1, half * 2 - 2);
  const eave = LANTERN_Y - half;
  g.fillStyle(IRON).fillTriangle(
    CENTER.x - half - 2,
    eave,
    CENTER.x + half + 2,
    eave,
    CENTER.x,
    eave - roof + half,
  );
  g.fillStyle(shade(IRON, 1.5)).fillTriangle(
    CENTER.x - half - 1,
    eave,
    CENTER.x,
    eave,
    CENTER.x,
    eave - roof + half + 1,
  );
  for (let dx = -ring + 1; dx < ring; dx += 3) {
    g.fillStyle(IRON).fillRect(CENTER.x + dx, top - 3, 1, 3);
  }
  g.fillStyle(IRON).fillRect(CENTER.x - ring + 1, top - 3, ring * 2 - 2, 1);
}
