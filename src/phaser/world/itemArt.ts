import type * as Phaser from 'phaser';
import type { CatalogItem } from '@core/entities/types';
import type { Spot } from '@core/systems/WorldSystem';
import { BED_TEXTURES } from '../art/BedArtist';
import { EXTRA_TEXTURES } from '../art/ExtraArtist';
import { edgeKey, edgeShape, isEdgeArt } from '../art/FenceArtist';
import { houseShape, type HouseFootprint } from '../art/HouseArtist';
import { addArt } from '../art/paint';
import { seasonalTexture } from '../art/seasonLooks';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';

// The cottage art is slightly shallower than its 2×2 tile footprint, so it sits inset.
export const COTTAGE_ART: HouseFootprint = { cols: 2, rows: 1.6 };
export const COTTAGE_ROW_INSET = 0.2;
const STANDING_ORIGIN = { x: 0.5, y: 0.95 };
const LAYER = { plot: 0, fence: 3, decor: 5, building: 5 } as const;
export const CROP_LAYER = 2;

const isEdge = (item: CatalogItem) => item.placement === 'edge';

/** Grid point an object is centred on: its footprint middle, or the middle of its edge. */
export function spotCenter(item: CatalogItem, spot: Spot): { col: number; row: number } {
  if (isEdge(item)) {
    return spot.edge === 'w'
      ? { col: spot.col, row: spot.row + 0.5 }
      : { col: spot.col + 0.5, row: spot.row };
  }
  const { cols, rows } = item.footprint;
  return spot.rotated
    ? { col: spot.col + rows / 2, row: spot.row + cols / 2 }
    : { col: spot.col + cols / 2, row: spot.row + rows / 2 };
}

export function itemDepth(grid: IsoGrid, item: CatalogItem, spot: Spot): number {
  const center = spotCenter(item, spot);
  return grid.depthOf(center.col, center.row) + LAYER[item.kind];
}

// World sprite for a placed item, anchored on its footprint or edge and depth-sorted.
export function createItemImage(
  scene: Phaser.Scene,
  grid: IsoGrid,
  item: CatalogItem,
  spot: Spot,
  seasonId: string,
): Phaser.GameObjects.Image {
  const art = itemTexture(scene, item, seasonId, spot);
  const top = grid.tileTop(spot.col, spot.row);
  const image = (() => {
    if (isEdge(item) && isEdgeArt(item.art)) {
      const anchor = edgeShape(grid).anchor[spot.edge ?? 'n'];
      return addArt(scene, top.x - anchor.x * PIXEL_SCALE, top.y - anchor.y * PIXEL_SCALE, art);
    }
    switch (item.kind) {
      case 'plot':
        return addArt(scene, top.x - grid.tileW / 2, top.y, plotTexture(item));
      case 'building': {
        const anchor = houseShape(grid, COTTAGE_ART).T;
        const corner = grid.toScreen(spot.col, spot.row + COTTAGE_ROW_INSET);
        const x = corner.x - anchor.x * PIXEL_SCALE;
        return addArt(scene, x, corner.y - anchor.y * PIXEL_SCALE, art);
      }
      default: {
        const center = spotCenter(item, spot);
        const at = grid.toScreen(center.col, center.row);
        return addArt(scene, at.x, at.y, art, STANDING_ORIGIN.x, STANDING_ORIGIN.y);
      }
    }
  })();
  return image.setFlipX(Boolean(spot.rotated)).setDepth(itemDepth(grid, item, spot));
}

/** The world texture for an item in the given season (edge runs depend on their side). */
export function itemTexture(
  scene: Phaser.Scene,
  item: CatalogItem,
  seasonId: string,
  spot?: Spot,
): string {
  if (item.kind === 'plot') return plotTexture(item);
  if (isEdgeArt(item.art)) {
    return seasonalTexture(scene.textures, edgeKey(item.art, spot?.edge ?? 'n'), seasonId);
  }
  return seasonalTexture(scene.textures, item.art, seasonId);
}

/** Texture for the item's market icon; falls back to a lock for art that does not exist yet. */
export function itemIconKey(scene: Phaser.Scene, item: CatalogItem): string {
  const uiIcon = `ui-icon-${item.id}`;
  if (scene.textures.exists(uiIcon)) return uiIcon;
  if (isEdgeArt(item.art)) return seasonalTexture(scene.textures, edgeKey(item.art, 'n'), 'summer');
  return scene.textures.exists(item.art) ? item.art : 'ui-icon-lock';
}

const plotTexture = (item: CatalogItem) =>
  item.soil === 'orchard' ? EXTRA_TEXTURES.orchardPlot : BED_TEXTURES.bed;
