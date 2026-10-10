import type * as Phaser from 'phaser';
import { addArt, seededRandom } from '../art/paint';
import { birdKey, CLOUD_VARIANTS, cloudKey, GULL_PERCHED } from '../art/SkyLifeArtist';
import type { IsoGrid } from '../iso/IsoGrid';
import { mapToScreen, WORLD } from '../map/WorldMap';
import { HIGHLAND_DEPTH } from './Highlands';

const CLOUDS = { count: 9, speed: [4, 11], band: [-1480, -820], parallax: 0.92 } as const;
const FLOCK = {
  gapSec: [14, 32],
  max: 2,
  size: [3, 6],
  speed: [70, 110],
  spacing: 26,
  sway: 6,
} as const;
const BIRD_DEPTH = 26000;
const FLAP_MS = 160;
const COAST_V = 34;
const GULL = { awaySec: [12, 35], staySec: [10, 28], flyMs: 2600, depthLift: 1 } as const;
/** Dock posts gulls like to sit on, relative to the harbor feature (map units). */
const PERCHES = [
  { u: -0.6, v: 6.2 },
  { u: 0.9, v: 6.2 },
];

interface Bird {
  image: Phaser.GameObjects.Image;
  kind: 'dark' | 'gull';
  phase: number;
  baseY: number;
}

interface Flock {
  birds: Bird[];
  vx: number;
  age: number;
}

interface Gull {
  image: Phaser.GameObjects.Image;
  perch: { x: number; y: number };
  state: 'away' | 'flying' | 'perched';
  wait: number;
}

const between = (random: () => number, [min, max]: readonly [number, number]) =>
  min + random() * (max - min);

