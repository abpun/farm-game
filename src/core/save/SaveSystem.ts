import type { Content } from '../config/Content';
import type { FarmState } from '../entities/types';
import type { Clock } from './Clock';
import type { KeyValueStore } from './KeyValueStore';
import { normalizeState } from './normalizeState';
import { isSaveFile, migrate, SAVE_VERSION, type SaveFile } from './saveFormat';

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
    private readonly content: Content,
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
        state: normalizeState(file.state, this.content),
        savedAt: file.savedAt,
        layoutPending: file.layoutPending === true,
      };
    } catch {
      return null;
    }
  }
}
