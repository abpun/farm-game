import { FONT } from '../theme';

// UI art pixels are upscaled by this factor; keep widget sizes multiples of it.
export const UI_PX = 3;

export const UI_COLORS = {
  outline: 0x3a1f0e,
  woodLight: 0xe8a35c,
  wood: 0xc47a3a,
  woodDark: 0x8a4f22,
  woodDeep: 0x6b3a18,
  parchment: 0xf6dca4,
  parchmentLight: 0xfff0c8,
  parchmentShade: 0xe2bd7c,
  parchmentDark: 0xc99a58,
  plaque: 0x5b3418,
  select: 0x5e9a34,
  selectLight: 0xa6d65e,
  selectFill: 0xe3f0b4,
  disabled: 0x9b8a78,
  disabledLight: 0xb8a894,
  disabledDark: 0x6e6052,
  backdrop: 0x1a0f08,
} as const;

export const UI_TEXT = {
  dark: '#4a2410',
  light: '#fff1d0',
  gold: '#ffd75e',
  muted: '#8a5a32',
  danger: '#b8381e',
  good: '#3f7a1e',
} as const;

export const FONT_SIZE = { small: 24, body: 28, title: 32, big: 40 } as const;

export const uiText = (size: number, color: string = UI_TEXT.dark) => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  color,
});

// Light text over wood gets a one-art-pixel drop shadow instead of a soft stroke.
export const uiTextOnWood = (size: number, color: string = UI_TEXT.light) => ({
  ...uiText(size, color),
  shadow: { offsetX: UI_PX / 2, offsetY: UI_PX / 2, color: '#3a1f0e', fill: true },
});

export const snap = (value: number): number => Math.round(value / UI_PX) * UI_PX;