// Clouds drifting across the sky, flocks crossing whatever part of the valley is on screen,
// and gulls that come and go from the harbor's dock posts.
export class SkyLife {
  private readonly random = seededRandom(97);
  private readonly clouds: Array<{ image: Phaser.GameObjects.Image; speed: number }> = [];
  private readonly flocks: Flock[] = [];
  private readonly gulls: Gull[] = [];
  private untilFlock: number;
  private elapsed = 0;
  private readonly west: number;
  private readonly east: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: IsoGrid,
  ) {
    this.west = (WORLD.bounds.west * grid.tileW) / 2;
    this.east = (WORLD.bounds.east * grid.tileW) / 2;
    for (let i = 0; i < CLOUDS.count; i++) {
      const image = addArt(
        scene,
        this.west + this.random() * (this.east - this.west),
        between(this.random, CLOUDS.band),
        cloudKey(i % CLOUD_VARIANTS),
        0.5,
        1,
      )
        .setDepth(HIGHLAND_DEPTH.clouds)
        .setScrollFactor(CLOUDS.parallax);
      this.clouds.push({ image, speed: between(this.random, CLOUDS.speed) });
    }
    const harbor = WORLD.features.find((f) => f.kind === 'harbor');
    for (const offset of harbor ? PERCHES : []) {
      const perch = mapToScreen(grid.tileW, grid.tileH, {
        u: (harbor?.u ?? 0) + offset.u,
        v: (harbor?.v ?? 0) + offset.v,
      });
      const image = addArt(scene, perch.x, perch.y, GULL_PERCHED, 0.5, 1).setVisible(false);
      image.setDepth((perch.y / (grid.tileH / 2)) * 10 + 20);
      this.gulls.push({ image, perch, state: 'away', wait: between(this.random, GULL.awaySec) });
    }
    this.untilFlock = between(this.random, FLOCK.gapSec) / 3;
  }

  update(deltaSec: number, still: boolean, birds: boolean): void {
    this.elapsed += deltaSec;
    if (!still) this.driftClouds(deltaSec);
    this.updateFlocks(deltaSec, birds && !still);
    this.updateGulls(deltaSec, birds && !still);
  }

  private driftClouds(deltaSec: number): void {
    for (const cloud of this.clouds) {
      cloud.image.x += cloud.speed * deltaSec;
      if (cloud.image.x > this.east + cloud.image.displayWidth) {
        cloud.image.x = this.west - cloud.image.displayWidth;
      }
    }
  }

  private updateFlocks(deltaSec: number, enabled: boolean): void {
    this.untilFlock -= deltaSec;
    if (enabled && this.untilFlock <= 0 && this.flocks.length < FLOCK.max) {
      this.untilFlock = between(this.random, FLOCK.gapSec);
      this.spawnFlock();
    }
    const view = this.scene.cameras.main.worldView;
    for (let i = this.flocks.length - 1; i >= 0; i--) {
      const flock = this.flocks[i] as Flock;
      flock.age += deltaSec;
      let gone = !enabled;
      for (const bird of flock.birds) {
        bird.image.x += flock.vx * deltaSec;
        bird.image.y = bird.baseY + Math.sin(this.elapsed * 2 + bird.phase) * FLOCK.sway;
        const frame = Math.floor((this.elapsed * 1000 + bird.phase * 100) / FLAP_MS) % 2;
        bird.image.setTexture(birdKey(bird.kind, frame));
        const out = flock.vx > 0 ? bird.image.x > view.right + 100 : bird.image.x < view.x - 100;
        gone ||= out && flock.age > 1;
      }
      if (!gone) continue;
      flock.birds.forEach((bird) => bird.image.destroy());
      this.flocks.splice(i, 1);
    }
  }

  // A small V of birds crossing the upper part of the current view.
  private spawnFlock(): void {
    const view = this.scene.cameras.main.worldView;
    const fromLeft = this.random() > 0.5;
    const centerV = view.centerY / (this.grid.tileH / 2);
    const kind = centerV > COAST_V ? 'gull' : 'dark';
    const count = Math.round(between(this.random, FLOCK.size));
    const y = view.y + view.height * (0.12 + this.random() * 0.35);
    const x = fromLeft ? view.x - 60 : view.right + 60;
    const vx = between(this.random, FLOCK.speed) * (fromLeft ? 1 : -1);
    const birds: Bird[] = [];
    for (let i = 0; i < count; i++) {
      const rank = Math.ceil(i / 2);
      const side = i % 2 === 0 ? 1 : -1;
      const image = addArt(
        this.scene,
        x - Math.sign(vx) * rank * FLOCK.spacing,
        y + side * rank * FLOCK.spacing * 0.5,
        birdKey(kind, 0),
        0.5,
        0.5,
      )
        .setDepth(BIRD_DEPTH)
        .setFlipX(vx < 0);
      birds.push({ image, kind, phase: this.random() * Math.PI * 2, baseY: image.y });
    }
    this.flocks.push({ birds, vx, age: 0 });
  }

  private updateGulls(deltaSec: number, enabled: boolean): void {
    for (const gull of this.gulls) {
      if (!enabled) {
        this.scene.tweens.killTweensOf(gull.image);
        gull.image.setVisible(false);
        gull.state = 'away';
        continue;
      }
      if (gull.state === 'flying') continue;
      gull.wait -= deltaSec;
      if (gull.wait > 0) continue;
      if (gull.state === 'away') this.flyIn(gull);
      else this.flyOff(gull);
    }
  }

  private flyIn(gull: Gull): void {
    gull.state = 'flying';
    const from = { x: gull.perch.x + 260, y: gull.perch.y - 220 };
    gull.image
      .setPosition(from.x, from.y)
      .setTexture(birdKey('gull', 0))
      .setFlipX(true)
      .setVisible(true);
    this.scene.tweens.add({
      targets: gull.image,
      x: gull.perch.x,
      y: gull.perch.y,
      duration: GULL.flyMs,
      ease: 'Sine.easeOut',
      onUpdate: () => gull.image.setTexture(birdKey('gull', Math.floor(this.elapsed * 6) % 2)),
      onComplete: () => {
        gull.state = 'perched';
        gull.wait = between(this.random, GULL.staySec);
        gull.image.setTexture(GULL_PERCHED).setFlipX(this.random() > 0.5);
      },
    });
  }

  private flyOff(gull: Gull): void {
    gull.state = 'flying';
    this.scene.tweens.add({
      targets: gull.image,
      x: gull.perch.x - 300,
      y: gull.perch.y - 260,
      duration: GULL.flyMs,
      ease: 'Sine.easeIn',
      onStart: () => gull.image.setFlipX(true),
      onUpdate: () => gull.image.setTexture(birdKey('gull', Math.floor(this.elapsed * 6) % 2)),
      onComplete: () => {
        gull.state = 'away';
        gull.wait = between(this.random, GULL.awaySec);
        gull.image.setVisible(false);
      },
    });
  }
}
