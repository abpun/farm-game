import type { CropRegistry } from '../config/CropRegistry';
import type { FarmState, PlotCrop } from '../entities/types';
import type { GameBus } from '../events/EventBus';
import type { SeasonSystem } from './SeasonSystem';

export interface Harvest {
  cropId: string;
  amount: number;
}

const DEFAULT_SEASON_RATE = 1;

// Crop growth on garden beds; a bed is identified by its placed-object id.
export class PlotSystem {
  constructor(
    private readonly state: FarmState,
    private readonly crops: CropRegistry,
    private readonly seasons: SeasonSystem,
    private readonly bus: GameBus,
  ) {}

  ids(): number[] {
    return Object.keys(this.state.plots).map(Number);
  }

  isPlot(plotId: number): boolean {
    return String(plotId) in this.state.plots;
  }

  create(plotId: number): void {
    this.state.plots[String(plotId)] = { cropId: null, growth: 0 };
  }

  delete(plotId: number): void {
    delete this.state.plots[String(plotId)];
  }

  /** Growth speed multiplier for a crop in a season (defaults to the current one). */
  seasonRate(cropId: string, seasonId = this.seasons.current().id): number {
    return this.crops.get(cropId).seasonGrowth[seasonId] ?? DEFAULT_SEASON_RATE;
  }

  /** Advances every growing crop; the caller keeps each step inside a single season. */
  grow(dtSec: number, seasonId: string): void {
    for (const plot of Object.values(this.state.plots)) {
      if (!plot.cropId || plot.growth >= 1) continue;
      const rate = this.seasonRate(plot.cropId, seasonId);
      plot.growth = Math.min(
        1,
        plot.growth + (dtSec * rate) / this.crops.get(plot.cropId).growthTimeSec,
      );
    }
  }

  cropOf(plotId: number): string | null {
    return this.plot(plotId).cropId;
  }

  isEmpty(plotId: number): boolean {
    return this.plot(plotId).cropId === null;
  }

  progress(plotId: number): number {
    const { cropId, growth } = this.plot(plotId);
    return cropId ? growth : 0;
  }

  /** Seconds until ready at the current season's pace; Infinity while dormant. */
  secondsRemaining(plotId: number): number {
    const { cropId, growth } = this.plot(plotId);
    if (!cropId || growth >= 1) return 0;
    const rate = this.seasonRate(cropId);
    if (rate <= 0) return Infinity;
    return ((1 - growth) * this.crops.get(cropId).growthTimeSec) / rate;
  }

  isReady(plotId: number): boolean {
    return !this.isEmpty(plotId) && this.progress(plotId) >= 1;
  }

  stage(plotId: number): number {
    const { cropId } = this.plot(plotId);
    if (!cropId) return 0;
    const lastStage = this.crops.get(cropId).stages - 1;
    return this.isReady(plotId) ? lastStage : Math.floor(this.progress(plotId) * lastStage);
  }

  plant(plotId: number, cropId: string): boolean {
    const plot = this.plot(plotId);
    if (plot.cropId !== null) return false;
    plot.cropId = cropId;
    plot.growth = 0;
    this.bus.emit('CropPlanted', { plotId, cropId });
    this.bus.emit('PlotUpdated', { plotId });
    return true;
  }

  harvest(plotId: number): Harvest | null {
    if (!this.isReady(plotId)) return null;
    const plot = this.plot(plotId);
    const cropId = plot.cropId as string;
    plot.cropId = null;
    plot.growth = 0;
    this.bus.emit('PlotUpdated', { plotId });
    return { cropId, amount: this.crops.get(cropId).yield };
  }

  private plot(plotId: number): PlotCrop {
    const plot = this.state.plots[String(plotId)];
    if (!plot) throw new Error(`Unknown plot: ${plotId}`);
    return plot;
  }
}
