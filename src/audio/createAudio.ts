import ambience from '@data/ambience.json';
import music from '@data/music.json';
import sounds from '@data/sounds.json';
import type { SettingsStore } from '@core/settings/SettingsStore';
import { AudioEngine } from './AudioEngine';
import { SoundBank } from './SoundBank';
import type { AmbienceData, MusicData, SoundsData } from './types';

/** Builds the engine and starts baking in the background; the game never waits on it. */
export function createAudio(settings: SettingsStore, firstTrack: string): AudioEngine {
  const bank = new SoundBank(sounds as SoundsData, music as MusicData, ambience as AmbienceData);
  const engine = new AudioEngine(bank, settings);
  void bank.bakeAll(firstTrack);
  return engine;
}
