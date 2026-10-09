import { UI_PX } from '../ui/uiTheme';
import type { BurstSpec } from './ParticlePool';

const GOLD = [0xffd75e, 0xfff3c0, 0xf6c544];

// Timings and recipes for HUD feedback; everything here finishes in about a second.
export const UI_FX = {
  floatDistance: UI_PX * 8,
  floatHoldMs: 350,
  floatMs: 650,
  flyMs: 520,
  flyShrink: 0.5,
  arcHeight: UI_PX * 30,
  bannerY: UI_PX * 80,
  bannerPop: 0.7,
  bannerInMs: 240,
  bannerHoldMs: 1700,
  bannerOutMs: 300,
  hop: UI_PX * 3,
  hopMs: 90,
  nudge: UI_PX * 2,
  nudgeMs: 45,
  dimAlpha: 0.5,
  shake: { ms: 140, intensity: 0.003 },
  coins: {
    count: 8,
    colors: GOLD,
    speed: [40, 110],
    angle: [-160, -20],
    gravity: 260,
    life: [350, 550],
    spread: 12,
  } satisfies BurstSpec,
  stars: {
    count: 22,
    colors: [...GOLD, 0xffffff],
    speed: [60, 180],
    angle: [0, 360],
    gravity: 60,
    life: [600, 900],
    spread: 30,
  } satisfies BurstSpec,
  sparkle: {
    count: 10,
    colors: GOLD,
    speed: [30, 80],
    angle: [0, 360],
    gravity: 0,
    life: [400, 700],
    spread: 12,
  } satisfies BurstSpec,
} as const;
