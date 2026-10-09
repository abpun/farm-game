import type { Catalog } from '../config/Catalog';
import type { CropRegistry } from '../config/CropRegistry';
import type { FarmState, PlotCrop } from '../entities/types';
import type { Clock } from './Clock';
import type { KeyValueStore } from './KeyValueStore';
import {
  isSaveFile,
  migrate,
  SAVE_VERSION,
  type SaveFile,
  type StoredPlot,
  type StoredState,
} from './saveFormat';

export const SAVE_KEYS = { main: 'farm-game.save', backup: 'farm-game.save.backup' } as const;

export interface LoadedSave {
  state: FarmState;
  savedAt: number | null;
  layoutPending: boolean;
  source: keyof typeof SAVE_KEYS;
}

export class SaveSystem {
  constructor(
    private readonly store: KeyValueStore,
    private readonly crops: CropRegistry,
    private readonly catalog: Catalog,
    private readonly clock: Clock,
  ) {}

  // The previous save is rotated into the backup slot before every write.
  save(state: FarmState): boolean {
    try {
      const previous = this.store.getItem(SAVE_KEYS.main);
      if (previous && this.parse(previous)) this.store.setItem(SAVE_KEYS.backup, previous);
      this.store.setItem(SAVE_KEYS.main, this.serialize(state));
      return true;
    } catch (error) {
      console.error('Save failed', error);
      return false;
    }
  }

  load(): LoadedSave | null {
    for (const source of ['main', 'backup'] as const) {
      const parsed = this.parse(this.read(SAVE_KEYS[source]));
      if (parsed) return { ...parsed, source };
    }
    return null;
  }

  export(state: FarmState): string {
    return this.serialize(state, 2);
  }

  import(text: string): boolean {
    const parsed = this.parse(text);
    if (!parsed) return false;
    const file: SaveFile = {
      version: SAVE_VERSION,
      savedAt: parsed.savedAt,
      layoutPending: parsed.layoutPending,
      state: parsed.state,
    };
    this.store.setItem(SAVE_KEYS.main, JSON.stringify(file));
    return true;
  }

  clear(): void {
    this.store.removeItem(SAVE_KEYS.main);
    this.store.removeItem(SAVE_KEYS.backup);
  }

  private serialize(state: FarmState, indent?: number): string {
    const file: SaveFile = { version: SAVE_VERSION, savedAt: this.clock.now(), state };
    return JSON.stringify(file, null, indent);
  }

  private read(key: string): string | null {
    try {
      return this.store.getItem(key);
    } catch {
      return null;
    }
  }

  private parse(raw: string | null): Omit<LoadedSave, 'source'> | null {
    if (!raw) return null;
    try {
      const file = migrate(JSON.parse(raw));
      if (!isSaveFile(file)) return null;
      return {
        state: this.sanitize(file.state),
        savedAt: file.savedAt,
        layoutPending: file.layoutPending === true,
      };
    } catch {
      return null;
    }
  }

  // Drops content removed from config so old saves never crash the game.
  private sanitize(state: StoredState): FarmState {
    const objects = state.objects.filter((object) => this.catalog.has(object.itemId));
    const bedIds = new Set(
      objects.filter((o) => this.catalog.get(o.itemId).kind === 'plot').map((o) => String(o.id)),
    );
    const plots = Object.fromEntries(
      Object.entries(state.plots)
        .filter(([id]) => bedIds.has(id))
        .map(([id, plot]) => [id, this.toPlotCrop(plot, state.time)]),
    );
    for (const id of bedIds) plots[id] ??= { cropId: null, growth: 0 };
    const inventory = Object.fromEntries(
      Object.entries(state.inventory).filter(([cropId]) => this.crops.has(cropId)),
    );
    const nextObjectId = Math.max(state.nextObjectId, ...objects.map((o) => o.id + 1));
    return { ...state, objects, plots, inventory, nextObjectId };
  }

  private toPlotCrop(plot: StoredPlot, time: number): PlotCrop {
    const cropId = plot.cropId && this.crops.has(plot.cropId) ? plot.cropId : null;
    if (!cropId) return { cropId: null, growth: 0 };
    const growth =
      'growth' in plot
        ? plot.growth
        : (time - plot.legacyPlantedAt) / this.crops.get(cropId).growthTimeSec;
    return { cropId, growth: Math.max(0, Math.min(1, growth)) };
  }
}
