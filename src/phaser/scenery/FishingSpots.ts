import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { EXTRA_TEXTURES } from '../art/ExtraArtist';
import { addArt } from '../art/paint';
import type { IsoGrid } from '../iso/IsoGrid';
import { mapToScreen, toGrid, WORLD, type WorldFeature } from '../map/WorldMap';
import { textStyle, TEXT } from '../theme';
import { iconKey } from '../ui/uiTextures';

const HIT_RADIUS = 1.8;
const BITE_DIP = 6;
const BOB_MS = 500;
const LABEL_RISE = 34;
const LABEL_DEPTH = 9400;
const LOCK_SCALE = 2;

interface ShoreSpot {
  spotId: string;
  feature: WorldFeature;
  at: { x: number; y: number };
  label: Phaser.GameObjects.Text;
  lock: Phaser.GameObjects.Image;
}

// Shore fishing places from the map (river, pond, pier, point): a label, and a bobber while a
// line is out. Boat destinations are reached from the harbor instead.
export class FishingSpots {
  private readonly spots: ShoreSpot[] = [];
  private readonly bobber: Phaser.GameObjects.Image;
  private readonly alert: Phaser.GameObjects.Text;
  private bobberTween: Phaser.Tweens.Tween | null = null;
  private shownPhase = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly grid: IsoGrid,
  ) {
    for (const feature of WORLD.features) {
      if (feature.kind !== 'spot' || !feature.spot) continue;
      if (!session.content.spots.has(feature.spot)) continue;
      this.spots.push(this.buildSpot(feature.spot, feature));
    }
    this.bobber = addArt(scene, 0, 0, EXTRA_TEXTURES.bobber, 0.5, 1).setVisible(false);
    this.alert = scene.add
      .text(0, 0, '!', textStyle(40, TEXT.gold))
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.refreshLocks();
    session.bus.on('LevelUp', () => this.refreshLocks());
    session.bus.on('BoatUpgraded', () => this.refreshLocks());
  }

  /** The shore spot at a grid point, if any. */
  spotAt(col: number, row: number): string | null {
    for (const spot of this.spots) {
      const g = toGrid(spot.feature.u, spot.feature.v);
      if (Math.hypot(col - g.col, row - g.row) <= HIT_RADIUS) return spot.spotId;
    }
    return null;
  }

  /** Where the bobber sits for a spot, and the depth just above the water there. */
  bobberPoint(spotId: string): { x: number; y: number; depth: number } | null {
    const spot = this.spots.find((s) => s.spotId === spotId);
    if (!spot) return null;
    const g = toGrid(spot.feature.u, spot.feature.v);
    return { ...spot.at, depth: this.grid.depthOf(g.col, g.row) + 2 };
  }

  update(): void {
    const cast = this.session.fishing.cast();
    const phase = cast ? `${cast.spotId}:${this.session.fishing.phase()}` : 'idle';
    if (phase === this.shownPhase) return;
    this.shownPhase = phase;
    this.bobberTween?.stop();
    const point = cast ? this.bobberPoint(cast.spotId) : null;
    this.bobber.setVisible(Boolean(point));
    this.alert.setVisible(false);
    if (!point) return;
    const { x, y, depth } = point;
    this.bobber.setPosition(x, y).setDepth(depth);
    const biting = this.session.fishing.phase() === 'bite';
    this.bobberTween = this.scene.tweens.add({
      targets: this.bobber,
      y: y + (biting ? BITE_DIP : 2),
      duration: biting ? BOB_MS / 4 : BOB_MS,
      yoyo: true,
      repeat: -1,
    });
    if (biting) {
      this.alert
        .setPosition(x, y - this.bobber.displayHeight)
        .setDepth(depth + 1)
        .setVisible(true);
    }
  }

  private refreshLocks(): void {
    for (const spot of this.spots) {
      const locked = this.session.fishing.spotBlocker(spot.spotId) !== null;
      spot.lock.setVisible(locked);
      spot.label.setAlpha(locked ? 0.7 : 1);
    }
  }

  private buildSpot(spotId: string, feature: WorldFeature): ShoreSpot {
    const at = mapToScreen(this.grid.tileW, this.grid.tileH, feature);
    const name = this.session.content.spots.get(spotId).name;
    const label = this.scene.add
      .text(at.x, at.y - LABEL_RISE, name, textStyle(20, TEXT.base))
      .setOrigin(0.5, 1)
      .setDepth(LABEL_DEPTH);
    const lock = this.scene.add
      .image(at.x + label.width / 2 + 10, at.y - LABEL_RISE - label.height / 2, iconKey('lock'))
      .setScale(LOCK_SCALE)
      .setDepth(LABEL_DEPTH);
    return { spotId, feature, at, label, lock };
  }
}
