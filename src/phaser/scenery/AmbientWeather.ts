import type * as Phaser from 'phaser';
import type { Bounds } from '../art/IslandArtist';
import { addArt, bake, seededRandom } from '../art/paint';
import type { AmbientKind, SeasonLook } from '../art/seasonLooks';

const MAX_PARTICLES = 40;
const DEPTH = 30000;

interface Motion {
  fall: [number, number];
  drift: [number, number];
  sway: number;
  swayFrequency: number;
  /** Rows of a tiny pixel mask; 'x' pixels take the particle colour. */
  mask: string[];
}

const MOTION: Record<Exclude<AmbientKind, 'none'>, Motion> = {
  leaves: { fall: [22, 40], drift: [-26, -10], sway: 14, swayFrequency: 1.6, mask: ['xx', '.x'] },
  petals: { fall: [14, 24], drift: [-22, -8], sway: 12, swayFrequency: 2.2, mask: ['xx'] },
  snow: { fall: [18, 32], drift: [-6, 6], sway: 5, swayFrequency: 1.1, mask: ['x'] },
};

interface Particle {
  image: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  phase: number;
  baseX: number;
}

// Seasonal particles drifting over the island: leaves, blossom petals or snow.
export class AmbientWeather {
  private readonly particles: Particle[] = [];
  private readonly random = seededRandom(23);
  private motion: Motion | null = null;
  private active = 0;
  private elapsed = 0;
  private hidden = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly area: Bounds,
  ) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const image = addArt(scene, 0, 0, '__WHITE').setDepth(DEPTH).setVisible(false);
      this.particles.push({ image, vx: 0, vy: 0, phase: 0, baseX: 0 });
    }
  }

  setSeason(look: SeasonLook): void {
    const { kind, colors, count } = look.ambient;
    this.motion = kind === 'none' ? null : MOTION[kind];
    this.active = this.motion ? Math.min(count, MAX_PARTICLES) : 0;
    this.particles.forEach((particle, i) => {
      const visible = i < this.active && this.motion !== null;
      particle.image.setVisible(visible);
      if (!visible || !this.motion) return;
      const color = colors[i % colors.length] ?? 0xffffff;
      particle.image.setTexture(this.texture(kind, color, this.motion.mask));
      this.respawn(particle, true);
    });
  }

  /** Hides the drifting particles (reduced motion) without forgetting the season. */
  setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    this.particles.forEach((particle, i) =>
      particle.image.setVisible(!hidden && this.motion !== null && i < this.active),
    );
  }

  update(deltaSec: number): void {
    const motion = this.motion;
    if (!motion || this.hidden) return;
    this.elapsed += deltaSec;
    for (let i = 0; i < this.active; i++) {
      const particle = this.particles[i] as Particle;
      particle.baseX += particle.vx * deltaSec;
      const y = particle.image.y + particle.vy * deltaSec;
      const wave = this.elapsed * motion.swayFrequency + particle.phase;
      particle.image.setPosition(particle.baseX + Math.sin(wave) * motion.sway, y);
      particle.image.setFlipX(Math.cos(wave) > 0);
      const gone = y > this.area.y + this.area.height || particle.baseX < this.area.x;
      if (gone) this.respawn(particle, false);
    }
  }

  private texture(kind: string, color: number, mask: string[]): string {
    const key = `fx-${kind}-${color.toString(16)}`;
    bake(this.scene, key, mask[0]?.length ?? 1, mask.length, (g) => {
      g.fillStyle(color);
      mask.forEach((row, y) => [...row].forEach((c, x) => c === 'x' && g.fillRect(x, y, 1, 1)));
    });
    return key;
  }

  private respawn(particle: Particle, anywhere: boolean): void {
    const motion = this.motion;
    if (!motion) return;
    const r = this.random;
    particle.baseX = this.area.x + r() * this.area.width;
    particle.vx = motion.drift[0] + r() * (motion.drift[1] - motion.drift[0]);
    particle.vy = motion.fall[0] + r() * (motion.fall[1] - motion.fall[0]);
    particle.phase = r() * Math.PI * 2;
    particle.image.setY(this.area.y + (anywhere ? r() * this.area.height : -10));
  }
}
