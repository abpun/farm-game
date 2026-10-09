import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { BED_TEXTURES } from '../art/BedArtist';
import { cropTextureKey } from '../art/CropArtist';
import { addArt } from '../art/paint';
import type { IsoGrid, Point } from '../iso/IsoGrid';
import { COLORS } from '../theme';
import { CROP_LAYER } from '../world/itemArt';

const BAR_HEIGHT = 6;
const BAR_WIDTH_RATIO = 0.45;
const BAR_DEPTH = 10000;
const PULSE_MS = 600;
const DORMANT_TINT = 0xa8bcd8;

// Crop sprite, ready glow and hover progress bar for one garden bed (the bed itself is in WorldView).
export class PlotView {
  private readonly outline: Phaser.GameObjects.Image;
  private readonly crop: Phaser.GameObjects.Image;
  private readonly barTrack: Phaser.GameObjects.Rectangle;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly barWidth: number;
  private readonly centerPoint: Point;
  private cropKey: string | null = null;
  private pulse: Phaser.Tweens.Tween | null = null;
  private hovered = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    grid: IsoGrid,
    readonly plotId: number,
    col: number,
    row: number,
    baseDepth: number,
  ) {
    const top = grid.tileTop(col, row);
    const left = top.x - grid.tileW / 2;
    this.centerPoint = grid.tileCenter(col, row);
    this.barWidth = grid.tileW * BAR_WIDTH_RATIO;
    this.outline = addArt(scene, left, top.y, BED_TEXTURES.outline)
      .setDepth(baseDepth + 1)
      .setVisible(false);
    this.crop = addArt(scene, left, top.y - grid.cropHeadroom, BED_TEXTURES.bed)
      .setDepth(baseDepth + CROP_LAYER)
      .setVisible(false);

    const barX = this.centerPoint.x - this.barWidth / 2;
    const barY = top.y - grid.tileH * 0.15;
    this.barTrack = scene.add
      .rectangle(barX, barY, this.barWidth, BAR_HEIGHT, COLORS.progressTrack)
      .setOrigin(0)
      .setDepth(BAR_DEPTH);
    this.barFill = scene.add
      .rectangle(barX, barY, 0, BAR_HEIGHT, COLORS.progressFill)
      .setOrigin(0)
      .setDepth(BAR_DEPTH);
    this.refresh();
  }

  center(): Point {
    return this.centerPoint;
  }

  setHovered(hovered: boolean): void {
    this.hovered = hovered;
    this.refresh();
  }

  refresh(): void {
    const { plots } = this.session;
    const cropId = plots.cropOf(this.plotId);
    const ready = plots.isReady(this.plotId);
    const showProgress = cropId !== null && !ready && this.hovered;

    this.barTrack.setVisible(showProgress);
    this.barFill
      .setVisible(showProgress)
      .setSize(this.barWidth * plots.progress(this.plotId), BAR_HEIGHT);
    this.updateCrop(cropId ? cropTextureKey(cropId, plots.stage(this.plotId)) : null);
    this.updateGlow(ready);
    const dormant = cropId !== null && !ready && plots.seasonRate(cropId) <= 0;
    if (dormant) this.crop.setTint(DORMANT_TINT);
    else this.crop.clearTint();
  }

  destroy(): void {
    this.pulse?.stop();
    [this.outline, this.crop, this.barTrack, this.barFill].forEach((object) => object.destroy());
  }

  private updateCrop(key: string | null): void {
    if (key === this.cropKey) return;
    this.cropKey = key;
    this.crop.setVisible(key !== null);
    if (key) this.crop.setTexture(key);
  }

  private updateGlow(ready: boolean): void {
    if (ready === (this.pulse !== null)) return;
    this.pulse?.stop();
    this.pulse = null;
    this.outline.setVisible(ready).setTint(COLORS.ready).setAlpha(1);
    if (!ready) return;
    this.pulse = this.scene.tweens.add({
      targets: this.outline,
      alpha: 0.35,
      duration: PULSE_MS,
      yoyo: true,
      repeat: -1,
    });
  }
}
