import type * as Phaser from 'phaser';

export interface RippleSpec {
  rings: number;
  /** Final ring width in screen pixels; rings are flattened ellipses on the water. */
  radius: number;
  durationMs: number;
  color: number;
  /** Delay between successive rings. */
  stagger?: number;
}

const FLATTEN = 0.42;

// Expanding rings on the water, drawn into a small fixed set of Graphics objects.
export class Ripples {
  private readonly free: Phaser.GameObjects.Graphics[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    size: number,
    private readonly lineWidth: number,
  ) {
    for (let i = 0; i < size; i++) this.free.push(scene.add.graphics().setVisible(false));
  }

  spawn(x: number, y: number, depth: number, spec: RippleSpec): void {
    for (let ring = 0; ring < spec.rings; ring++) {
      const g = this.free.pop();
      if (!g) return;
      g.setPosition(x, y).setDepth(depth).setVisible(true).setAlpha(0);
      const state = { t: 0 };
      this.scene.tweens.add({
        targets: state,
        t: 1,
        delay: ring * (spec.stagger ?? spec.durationMs / 3),
        duration: spec.durationMs,
        ease: 'Quad.easeOut',
        onUpdate: () => this.draw(g, spec, state.t),
        onComplete: () => {
          g.clear().setVisible(false);
          this.free.push(g);
        },
      });
    }
  }

  private draw(g: Phaser.GameObjects.Graphics, spec: RippleSpec, t: number): void {
    const width = Math.max(this.lineWidth * 2, spec.radius * 2 * t);
    g.clear()
      .setAlpha(1 - t)
      .lineStyle(this.lineWidth, spec.color, 1)
      .strokeEllipse(0, 0, width, width * FLATTEN);
  }
}
