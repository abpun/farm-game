import type * as Phaser from 'phaser';
import { addArt, seededRandom } from '../art/paint';
import { FLOW_STREAK } from '../art/SkyLifeArtist';
import { Ripples } from '../fx/Ripples';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';
import { mapToScreen, WORLD } from '../map/WorldMap';
import { PALETTE } from '../theme';

const STREAKS = 22;
const STREAK_DEPTH = -1440;
const FLOW = { speed: [18, 32], life: [1.6, 2.8] } as const;
const SPLASH = { everySec: 1.3, radius: 70, ms: 1100 };

interface Streak {
  image: Phaser.GameObjects.Image;
  age: number;
  life: number;
  vx: number;
  vy: number;
}

// The river visibly flows: light streaks slide downstream, and rings spread under the falls.
export class WaterMotion {
  private readonly random = seededRandom(71);
  private readonly path: Array<{ x: number; y: number }>;
  private readonly streaks: Streak[] = [];
  private readonly ripples: Ripples;
  private readonly fallsFoot: { x: number; y: number; depth: number } | null;
  private untilSplash = 0;

  constructor(scene: Phaser.Scene, grid: IsoGrid) {
    this.path = WORLD.river.points.map(([u, v]) => mapToScreen(grid.tileW, grid.tileH, { u, v }));
    for (let i = 0; i < STREAKS; i++) {
      const image = addArt(scene, 0, 0, FLOW_STREAK).setDepth(STREAK_DEPTH).setAlpha(0);
      const streak = { image, age: 0, life: 1, vx: 0, vy: 0 };
      this.respawn(streak);
      streak.age = this.random() * streak.life;
      this.streaks.push(streak);
    }
    this.ripples = new Ripples(scene, 4, PIXEL_SCALE);
    const falls = WORLD.features.find((f) => f.kind === 'waterfall');
    const at = falls ? mapToScreen(grid.tileW, grid.tileH, falls) : null;
    this.fallsFoot = at && falls ? { ...at, depth: falls.v * 10 + 5 } : null;
  }

  update(deltaSec: number, still: boolean, effects: boolean): void {
    for (const streak of this.streaks) {
      streak.image.setVisible(!still);
      if (still) continue;
      streak.age += deltaSec;
      if (streak.age >= streak.life) this.respawn(streak);
      const t = streak.age / streak.life;
      streak.image.x += streak.vx * deltaSec;
      streak.image.y += streak.vy * deltaSec;
      streak.image.setAlpha(Math.sin(t * Math.PI) * 0.8);
    }
    this.untilSplash -= deltaSec;
    if (this.untilSplash > 0 || still || !effects || !this.fallsFoot) return;
    this.untilSplash = SPLASH.everySec;
    const { x, y, depth } = this.fallsFoot;
    this.ripples.spawn(x, y + 6, depth, {
      rings: 1,
      radius: SPLASH.radius,
      durationMs: SPLASH.ms,
      color: PALETTE.foam,
    });
  }

  // A new streak somewhere along the river, heading the way the water runs there.
  private respawn(streak: Streak): void {
    const segment = Math.floor(this.random() * (this.path.length - 1));
    const a = this.path[segment] ?? { x: 0, y: 0 };
    const b = this.path[segment + 1] ?? a;
    const t = this.random();
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const speed = between(this.random, FLOW.speed);
    streak.image.setPosition(
      Math.round((a.x + (b.x - a.x) * t + (this.random() - 0.5) * 24) / PIXEL_SCALE) * PIXEL_SCALE,
      Math.round((a.y + (b.y - a.y) * t) / PIXEL_SCALE) * PIXEL_SCALE,
    );
    streak.vx = ((b.x - a.x) / length) * speed;
    streak.vy = ((b.y - a.y) / length) * speed;
    streak.age = 0;
    streak.life = between(this.random, FLOW.life);
  }
}

const between = (random: () => number, [min, max]: readonly [number, number]) =>
  min + random() * (max - min);
