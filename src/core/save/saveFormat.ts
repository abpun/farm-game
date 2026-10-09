import type { FarmState, PlacedObject, PlotCrop } from '../entities/types';

export const SAVE_VERSION = 4;

export interface SaveFile {
  version: number;
  /** Epoch ms of the last save; null for saves written before timestamps existed. */
  savedAt: number | null;
  /** Set by migrations when the starter layout should be merged in on next load. */
  layoutPending?: boolean;
  state: StoredState;
}

/** A bed as stored: v4 growth, or a migrated bed still carrying its old planting time. */
export type StoredPlot = PlotCrop | { cropId: string | null; legacyPlantedAt: number };
export type StoredState = Omit<FarmState, 'plots'> & { plots: Record<string, StoredPlot> };

type RawFile = Record<string, unknown>;
type Migration = (file: RawFile) => RawFile;

// Frozen v2 facts: beds were one fixed grid; v3 re-homes them on tiles clear of the farm path.
const V2_BED_SLOTS: Array<[number, number]> = [3, 5, 6, 8, 9, 10].flatMap((col) =>
  [4, 5, 6, 7].map((row): [number, number] => [col, row]),
);

// Each entry upgrades a save from version N to N + 1. Never edit a shipped migration.
const MIGRATIONS: Record<number, Migration> = {
  1: (file) => ({ ...file, version: 2, savedAt: null }),
  2: (file) => {
    const state = isRecord(file.state) ? file.state : {};
    const oldPlots = Array.isArray(state.plots) ? (state.plots as unknown[]) : [];
    const objects: PlacedObject[] = [];
    const plots: Record<string, { cropId: string | null; plantedAt: number }> = {};
    oldPlots.forEach((plot, index) => {
      const id = index + 1;
      const crop = isRecord(plot) ? plot : {};
      const [col, row] = V2_BED_SLOTS[index] ?? [0, index];
      objects.push({ id, itemId: 'plot', col, row });
      plots[String(id)] = {
        cropId: typeof crop.cropId === 'string' ? crop.cropId : null,
        plantedAt: isFiniteNumber(crop.plantedAt) ? crop.plantedAt : 0,
      };
    });
    const { money, time, inventory } = state;
    return {
      ...file,
      version: 3,
      layoutPending: true,
      state: { money, time, inventory, nextObjectId: objects.length + 1, objects, plots },
    };
  },
  // v4 tracks growth progress instead of planting time; SaveSystem converts legacyPlantedAt.
  3: (file) => {
    const state = isRecord(file.state) ? file.state : {};
    const oldPlots = isRecord(state.plots) ? state.plots : {};
    const plots = Object.fromEntries(
      Object.entries(oldPlots).map(([id, plot]) => {
        const crop = isRecord(plot) ? plot : {};
        return [id, { cropId: crop.cropId ?? null, legacyPlantedAt: crop.plantedAt ?? 0 }];
      }),
    );
    return { ...file, version: 4, state: { ...state, plots } };
  },
};

export function migrate(input: unknown): unknown {
  if (!isRecord(input) || typeof input.version !== 'number') return null;
  let file: RawFile = input;
  while ((file.version as number) < SAVE_VERSION) {
    const step = MIGRATIONS[file.version as number];
    if (!step) return null;
    file = step(file);
  }
  return file.version === SAVE_VERSION ? file : null;
}

export function isSaveFile(value: unknown): value is SaveFile {
  if (!isRecord(value)) return false;
  const savedAtValid = value.savedAt === null || isFiniteNumber(value.savedAt);
  return value.version === SAVE_VERSION && savedAtValid && isFarmState(value.state);
}

function isFarmState(value: unknown): value is StoredState {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.money) &&
    isFiniteNumber(value.time) &&
    value.time >= 0 &&
    isFiniteNumber(value.nextObjectId) &&
    isRecord(value.inventory) &&
    Object.values(value.inventory).every((count) => isFiniteNumber(count) && count >= 0) &&
    Array.isArray(value.objects) &&
    value.objects.every(isPlacedObject) &&
    isRecord(value.plots) &&
    Object.values(value.plots).every(isPlotCrop)
  );
}

function isPlacedObject(value: unknown): value is PlacedObject {
  return (
    isRecord(value) &&
    isFiniteNumber(value.id) &&
    typeof value.itemId === 'string' &&
    isFiniteNumber(value.col) &&
    isFiniteNumber(value.row)
  );
}

function isPlotCrop(value: unknown): value is StoredPlot {
  return (
    isRecord(value) &&
    (value.cropId === null || typeof value.cropId === 'string') &&
    (isFiniteNumber(value.growth) || isFiniteNumber(value.legacyPlantedAt))
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
