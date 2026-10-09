import type * as Phaser from 'phaser';
import type { PlayOptions } from '@audio/AudioEngine';
import { getAudio } from '../session';

/** Fire-and-forget sound from any scene object; silently skipped when audio is unavailable. */
export function playCue(scene: Phaser.Scene, cue: string, options?: PlayOptions): void {
  getAudio(scene)?.play(cue, options);
}
