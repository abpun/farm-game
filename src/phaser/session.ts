import type * as Phaser from 'phaser';
import type { GameSession } from '@core/GameSession';
import { ToolState } from './tools';
import { createUiBus, type UiBus } from './uiEvents';

const SESSION_KEY = 'session';
const TOOLS_KEY = 'tools';
const UI_BUS_KEY = 'uiBus';

export function provideGameContext(game: Phaser.Game, session: GameSession): void {
  game.registry.set(SESSION_KEY, session);
  game.registry.set(TOOLS_KEY, new ToolState());
  game.registry.set(UI_BUS_KEY, createUiBus());
}

export const getSession = (scene: Phaser.Scene): GameSession =>
  scene.registry.get(SESSION_KEY) as GameSession;

export const getTools = (scene: Phaser.Scene): ToolState =>
  scene.registry.get(TOOLS_KEY) as ToolState;

export const getUiBus = (scene: Phaser.Scene): UiBus => scene.registry.get(UI_BUS_KEY) as UiBus;
