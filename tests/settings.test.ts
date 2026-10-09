import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@core/save/KeyValueStore';
import { SAVE_KEYS } from '@core/save/SaveSystem';
import { channelGain, DEFAULT_SETTINGS, normalizeSettings } from '@core/settings/settings';
import { SETTINGS_KEY, SettingsStore } from '@core/settings/SettingsStore';

describe('settings', () => {
  it('uses safe defaults for new players', () => {
    const settings = new SettingsStore(new MemoryStore()).get();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.volume.music).toBeLessThan(settings.volume.sfx);
  });

  it('persists changes and restores them on the next start', () => {
    const store = new MemoryStore();
    const first = new SettingsStore(store);
    first.setVolume('music', 0.2);
    first.setMuted('sfx', true);
    first.setFlag('screenShake', false);
    const second = new SettingsStore(store).get();
    expect(second.volume.music).toBe(0.2);
    expect(second.muted.sfx).toBe(true);
    expect(second.screenShake).toBe(false);
  });

  it('repairs malformed, partial and outdated settings', () => {
    expect(normalizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    const repaired = normalizeSettings({
      version: 0,
      volume: { master: 7, music: 'loud', sfx: -1 },
      muted: { music: 'yes', ambient: true },
      reducedMotion: true,
      extra: 1,
    });
    expect(repaired.volume).toEqual({ ...DEFAULT_SETTINGS.volume, master: 1, sfx: 0 });
    expect(repaired.muted).toEqual({ ...DEFAULT_SETTINGS.muted, ambient: true });
    expect(repaired.reducedMotion).toBe(true);
    expect(repaired).not.toHaveProperty('extra');

    const store = new MemoryStore();
    store.setItem(SETTINGS_KEY, '{not json');
    expect(new SettingsStore(store).get()).toEqual(DEFAULT_SETTINGS);
  });

  it('notifies listeners only when something actually changed', () => {
    const settings = new SettingsStore(new MemoryStore());
    let calls = 0;
    settings.onChange(() => calls++);
    settings.setVolume('sfx', 0.5);
    settings.setVolume('sfx', 0.5);
    expect(calls).toBe(1);
  });

  it('resets preferences without touching the farm save', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEYS.main, 'farm');
    const settings = new SettingsStore(store, { reducedMotion: true });
    settings.setVolume('master', 0.1);
    settings.setFlag('reducedMotion', false);
    settings.reset();
    expect(settings.get().volume.master).toBe(DEFAULT_SETTINGS.volume.master);
    expect(settings.get().reducedMotion).toBe(true);
    expect(store.getItem(SAVE_KEYS.main)).toBe('farm');
  });

  it('combines master volume, channel volume and mutes', () => {
    const settings = normalizeSettings({ volume: { master: 0.5, music: 0.5 } });
    expect(channelGain(settings, 'music')).toBeCloseTo(0.25);
    expect(channelGain({ ...settings, muted: { ...settings.muted, music: true } }, 'music')).toBe(
      0,
    );
    expect(channelGain({ ...settings, muted: { ...settings.muted, master: true } }, 'sfx')).toBe(0);
  });
});
