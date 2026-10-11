import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import music from '@data/music.json';
import { createAudio } from '@audio/createAudio';
import { pickTrack } from '@audio/musicDirector';
import type { MusicData } from '@audio/types';
import { loadConfig } from '@core/config/loadConfig';
import { GameSession } from '@core/GameSession';
import { SettingsStore } from '@core/settings/SettingsStore';
import { createGame } from '@game/createGame';
import { FONT } from '@game/theme';
import { DEBUG_MODE } from '@core/debug';
import { createBrowserStore } from './platform/browserStore';
import { prefersReducedMotion } from './platform/motion';

async function main(): Promise<void> {
  // Phaser rasterises text once, so the UI font (regular and bold) must be ready first.
  await Promise.all([
    document.fonts.load(`400 20px ${FONT}`),
    document.fonts.load(`700 20px ${FONT}`),
  ]).catch(() => undefined);
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

  if (import.meta.env.DEV || DEBUG_MODE) {
    Object.assign(window, {
      __farm: session,
      __audio: audio,
      __settings: settings,
      __game: game,
      __debug: DEBUG_MODE,
    });
  }
}

void main();
