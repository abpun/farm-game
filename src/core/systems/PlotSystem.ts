import type { CropRegistry } from '../config/CropRegistry';
import type { FarmState, PlotCrop } from '../entities/types';
import type { GameBus } from '../events/EventBus';
import type { SeasonSystem } from './SeasonSystem';

export interface Harvest {
  cropId: string;
  amount: number;
}

const DEFAULT_SEASON_RATE = 1;

export const emptyPlot = (): PlotCrop => ({
  cropId: null,
  growth: 0,
  watered: false,
  matured: false,
});

// Crop growth on garden beds and orchard plots; a plot is identified by its placed-object id.
export class PlotSystem {
  constructor(
    private readonly state: FarmState,
    private readonly crops: CropRegistry,
    private readonly seasons: SeasonSystem,
    private readonly bus: GameBus,
    private readonly waterBoost: number,
  ) {}

  ids(): number[] {
    return Object.keys(this.state.plots).map(Number);
  }

  isPlot(plotId: number): boolean {
    return String(plotId) in this.state.plots;
  }

  create(plotId: number): void {
    this.state.plots[String(plotId)] = emptyPlot();
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
      const rate = this.rate(plot, seasonId);
      plot.growth = Math.min(1, plot.growth + (dtSec * rate) / this.duration(plot));
    }
  }

  cropOf(plotId: number): string | null {
    return this.plot(plotId).cropId;
  }

  isEmpty(plotId: number): boolean {
    return this.plot(plotId).cropId === null;
  }

  isWatered(plotId: number): boolean {
    return this.plot(plotId).watered;
  }

  progress(plotId: number): number {
    const { cropId, growth } = this.plot(plotId);
    return cropId ? growth : 0;
  }

  /** Seconds until ready at the current pace; Infinity while dormant. */
  secondsRemaining(plotId: number): number {
    const plot = this.plot(plotId);
    if (!plot.cropId || plot.growth >= 1) return 0;
    const rate = this.rate(plot, this.seasons.current().id);
    if (rate <= 0) return Infinity;
    return ((1 - plot.growth) * this.duration(plot)) / rate;
  }

  isReady(plotId: number): boolean {
    return !this.isEmpty(plotId) && this.progress(plotId) >= 1;
  }

  /** Art stage; a regrowing crop stays mature-looking between harvests. */
  stage(plotId: number): number {
    const plot = this.plot(plotId);
    if (!plot.cropId) return 0;
    const lastStage = this.crops.get(plot.cropId).stages - 1;
    if (this.isReady(plotId)) return lastStage;
    if (plot.matured) return lastStage - 1;
    return Math.floor(plot.growth * lastStage);
  }

  plant(plotId: number, cropId: string): boolean {
    const plot = this.plot(plotId);
    if (plot.cropId !== null) return false;
    Object.assign(plot, emptyPlot(), { cropId });
    this.bus.emit('CropPlanted', { plotId, cropId });
    this.bus.emit('PlotUpdated', { plotId });
    return true;
  }

  water(plotId: number): boolean {
    const plot = this.plot(plotId);
    if (!plot.cropId || plot.watered || plot.growth >= 1) return false;
    plot.watered = true;
    this.bus.emit('CropWatered', { plotId });
    this.bus.emit('PlotUpdated', { plotId });
    return true;
  }

  /** What a harvest would yield right now, without taking it. */
  peekHarvest(plotId: number): Harvest | null {
    if (!this.isReady(plotId)) return null;
    const cropId = this.plot(plotId).cropId as string;
    return { cropId, amount: this.crops.get(cropId).yield };
  }

  harvest(plotId: number): Harvest | null {
    const harvest = this.peekHarvest(plotId);
    if (!harvest) return null;
    const plot = this.plot(plotId);
    const regrows = this.crops.get(harvest.cropId).regrowSec !== undefined;
    if (regrows) Object.assign(plot, { growth: 0, watered: false, matured: true });
    else Object.assign(plot, emptyPlot());
    this.bus.emit('PlotUpdated', { plotId });
    return harvest;
  }

  /** Digs up whatever is planted (used to make room after a regrowing crop). */
  clear(plotId: number): boolean {
    const plot = this.plot(plotId);
    if (!plot.cropId) return false;
    Object.assign(plot, emptyPlot());
    this.bus.emit('PlotUpdated', { plotId });
    return true;
  }

  private rate(plot: PlotCrop, seasonId: string): number {
    const season = this.seasonRate(plot.cropId as string, seasonId);
    return plot.watered ? season * this.waterBoost : season;
  }

  private duration(plot: PlotCrop): number {
    const crop = this.crops.get(plot.cropId as string);
    return plot.matured && crop.regrowSec ? crop.regrowSec : crop.growthTimeSec;
  }

  private plot(plotId: number): PlotCrop {
    const plot = this.state.plots[String(plotId)];
    if (!plot) throw new Error(`Unknown plot: ${plotId}`);
    return plot;
  }
}
