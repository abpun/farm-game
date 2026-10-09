import { EventBus } from '../events/EventBus';
import type { KeyValueStore } from '../save/KeyValueStore';
import {
  cloneSettings,
  DEFAULT_SETTINGS,
  normalizeSettings,
  type Settings,
  type VolumeChannel,
} from './settings';

export const SETTINGS_KEY = 'farm-game.settings';

interface SettingsEvents {
  changed: Settings;
}

type FlagName = 'screenShake' | 'visualEffects' | 'reducedMotion';

// Player preferences, stored apart from the farm save so neither can corrupt the other.
export class SettingsStore {
  private readonly bus = new EventBus<SettingsEvents>();
  private readonly defaults: Settings;
  private current: Settings;

  constructor(
    private readonly store: KeyValueStore,
    defaults: Partial<Pick<Settings, FlagName>> = {},
  ) {
    this.defaults = { ...cloneSettings(DEFAULT_SETTINGS), ...defaults };
    this.current = normalizeSettings(this.read(), this.defaults);
  }

  get(): Readonly<Settings> {
    return this.current;
  }

  defaultsCopy(): Settings {
    return cloneSettings(this.defaults);
  }

  onChange(listener: (settings: Settings) => void): () => void {
    return this.bus.on('changed', listener);
  }

  setVolume(channel: VolumeChannel, value: number): void {
    this.apply((s) => (s.volume[channel] = value));
  }

  setMuted(channel: VolumeChannel, muted: boolean): void {
    this.apply((s) => (s.muted[channel] = muted));
  }

  setFlag(flag: FlagName, value: boolean): void {
    this.apply((s) => (s[flag] = value));
  }

  /** Restores every preference; the farm save is a different key and stays untouched. */
  reset(): void {
    this.apply((s) => Object.assign(s, this.defaultsCopy()));
  }

  private apply(change: (draft: Settings) => void): void {
    const draft = cloneSettings(this.current);
    change(draft);
    const next = normalizeSettings(draft, this.defaults);
    if (JSON.stringify(next) === JSON.stringify(this.current)) return;
    this.current = next;
    this.write();
    this.bus.emit('changed', this.current);
  }

  private read(): unknown {
    try {
      const text = this.store.getItem(SETTINGS_KEY);
      return text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return null;
    }
  }

  private write(): void {
    try {
      this.store.setItem(SETTINGS_KEY, JSON.stringify(this.current));
    } catch (error) {
      console.warn('Settings could not be saved', error);
    }
  }
}
