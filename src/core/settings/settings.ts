export const SETTINGS_VERSION = 1;

export const VOLUME_CHANNELS = ['master', 'music', 'sfx', 'ambient'] as const;
export type VolumeChannel = (typeof VOLUME_CHANNELS)[number];

export interface Settings {
  version: number;
  /** 0..1 per channel; the effective level of a sound is master × its channel. */
  volume: Record<VolumeChannel, number>;
  muted: Record<VolumeChannel, boolean>;
  screenShake: boolean;
  /** Optional particles and flourishes; core feedback (text, sounds) stays on. */
  visualEffects: boolean;
  /** Drops ambient motion and shortens or skips movement-heavy animations. */
  reducedMotion: boolean;
}

// Music sits under effects so gameplay feedback stays clear.
export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  volume: { master: 0.8, music: 0.45, sfx: 0.8, ambient: 0.5 },
  muted: { master: false, music: false, sfx: false, ambient: false },
  screenShake: true,
  visualEffects: true,
  reducedMotion: false,
};

export const cloneSettings = (settings: Settings): Settings => ({
  ...settings,
  volume: { ...settings.volume },
  muted: { ...settings.muted },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const volumeOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

const flagOr = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/** Repairs anything read from storage: unknown fields dropped, bad values replaced by defaults. */
export function normalizeSettings(raw: unknown, defaults: Settings = DEFAULT_SETTINGS): Settings {
  const source = isRecord(raw) ? raw : {};
  const volume = isRecord(source.volume) ? source.volume : {};
  const muted = isRecord(source.muted) ? source.muted : {};
  const settings = cloneSettings(defaults);
  for (const channel of VOLUME_CHANNELS) {
    settings.volume[channel] = volumeOr(volume[channel], defaults.volume[channel]);
    settings.muted[channel] = flagOr(muted[channel], defaults.muted[channel]);
  }
  settings.screenShake = flagOr(source.screenShake, defaults.screenShake);
  settings.visualEffects = flagOr(source.visualEffects, defaults.visualEffects);
  settings.reducedMotion = flagOr(source.reducedMotion, defaults.reducedMotion);
  settings.version = SETTINGS_VERSION;
  return settings;
}

/** Effective 0..1 gain for a channel, counting master volume and every mute. */
export function channelGain(settings: Settings, channel: Exclude<VolumeChannel, 'master'>): number {
  if (settings.muted.master || settings.muted[channel]) return 0;
  return settings.volume.master * settings.volume[channel];
}
