import type * as Phaser from 'phaser';
import type { CropDef } from '@core/entities/types';
import { diamondPoint, type IsoGrid } from '../iso/IsoGrid';
import { cropSheetSpec, paintCropSheet, type CropSheetSpec } from './crops/cropSheet';

const CROPS_DIR = 'assets/crops';
/** Plants per bed, back to front: two furrows of two (u, v inside the tile diamond). */
const BED_SPOTS = [
  { u: 0.3, v: 0.3, mirror: false },
  { u: 0.72, v: 0.28, mirror: true },
  { u: 0.28, v: 0.72, mirror: true },
  { u: 0.7, v: 0.7, mirror: false },
] as const;

export const cropTextureKey = (cropId: string, stage: number) => `crop-${cropId}-${stage}`;
export const cropIconKey = (cropId: string) => `crop-icon-${cropId}`;
const sheetKey = (cropId: string) => `crop-sheet-${cropId}`;

type Source = CanvasImageSource & { width: number; height: number };

/** Queues every crop's sheet PNG; call from a scene's preload. */
export function loadCropSheets(scene: Phaser.Scene, crops: CropDef[]): void {
  for (const crop of crops) scene.load.image(sheetKey(crop.id), `${CROPS_DIR}/${crop.id}.png`);
}

/**
 * Cuts each crop sheet (see art/crops/cropSheet) into the textures the game uses: a trimmed
 * icon, and per stage either the tree frame as is or a bed with four plants in its furrows.
 */
export function generateCropTextures(scene: Phaser.Scene, crops: CropDef[], grid: IsoGrid): void {
  for (const crop of crops) {
    const spec = cropSheetSpec(crop);
    const source = sheetSource(scene, crop);
    makeIcon(scene, crop, spec, source);
    for (let stage = 0; stage < crop.stages; stage++) {
      const frameX = (stage + 1) * spec.frame.w;
      if (spec.tree) copyFrame(scene, cropTextureKey(crop.id, stage), source, frameX, spec);
      else plantBed(scene, cropTextureKey(crop.id, stage), source, frameX, spec, grid);
    }
  }
}

function makeIcon(scene: Phaser.Scene, crop: CropDef, spec: CropSheetSpec, source: Source): void {
  const { w, h } = spec.frame;
  const scratch = canvas(w, h);
  scratch.ctx.drawImage(source, 0, 0, w, h, 0, 0, w, h);
  const bounds = opaqueBounds(scratch.ctx, w, h);
  const texture = scene.textures.createCanvas(cropIconKey(crop.id), bounds.w, bounds.h);
  if (!texture) throw new Error(`Could not create the ${crop.id} icon`);
  texture
    .getContext()
    .drawImage(scratch.element, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
  texture.refresh();
}

function copyFrame(
  scene: Phaser.Scene,
  key: string,
  source: Source,
  frameX: number,
  spec: CropSheetSpec,
) {
  const { w, h } = spec.frame;
  const texture = scene.textures.createCanvas(key, w, h);
  if (!texture) throw new Error(`Could not create ${key}`);
  texture.getContext().drawImage(source, frameX, 0, w, h, 0, 0, w, h);
  texture.refresh();
}

// The bed texture is tile-wide and tall enough for the tallest plant in the back furrow.
function plantBed(
  scene: Phaser.Scene,
  key: string,
  source: Source,
  frameX: number,
  spec: CropSheetSpec,
  grid: IsoGrid,
): void {
  const { tileW: w, tileH: h } = grid.art;
  const headroom = spec.ground.y;
  const texture = scene.textures.createCanvas(key, w, h + headroom);
  if (!texture) throw new Error(`Could not create ${key}`);
  const ctx = texture.getContext();
  for (const spot of BED_SPOTS) {
    const at = diamondPoint(spot.u, spot.v, w, h);
    const x = Math.round(at.x - spec.ground.x);
    const y = Math.round(at.y + headroom - spec.ground.y);
    ctx.save();
    if (spot.mirror) {
      ctx.translate(x + spec.frame.w, y);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(x, y);
    }
    ctx.drawImage(source, frameX, 0, spec.frame.w, spec.frame.h, 0, 0, spec.frame.w, spec.frame.h);
    ctx.restore();
  }
  texture.refresh();
}

// The authored PNG when it loaded, otherwise the same sheet painted in code.
function sheetSource(scene: Phaser.Scene, crop: CropDef): Source {
  const key = sheetKey(crop.id);
  if (scene.textures.exists(key))
    return scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const painted = paintCropSheet(crop);
  const target = canvas(painted.width, painted.height);
  const image = target.ctx.createImageData(painted.width, painted.height);
  image.data.set(painted.data);
  target.ctx.putImageData(image, 0, 0);
  return target.element;
}

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas for crop art');
  return { element, ctx };
}

function opaqueBounds(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((data[(y * w + x) * 4 + 3] ?? 0) === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
