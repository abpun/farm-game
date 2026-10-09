import '@fontsource/vt323/400.css';
import { loadConfig } from '@core/config/loadConfig';
import { GameSession } from '@core/GameSession';
import { createGame } from '@game/createGame';
import { FONT } from '@game/theme';
import { createBrowserStore } from './platform/browserStore';

async function main(): Promise<void> {
  // Phaser rasterises text once, so the pixel font must be ready before the first scene.
  await document.fonts.load(`20px ${FONT}`).catch(() => undefined);
  const session = new GameSession(loadConfig(), createBrowserStore());
  createGame('game', session);

  // Dev-only console handle, e.g. __farm.update(60) to fast-forward a minute.
  if (import.meta.env.DEV) Object.assign(window, { __farm: session });
}

void main();
