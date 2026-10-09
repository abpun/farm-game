import type * as Phaser from 'phaser';
import type { AudioEngine } from '@audio/AudioEngine';
import type { GameSession } from '@core/GameSession';
import type { SettingsStore } from '@core/settings/SettingsStore';
import type { GameServices } from './createGame';
import { ToolState } from './tools';
import { createUiBus, type UiBus } from './uiEvents';

const SESSION_KEY = 'session';
const TOOLS_KEY = 'tools';
const UI_BUS_KEY = 'uiBus';
const SETTINGS_KEY = 'settings';
const AUDIO_KEY = 'audio';

export function provideGameContext(
  game: Phaser.Game,
  session: GameSession,
  services: GameServices,
): void {
  game.registry.set(SESSION_KEY, session);
  game.registry.set(SETTINGS_KEY, services.settings);
  game.registry.set(AUDIO_KEY, services.audio);
  game.registry.set(TOOLS_KEY, new ToolState());
  game.registry.set(UI_BUS_KEY, createUiBus());
}

export const getSession = (scene: Phaser.Scene): GameSession =>
  scene.registry.get(SESSION_KEY) as GameSession;

export const getTools = (scene: Phaser.Scene): ToolState =>
  scene.registry.get(TOOLS_KEY) as ToolState;

export const getUiBus = (scene: Phaser.Scene): UiBus => scene.registry.get(UI_BUS_KEY) as UiBus;

export const getSettings = (scene: Phaser.Scene): SettingsStore =>
  scene.registry.get(SETTINGS_KEY) as SettingsStore;

/** Undefined only for scenes outside the game (e.g. tests); callers just skip sound. */
export const getAudio = (scene: Phaser.Scene): AudioEngine | undefined =>
  scene.registry.get(AUDIO_KEY) as AudioEngine | undefined;
