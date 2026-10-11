import type * as Phaser from 'phaser';
import type { CatalogItem } from '@core/entities/types';
import type { Spot } from '@core/systems/WorldSystem';
import { BED_TEXTURES } from '../art/BedArtist';
import { EXTRA_TEXTURES } from '../art/ExtraArtist';
import { fenceHalfKey, fencePostKey, fenceShape } from '../art/FenceArtist';
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

/** Grid point an object is centred on: its footprint middle. */
export function spotCenter(item: CatalogItem, spot: Spot): { col: number; row: number } {
  const { cols, rows } = item.footprint;
  return spot.rotated
    ? { col: spot.col + rows / 2, row: spot.row + cols / 2 }
    : { col: spot.col + cols / 2, row: spot.row + rows / 2 };
}

export function itemDepth(grid: IsoGrid, item: CatalogItem, spot: Spot): number {
  const center = spotCenter(item, spot);
  return grid.depthOf(center.col, center.row) + LAYER[item.kind];
}

// World sprite for a placed item, anchored on its footprint and depth-sorted.
export function createItemImage(
  scene: Phaser.Scene,
  grid: IsoGrid,
  item: CatalogItem,
  spot: Spot,
  seasonId: string,
): Phaser.GameObjects.Image {
  const art = itemTexture(scene, item, seasonId);
  const top = grid.tileTop(spot.col, spot.row);
  const image = (() => {
    switch (item.kind) {
      case 'plot':
        return addArt(scene, top.x - grid.tileW / 2, top.y, plotTexture(item));
      case 'building': {
        const anchor = houseShape(grid, COTTAGE_ART).T;
        const corner = grid.toScreen(spot.col, spot.row + COTTAGE_ROW_INSET);
        const x = corner.x - anchor.x * PIXEL_SCALE;
        return addArt(scene, x, corner.y - anchor.y * PIXEL_SCALE, art);
      }
      case 'fence': {
        // Centred on the tile, diagonal (an origin fraction so turning it flips cleanly
        // onto the other grid-edge direction).
        const shape = fenceShape(grid);
        const center = grid.tileCenter(spot.col, spot.row);
        return addArt(
          scene,
          center.x,
          center.y,
          art,
          shape.center.x / shape.width,
          shape.center.y / shape.height,
        );
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

/**
 * A fence as it autotiles: a centre post plus the rail halves pointing at neighbouring fences.
 * `hasFenceNeighbor` reports whether the given cell holds a fence (existing ones for the live
 * farm, or for the build ghost so the placeholder previews how it will connect).
 */
export function createFenceView(
  scene: Phaser.Scene,
  grid: IsoGrid,
  item: CatalogItem,
  spot: Spot,
  seasonId: string,
  hasFenceNeighbor: (col: number, row: number) => boolean,
): Phaser.GameObjects.Container {
  const shape = fenceShape(grid);
  const center = grid.tileCenter(spot.col, spot.row);
  const ox = shape.center.x / shape.width;
  const oy = shape.center.y / shape.height;
  const container = scene.add.container(center.x, center.y);
  const piece = (key: string, flip: boolean): void => {
    container.add(
      scene.add
        .image(0, 0, seasonalTexture(scene.textures, key, seasonId))
        .setOrigin(ox, oy)
        .setFlipX(flip),
    );
  };
  // Rails first (behind), then the post caps the centre. Flipping a half on X swaps it from
  // the col axis to the row axis. A fence with no fence neighbours is just a post.
  if (hasFenceNeighbor(spot.col - 1, spot.row)) piece(fenceHalfKey(item.art, 'neg'), false);
  if (hasFenceNeighbor(spot.col + 1, spot.row)) piece(fenceHalfKey(item.art, 'pos'), false);
  if (hasFenceNeighbor(spot.col, spot.row + 1)) piece(fenceHalfKey(item.art, 'pos'), true);
  if (hasFenceNeighbor(spot.col, spot.row - 1)) piece(fenceHalfKey(item.art, 'neg'), true);
  piece(fencePostKey(item.art), false);
  return container.setDepth(itemDepth(grid, item, spot));
}

/** The world texture for an item in the given season. */
export function itemTexture(scene: Phaser.Scene, item: CatalogItem, seasonId: string): string {
  if (item.kind === 'plot') return plotTexture(item);
  return seasonalTexture(scene.textures, item.art, seasonId);
}

/** Texture for the item's market icon; falls back to a lock for art that does not exist yet. */
export function itemIconKey(scene: Phaser.Scene, item: CatalogItem): string {
  const uiIcon = `ui-icon-${item.id}`;
  if (scene.textures.exists(uiIcon)) return uiIcon;
  return scene.textures.exists(item.art) ? item.art : 'ui-icon-lock';
}

const plotTexture = (item: CatalogItem) =>
  item.soil === 'orchard' ? EXTRA_TEXTURES.orchardPlot : BED_TEXTURES.bed;
