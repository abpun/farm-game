import type * as Phaser from 'phaser';
import type { CatalogItem } from '@core/entities/types';
import { BED_TEXTURES } from '../art/BedArtist';
import { FENCE_LINK, fenceShape, fenceTextureKey } from '../art/FenceArtist';
import { houseShape, type HouseFootprint } from '../art/HouseArtist';
import { addArt } from '../art/paint';
import { seasonalTexture } from '../art/seasonLooks';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';

// The cottage art is slightly shallower than its 2×2 tile footprint, so it sits inset.
export const COTTAGE_ART: HouseFootprint = { cols: 2, rows: 1.6 };
const COTTAGE_ROW_INSET = 0.2;
const STANDING_ORIGIN = { x: 0.5, y: 0.95 };
const LAYER = { plot: 0, fence: 3, decor: 5, building: 5, animal: 5 } as const;
export const CROP_LAYER = 2;

export const STRAIGHT_FENCE_MASK = FENCE_LINK.north | FENCE_LINK.south;

export function itemDepth(grid: IsoGrid, item: CatalogItem, col: number, row: number): number {
  const center = grid.depthOf(col + item.footprint.cols / 2, row + item.footprint.rows / 2);
  return center + LAYER[item.kind];
}

// World sprite for a placed item, anchored on its footprint and depth-sorted.
export function createItemImage(
  scene: Phaser.Scene,
  grid: IsoGrid,
  item: CatalogItem,
  col: number,
  row: number,
  seasonId: string,
  fenceMask = 0,
): Phaser.GameObjects.Image {
  const art = itemTexture(scene, item, seasonId, fenceMask);
  const top = grid.tileTop(col, row);
  const image = (() => {
    switch (item.kind) {
      case 'plot':
        return addArt(scene, top.x - grid.tileW / 2, top.y, BED_TEXTURES.bed);
      case 'fence': {
        const anchor = fenceShape(grid).tileTop;
        return addArt(scene, top.x - anchor.x * PIXEL_SCALE, top.y - anchor.y * PIXEL_SCALE, art);
      }
      case 'building': {
        const anchor = houseShape(grid, COTTAGE_ART).T;
        const corner = grid.toScreen(col, row + COTTAGE_ROW_INSET);
        const x = corner.x - anchor.x * PIXEL_SCALE;
        return addArt(scene, x, corner.y - anchor.y * PIXEL_SCALE, art);
      }
      default: {
        const center = grid.toScreen(col + item.footprint.cols / 2, row + item.footprint.rows / 2);
        return addArt(scene, center.x, center.y, art, STANDING_ORIGIN.x, STANDING_ORIGIN.y);
      }
    }
  })();
  return image.setDepth(itemDepth(grid, item, col, row));
}

/** The world texture for an item in the given season (fences also need their neighbour mask). */
export function itemTexture(
  scene: Phaser.Scene,
  item: CatalogItem,
  seasonId: string,
  fenceMask = 0,
): string {
  if (item.kind === 'plot') return BED_TEXTURES.bed;
  if (item.kind === 'fence') return fenceTextureKey(fenceMask);
  return seasonalTexture(scene.textures, item.art, seasonId);
}

/** Texture for the item's market icon; falls back to a lock for art that does not exist yet. */
export function itemIconKey(scene: Phaser.Scene, item: CatalogItem): string {
  const uiIcon = `ui-icon-${item.id}`;
  if (scene.textures.exists(uiIcon)) return uiIcon;
  if (item.kind === 'fence') return fenceTextureKey(STRAIGHT_FENCE_MASK);
  return scene.textures.exists(item.art) ? item.art : 'ui-icon-lock';
}
