import type { CropDef } from '@core/entities/types';
import { PixelBuffer } from '../PixelBuffer';
import { BED_PAINTERS, GROUND, PLANT_FRAME, sprout, type PlantLook } from './bedPlants';
import { TREE_FRAME, TREE_GROUND, TREE_PAINTERS, type FruitShape } from './orchardPlants';
import { ramp, Pixels } from './pixelKit';
import { PRODUCE_PAINTERS } from './producePainters';

/**
 * Layout of a crop sheet PNG (`public/assets/crops/<cropId>.png`): one row of equal frames.
 * Frame 0 is the harvested produce (its icon; trimmed to its pixels), frames 1..stages are
 * the growth stages of one plant, rooted at the frame's ground point. Bed crops use 20×32
 * frames (four plants are placed per bed); orchard crops use 40×60 frames (one tree).
 */
export interface CropSheetSpec {
  frame: { w: number; h: number };
  ground: { x: number; y: number };
  frames: number;
  tree: boolean;
}

const SHADOW_RADIUS = { bed: [2, 4], tree: [3, 10] } as const;

export function cropSheetSpec(crop: CropDef): CropSheetSpec {
  const tree = crop.visual.kind in TREE_PAINTERS;
  return {
    frame: tree ? TREE_FRAME : PLANT_FRAME,
    ground: tree ? TREE_GROUND : GROUND,
    frames: crop.stages + 1,
    tree,
  };
}

const hexColor = (value: string) => Number.parseInt(value.replace('#', ''), 16);

/** Paints a crop's whole sheet (icon + every stage). */
export function paintCropSheet(crop: CropDef): PixelBuffer {
  const spec = cropSheetSpec(crop);
  const { w, h } = spec.frame;
  const look: PlantLook = {
    leaf: ramp(hexColor(crop.visual.leaf)),
    produce: ramp(hexColor(crop.visual.produce)),
  };
  const shape: FruitShape = crop.visual.shape ?? 'round';
  const sheet = new PixelBuffer(w * spec.frames, h);
  const icon = new Pixels(w, h);
  const produce = PRODUCE_PAINTERS[crop.visual.kind];
  if (!produce) throw new Error(`${crop.id}: no produce painter for "${crop.visual.kind}"`);
  produce(icon, look, shape);
  icon.outline();
  blit(sheet, icon.buffer, 0);
  for (let stage = 0; stage < crop.stages; stage++) {
    const t = stage / (crop.stages - 1);
    const plant = new Pixels(w, h);
    if (spec.tree) {
      const painter = TREE_PAINTERS[crop.visual.kind];
      painter?.(plant, t, look, shape);
    } else if (t === 0) {
      sprout(plant, look);
    } else {
      const painter = BED_PAINTERS[crop.visual.kind];
      if (!painter) throw new Error(`${crop.id}: no plant painter for "${crop.visual.kind}"`);
      painter(plant, t, look);
    }
    plant.outline();
    const [min, max] = spec.tree ? SHADOW_RADIUS.tree : SHADOW_RADIUS.bed;
    plant.shadow(spec.ground.x, spec.ground.y + 1, min + (max - min) * t);
    blit(sheet, plant.buffer, (stage + 1) * w);
  }
  return sheet;
}

function blit(target: PixelBuffer, source: PixelBuffer, ox: number): void {
  for (let y = 0; y < source.height; y++) {
    const from = y * source.width * 4;
    const to = (y * target.width + ox) * 4;
    target.data.set(source.data.subarray(from, from + source.width * 4), to);
  }
}
