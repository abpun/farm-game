export const COLORS = {
  background: 0x2ea3b0,
  hud: 0x4a2f1b,
  panel: 0x5b3a22,
  panelBorder: 0x9a6436,
  ready: 0xffd54f,
  hover: 0xfff3d6,
  button: 0x8a5a32,
  buttonHover: 0xa36c3e,
  buttonActive: 0xc98a3a,
  buttonDisabled: 0x4d3424,
  progressTrack: 0x3a2414,
  progressFill: 0xa5c84a,
} as const;

export const PALETTE = {
  sea: 0x2ea3b0,
  seaLight: 0x5cc7cf,
  seaDark: 0x248c99,
  foam: 0xe8f6f2,
  sand: 0xe6cf98,
  sandShade: 0xc9ad72,
  cliff: 0xa8824f,
  cliffDark: 0x86643a,
  grass: 0xa3a548,
  grassDark: 0x86883a,
  grassLight: 0xbdb860,
  grassShadow: 0x667434,
  grassHighlight: 0xd6c977,
  sandLight: 0xf2e2b3,
  sandDark: 0xb8935c,
  wetSand: 0xa88a5a,
  cliffDeep: 0x5e4426,
  shallow: 0x4fbcc4,
  shallowLight: 0x7fd6d2,
  pathLight: 0xdcb97c,
  flowerWhite: 0xf4f0e0,
  flowerYellow: 0xf2d04a,
  flowerPurple: 0xa078c8,
  leafOrange: 0xe07b2a,
  leafRed: 0xc4471e,
  path: 0xcfa86a,
  pathDark: 0xb08a50,
  soil: 0x6b4426,
  soilDark: 0x4e2f19,
  furrow: 0x55351d,
  mound: 0x4e2f19,
  wood: 0x9a6436,
  woodLight: 0xc08a52,
  woodDark: 0x6e4423,
  woodDarker: 0x55331b,
  stake: 0xb98a55,
  trunk: 0x6b4423,
  rock: 0x9a9488,
  rockDark: 0x76716a,
  wall: 0xf0e2c4,
  wallShade: 0xd6c4a2,
  timber: 0x7a4a26,
  thatch: 0xd9b25a,
  thatchDark: 0xb8903e,
  thatchLight: 0xead083,
  glass: 0x3b4f63,
  stone: 0x8f8a80,
} as const;

export const FOLIAGE = {
  orange: { base: 0xe07b2a, light: 0xf2a33a, dark: 0xb85a1c },
  amber: { base: 0xe8a838, light: 0xf6c95a, dark: 0xb97f22 },
  red: { base: 0xc4471e, light: 0xe0703a, dark: 0x8f3015 },
} as const;

export interface FoliageColors {
  base: number;
  light: number;
  dark: number;
}

export const TEXT = {
  base: '#fff3d6',
  muted: '#e6cf98',
  gold: '#ffd54f',
  error: '#ff8a80',
  success: '#d4f59a',
} as const;

export const FONT = '"VT323", "Courier New", monospace';

export const textStyle = (size: number, color: string = TEXT.base) => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  color,
  stroke: '#3a2414',
  strokeThickness: 4,
});
