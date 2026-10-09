import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { bakePier, EXTRA_TEXTURES } from '../art/ExtraArtist';
import { addArt } from '../art/paint';
import type { IslandShape } from '../art/terrain/IslandShape';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';
import { textStyle, TEXT } from '../theme';
import { iconKey } from '../ui/uiTextures';

interface GridPoint {
  col: number;
  row: number;
}

// Where each fishing spot's pier meets the shore: a point on the grid edge and the way out to sea.
const PIERS: Record<string, { from: GridPoint; dir: GridPoint }> = {
  pier: { from: { col: 0, row: 5.5 }, dir: { col: -1, row: 0 } },
  rocks: { from: { col: 6.5, row: 0 }, dir: { col: 0, row: -1 } },
};

const PIER = { width: 0.5, onLand: 0.5, overWater: 1.4, planks: 7, hitSlack: 0.3 } as const;
const MARCH_STEP = 0.05;
const MARCH_LIMIT = 12;
const BOBBER_OUT = 0.45;
const BITE_DIP = 6;
const BOB_MS = 500;
const LABEL_RISE = 26;

interface Pier {
  spotId: string;
  start: GridPoint;
  dir: GridPoint;
  length: number;
  bobberAt: { x: number; y: number };
  label: Phaser.GameObjects.Text;
  lock: Phaser.GameObjects.Image;
}

const add = (a: GridPoint, b: GridPoint, k = 1): GridPoint => ({
  col: a.col + b.col * k,
  row: a.row + b.row * k,
});

// Piers on the coast for each fishing spot, with a bobber while a line is out.
export class FishingSpots {
  private readonly piers: Pier[] = [];
  private readonly bobber: Phaser.GameObjects.Image;
  private readonly alert: Phaser.GameObjects.Text;
  private bobberTween: Phaser.Tweens.Tween | null = null;
  private shownPhase = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly grid: IsoGrid,
    shape: IslandShape,
  ) {
    for (const spot of session.content.spots.all()) {
      const layout = PIERS[spot.id];
      if (layout) this.piers.push(this.buildPier(spot.id, spot.name, layout, shape));
    }
    this.bobber = addArt(scene, 0, 0, EXTRA_TEXTURES.bobber, 0.5, 1).setVisible(false);
    this.alert = scene.add
      .text(0, 0, '!', textStyle(40, TEXT.gold))
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.refreshLocks();
    session.bus.on('LevelUp', () => this.refreshLocks());
  }

  /** The spot whose pier is under a grid point, if any. */
  spotAt(col: number, row: number): string | null {
    for (const pier of this.piers) {
      const rel = { col: col - pier.start.col, row: row - pier.start.row };
      const along = rel.col * pier.dir.col + rel.row * pier.dir.row;
      const across = Math.abs(rel.col * pier.dir.row - rel.row * pier.dir.col);
      const inLength = along >= -PIER.hitSlack && along <= pier.length + BOBBER_OUT + PIER.hitSlack;
      if (inLength && across <= PIER.width / 2 + PIER.hitSlack) return pier.spotId;
    }
    return null;
  }

  /** Where the bobber sits for a spot, and the depth just above the water there. */
  bobberPoint(spotId: string): { x: number; y: number; depth: number } | null {
    const pier = this.piers.find((p) => p.spotId === spotId);
    if (!pier) return null;
    const depth = this.grid.depthOf(pier.start.col, pier.start.row) + 2;
    return { ...pier.bobberAt, depth };
  }

  update(): void {
    const cast = this.session.fishing.cast();
    const phase = cast ? `${cast.spotId}:${this.session.fishing.phase()}` : 'idle';
    if (phase === this.shownPhase) return;
    this.shownPhase = phase;
    this.bobberTween?.stop();
    const pier = cast ? this.piers.find((p) => p.spotId === cast.spotId) : undefined;
    this.bobber.setVisible(Boolean(pier));
    this.alert.setVisible(false);
    if (!pier) return;
    const { x, y } = pier.bobberAt;
    const depth = this.grid.depthOf(pier.start.col, pier.start.row) + 3;
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
    for (const pier of this.piers) {
      const locked = this.session.fishing.spotBlocker(pier.spotId) !== null;
      pier.lock.setVisible(locked);
      pier.label.setAlpha(locked ? 0.7 : 1);
    }
  }

  // Marches out from the grid edge until the sea, so the pier always straddles the shoreline.
  private buildPier(
    spotId: string,
    name: string,
    layout: { from: GridPoint; dir: GridPoint },
    shape: IslandShape,
  ): Pier {
    let distance = 0;
    while (distance < MARCH_LIMIT) {
      const p = add(layout.from, layout.dir, distance);
      if (shape.surface(p.col, p.row) === 'water') break;
      distance += MARCH_STEP;
    }
    const start = add(layout.from, layout.dir, Math.max(0, distance - PIER.onLand));
    const length = PIER.onLand + PIER.overWater;
    const end = add(start, layout.dir, length);
    const side = { col: layout.dir.row, row: -layout.dir.col };
    const half = PIER.width / 2;
    const corners = [
      add(start, side, -half),
      add(start, side, half),
      add(end, side, half),
      add(end, side, -half),
    ];
    const screen = corners.map((c) => this.grid.toScreen(c.col, c.row));
    const baked = bakePier(this.scene, `pier-${spotId}`, screen, PIXEL_SCALE, PIER.planks);
    const depth = this.grid.depthOf(start.col, start.row) + 2;
    addArt(this.scene, baked.x, baked.y, baked.key).setDepth(depth);

    const tip = this.grid.toScreen(...gridPair(add(end, layout.dir, BOBBER_OUT)));
    const mid = this.grid.toScreen(...gridPair(add(start, layout.dir, length / 2)));
    const label = this.scene.add
      .text(mid.x, mid.y - LABEL_RISE, name, textStyle(20, TEXT.base))
      .setOrigin(0.5, 1)
      .setDepth(depth + 1);
    const lock = this.scene.add
      .image(mid.x + label.width / 2 + 10, mid.y - LABEL_RISE - label.height / 2, iconKey('lock'))
      .setScale(2)
      .setDepth(depth + 1);
    return { spotId, start, dir: layout.dir, length, bobberAt: tip, label, lock };
  }
}

const gridPair = (p: GridPoint): [number, number] => [p.col, p.row];
