import { FOLIAGE, PALETTE, type FoliageColors } from '../theme';

export type AmbientKind = 'leaves' | 'petals' | 'snow' | 'none';

export interface GrassRamp {
  shadow: number;
  dark: number;
  base: number;
  light: number;
  highlight: number;
}

export interface SeasonLook {
  grass: GrassRamp;
  /** Little ground details: fallen leaves, petals or exposed grass under snow. */
  groundAccents: number[];
  accentDensity: number;
  flowers: number[];
  flowerDensity: number;
  /** Per tree family; null means bare branches. */
  foliage: Record<keyof typeof FOLIAGE, FoliageColors | null>;
  snow: boolean;
  ambient: { kind: AmbientKind; colors: number[]; count: number };
}

const BLOSSOM: FoliageColors = { base: 0xf2a7c3, light: 0xfdd3e3, dark: 0xc9789a };
const SPRING_GREEN: FoliageColors = { base: 0x7cc04a, light: 0xa8dd6a, dark: 0x4f8f34 };
const SUMMER_GREEN: FoliageColors = { base: 0x4f9a3a, light: 0x79bf4c, dark: 0x356f2c };
const SUMMER_DEEP: FoliageColors = { base: 0x3f8a3e, light: 0x63ad4a, dark: 0x2b5f2e };

// Ramps hue-shift: shadows lean blue, highlights lean yellow (see the pixel-art skill).
export const SEASON_LOOKS: Record<string, SeasonLook> = {
  spring: {
    grass: {
      shadow: 0x4c7a3c,
      dark: 0x6a9a3e,
      base: 0x8cbf4a,
      light: 0xa8d65a,
      highlight: 0xd4ea7a,
    },
    groundAccents: [0xf4b6c8, 0xfdd3e3],
    accentDensity: 1 / 400,
    flowers: [PALETTE.flowerWhite, 0xf4b6c8, PALETTE.flowerYellow, PALETTE.flowerPurple],
    flowerDensity: 1 / 500,
    foliage: { orange: BLOSSOM, amber: SPRING_GREEN, red: BLOSSOM },
    snow: false,
    ambient: { kind: 'petals', colors: [0xf4b6c8, 0xfdd3e3], count: 12 },
  },
  summer: {
    grass: {
      shadow: 0x3d6a33,
      dark: 0x568a36,
      base: 0x6fa83e,
      light: 0x8cc24c,
      highlight: 0xbedd6c,
    },
    groundAccents: [],
    accentDensity: 0,
    flowers: [PALETTE.flowerYellow, PALETTE.flowerWhite],
    flowerDensity: 1 / 1100,
    foliage: { orange: SUMMER_GREEN, amber: SUMMER_DEEP, red: SUMMER_GREEN },
    snow: false,
    ambient: { kind: 'none', colors: [], count: 0 },
  },
  autumn: {
    grass: {
      shadow: PALETTE.grassShadow,
      dark: PALETTE.grassDark,
      base: PALETTE.grass,
      light: PALETTE.grassLight,
      highlight: PALETTE.grassHighlight,
    },
    groundAccents: [PALETTE.leafOrange, PALETTE.leafRed],
    accentDensity: 1 / 260,
    flowers: [PALETTE.flowerWhite, PALETTE.flowerYellow, PALETTE.flowerPurple],
    flowerDensity: 1 / 1400,
    foliage: { orange: FOLIAGE.orange, amber: FOLIAGE.amber, red: FOLIAGE.red },
    snow: false,
    ambient: { kind: 'leaves', colors: [PALETTE.leafOrange, PALETTE.leafRed, 0xe8a838], count: 14 },
  },
  winter: {
    grass: {
      shadow: 0x9fb2c8,
      dark: 0xc4d2e2,
      base: 0xe2eaf3,
      light: 0xf2f6fb,
      highlight: 0xffffff,
    },
    groundAccents: [PALETTE.grassDark, PALETTE.grassShadow],
    accentDensity: 1 / 320,
    flowers: [],
    flowerDensity: 0,
    foliage: { orange: null, amber: null, red: null },
    snow: true,
    ambient: { kind: 'snow', colors: [0xffffff, 0xe2eaf3], count: 40 },
  },
};

export const SNOW = { light: 0xf4f8fc, shade: 0xc4d2e2, deep: 0x9fb2c8 } as const;

export const lookFor = (seasonId: string): SeasonLook =>
  SEASON_LOOKS[seasonId] ?? (SEASON_LOOKS.autumn as SeasonLook);

/** Texture key for a season variant of some art. */
export const seasonalKey = (baseKey: string, seasonId: string) => `${baseKey}@${seasonId}`;

/** The season variant when one was baked, otherwise the base art. */
export const seasonalTexture = (
  textures: { exists(key: string): boolean },
  baseKey: string,
  seasonId: string,
) => {
  const key = seasonalKey(baseKey, seasonId);
  return textures.exists(key) ? key : baseKey;
};
