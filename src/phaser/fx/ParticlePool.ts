import type * as Phaser from 'phaser';
import { bake } from '../art/paint';

const PIXEL_KEY = 'fx-pixel';
const DEG = Math.PI / 180;
const MS_PER_SEC = 1000;

export interface BurstSpec {
  count: number;
  colors: readonly number[];
  /** Pixels per second. */
  speed: [number, number];
  /** Launch directions in degrees (0 = right, -90 = up). */
  angle?: [number, number];
  gravity?: number;
  life: [number, number];
  /** Square size in art pixels. */
  size?: number;
  /** Random start offset around the origin, in screen pixels. */
  spread?: number;
}

interface Particle {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  age: number;
  life: number;
}

// Fixed pool of square pixels: bursts reuse free slots and are dropped when the pool is
// full, so effects can never pile up. Positions snap to the art grid to stay crisp.
export class ParticlePool {
  private readonly free: Phaser.GameObjects.Image[] = [];
  private readonly live: Particle[] = [];

  constructor(
    scene: Phaser.Scene,
    size: number,
    private readonly pixel: number,
    depth: number,
  ) {
    bake(scene, PIXEL_KEY, 1, 1, (g) => g.fillStyle(0xffffff).fillRect(0, 0, 1, 1));
    for (let i = 0; i < size; i++) {
      this.free.push(scene.add.image(0, 0, PIXEL_KEY).setDepth(depth).setVisible(false));
    }
    scene.events.on('update', this.update, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.update, this));
  }

  get activeCount(): number {
    return this.live.length;
  }

  burst(x: number, y: number, spec: BurstSpec): void {
    const [minAngle, maxAngle] = spec.angle ?? [0, 360];
    for (let i = 0; i < spec.count; i++) {
      const image = this.free.pop();
      if (!image) return;
      const angle = (minAngle + Math.random() * (maxAngle - minAngle)) * DEG;
      const speed = between(spec.speed);
      const spread = spec.spread ?? 0;
      const color = spec.colors[i % spec.colors.length] ?? 0xffffff;
      image
        .setTint(color)
        .setScale((spec.size ?? 1) * this.pixel)
        .setAlpha(1)
        .setVisible(true);
      this.live.push({
        image,
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: spec.gravity ?? 0,
        age: 0,
        life: between(spec.life),
      });
    }
  }

  clear(): void {
    while (this.live.length > 0) this.release(this.live.length - 1);
  }

  private update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, MS_PER_SEC / 10) / MS_PER_SEC;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i] as Particle;
      p.age += deltaMs;
      if (p.age >= p.life) {
        this.release(i);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = p.age / p.life;
      p.image
        .setPosition(snap(p.x, this.pixel), snap(p.y, this.pixel))
        .setAlpha(t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
    }
  }

  private release(index: number): void {
    const [p] = this.live.splice(index, 1);
    if (!p) return;
    p.image.setVisible(false);
    this.free.push(p.image);
  }
}

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min);
const snap = (value: number, pixel: number) => Math.round(value / pixel) * pixel;
