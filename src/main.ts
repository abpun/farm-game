import '@fontsource/vt323/400.css';
import music from '@data/music.json';
import { createAudio } from '@audio/createAudio';
import { pickTrack } from '@audio/musicDirector';
import type { MusicData } from '@audio/types';
import { loadConfig } from '@core/config/loadConfig';
import { GameSession } from '@core/GameSession';
import { SettingsStore } from '@core/settings/SettingsStore';
import { createGame } from '@game/createGame';
import { FONT } from '@game/theme';
import { createBrowserStore } from './platform/browserStore';
import { prefersReducedMotion } from './platform/motion';

async function main(): Promise<void> {
  // Phaser rasterises text once, so the pixel font must be ready before the first scene.
  await document.fonts.load(`20px ${FONT}`).catch(() => undefined);
  const store = createBrowserStore();
  // Settings load first so the very first sound already respects volume and mutes.
  const settings = new SettingsStore(store, { reducedMotion: prefersReducedMotion() });
  const session = new GameSession(loadConfig(), store);
  const firstTrack = pickTrack(music as MusicData, {
    seasonId: session.seasons.current().id,
    fishing: false,
  });
  const audio = createAudio(settings, firstTrack);
  const game = createGame('game', session, { settings, audio });

  // Dev-only console handles, e.g. __farm.update(60) to fast-forward a minute.
  if (import.meta.env.DEV) {
    Object.assign(window, { __farm: session, __audio: audio, __settings: settings, __game: game });
  }
}

void main();
