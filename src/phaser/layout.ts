export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const HUD_HEIGHT = 72;

// World art is drawn at 1/PIXEL_SCALE resolution and upscaled with nearest filtering.
export const PIXEL_SCALE = 3;

export const ISO = {
  tileWidth: 120,
  soilDepthRatio: 0.1,
  islandDepthRatio: 0.22,
  cropHeadroomRatio: 0.5,
} as const;

// Natural island around the build grid; distances are in tiles.
export const ISLAND = { grassMargin: 2.2, sandWidth: 0.8, coastWobble: 0.9, seed: 11 } as const;

export const CAMERA = {
  focusOnScreen: { x: 640, y: 400 },
  boundsPadding: { left: 120, right: 520, top: 160, bottom: 120 },
  dragThreshold: 8,
} as const;

// UI rectangles are multiples of the UI pixel (3) so frames stay crisp.
export const HUD = { margin: 12, height: 54, coinWidth: 222, dayWidth: 186 } as const;
export const DOCK = { margin: 12, top: 84, button: 57, gap: 6, labelHeight: 21 } as const;
export const DRAWER = { width: 405, height: 618, gap: 12, rowHeight: 69 } as const;
export const TOAST_ANCHOR = { x: 640, y: 81 } as const;
