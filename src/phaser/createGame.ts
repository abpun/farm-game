import * as Phaser from 'phaser';
import type { AudioEngine } from '@audio/AudioEngine';
import type { GameSession } from '@core/GameSession';
import type { SettingsStore } from '@core/settings/SettingsStore';
import { GAME_HEIGHT, GAME_WIDTH } from './layout';
import { BootScene } from './scenes/BootScene';
import { FarmScene } from './scenes/FarmScene';
import { UIScene } from './scenes/UIScene';
import { provideGameContext } from './session';
import { COLORS } from './theme';

export interface GameServices {
  settings: SettingsStore;
  audio: AudioEngine;
}

export function createGame(
  parent: string,
  session: GameSession,
  services: GameServices,
): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: COLORS.background,
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    // Sound goes through our own AudioEngine, so Phaser needn't open a second context.
    audio: { noAudio: true },
    scene: [BootScene, FarmScene, UIScene],
  });
  provideGameContext(game, session, services);
  game.events.once(Phaser.Core.Events.DESTROY, () => services.audio.destroy());
  return game;
}
