import type * as Phaser from 'phaser';
import { SEASON_LOOKS } from './seasonLooks';
import { cellOrigin, paintSheet, SHEET, SHEET_FRAMES, sheetRow } from './terrain/tileSheet';

const TILES_DIR = 'assets/tiles';

/** Loader key of a season's tileset PNG as authored. */
export const sheetFileKey = (seasonId: string) => `terrain-sheet@${seasonId}`;
/** Texture the tilemap uses for one animation frame of a season. */
export const sheetFrameKey = (seasonId: string, frame: number) =>
  `terrain-tiles@${seasonId}#${frame}`;

/** Queues every season's tileset PNG; call from a scene's preload. */
export function loadTerrainSheets(scene: Phaser.Scene): void {
  for (const seasonId of Object.keys(SEASON_LOOKS)) {
    scene.load.image(sheetFileKey(seasonId), `${TILES_DIR}/terrain-${seasonId}.png`);
  }
}

/**
 * Texture for one frame: the authored sheet with the animated rows' later frame copied over
 * their first-frame cells, so the tilemap only ever indexes first-frame rows.
 * A missing PNG falls back to painting the sheet in code.
 */
export function ensureSheetFrame(scene: Phaser.Scene, seasonId: string, frame: number): string {
  const key = sheetFrameKey(seasonId, frame);
  if (scene.textures.exists(key)) return key;
  const source = sheetSource(scene, seasonId);
  const texture = scene.textures.createCanvas(key, source.width, source.height);
  if (!texture) throw new Error(`Could not create ${key}`);
  const ctx = texture.getContext();
  ctx.drawImage(source, 0, 0);
  if (frame > 0) {
    const rowHeight = SHEET.tile.h + SHEET.gutter;
    for (const code of SHEET.animated) {
      const from = cellOrigin(sheetRow(code, frame), 0).y - SHEET.gutter;
      const to = cellOrigin(sheetRow(code), 0).y - SHEET.gutter;
      ctx.clearRect(0, to, source.width, rowHeight);
      ctx.drawImage(source, 0, from, source.width, rowHeight, 0, to, source.width, rowHeight);
    }
  }
  texture.refresh();
  return key;
}

export { SHEET_FRAMES };

function sheetSource(
  scene: Phaser.Scene,
  seasonId: string,
): CanvasImageSource & { width: number; height: number } {
  const fileKey = sheetFileKey(seasonId);
  if (scene.textures.exists(fileKey)) {
    return scene.textures.get(fileKey).getSourceImage() as HTMLImageElement;
  }
  const painted = paintSheet(seasonId);
  const canvas = document.createElement('canvas');
  canvas.width = painted.width;
  canvas.height = painted.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas for the terrain sheet');
  const image = ctx.createImageData(painted.width, painted.height);
  image.data.set(painted.data);
  ctx.putImageData(image, 0, 0);
  return canvas;
}
