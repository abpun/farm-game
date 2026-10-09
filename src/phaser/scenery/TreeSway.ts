import type * as Phaser from 'phaser';
import { effectsEnabled, reducedMotion } from '../fx/prefs';

const GUST_SEC: [number, number] = [5, 11];
const TREES_PER_GUST = 3;
const LEAN_DEG = 1.2;
const LEAN_MS = 420;

// Now and then a breeze leans a few trees and lets them settle; trees otherwise stay still.
export class TreeSway {
  private untilGust: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly trees: Phaser.GameObjects.Image[],
  ) {
    this.untilGust = between(GUST_SEC);
  }

  update(deltaSec: number): void {
    this.untilGust -= deltaSec;
    if (this.untilGust > 0) return;
    this.untilGust = between(GUST_SEC);
    if (!effectsEnabled(this.scene) || reducedMotion(this.scene)) return;
    const pool = [...this.trees];
    for (let i = 0; i < TREES_PER_GUST && pool.length > 0; i++) {
      const [tree] = pool.splice(Math.floor(Math.random() * pool.length), 1);
      if (!tree || this.scene.tweens.isTweening(tree)) continue;
      this.scene.tweens.chain({
        targets: tree,
        delay: i * (LEAN_MS / 3),
        tweens: [
          { angle: LEAN_DEG, duration: LEAN_MS, ease: 'Sine.easeOut' },
          { angle: -LEAN_DEG / 2, duration: LEAN_MS, ease: 'Sine.easeInOut' },
          { angle: 0, duration: LEAN_MS, ease: 'Sine.easeIn' },
        ],
      });
    }
  }
}

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min);
