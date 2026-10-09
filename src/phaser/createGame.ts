import * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { GAME_HEIGHT, GAME_WIDTH } from './layout';
import { BootScene } from './scenes/BootScene';
import { FarmScene } from './scenes/FarmScene';
import { UIScene } from './scenes/UIScene';
import { provideGameContext } from './session';
import { COLORS } from './theme';

export function createGame(parent: string, session: GameSession): Phaser.Game {
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
    scene: [BootScene, FarmScene, UIScene],
  });
  provideGameContext(game, session);
  return game;
}
