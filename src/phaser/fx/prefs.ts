import type * as Phaser from 'phaser';
import { getSettings } from '../session';

// Live reads of the player's presentation preferences; widgets ask at the moment they animate.

export const reducedMotion = (scene: Phaser.Scene): boolean =>
  getSettings(scene)?.get().reducedMotion ?? false;

/** Optional particles and flourishes (never information the player needs). */
export const effectsEnabled = (scene: Phaser.Scene): boolean =>
  getSettings(scene)?.get().visualEffects ?? true;

export const shakeEnabled = (scene: Phaser.Scene): boolean => {
  const settings = getSettings(scene)?.get();
  return Boolean(settings?.screenShake && !settings.reducedMotion);
};
