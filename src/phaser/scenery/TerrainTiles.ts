import * as Phaser from 'phaser';
import { ensureSheetFrame, SHEET_FRAMES } from '../art/TerrainSheet';
import { SHEET, sheetIndex } from '../art/terrain/tileSheet';
import { reducedMotion } from '../fx/prefs';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';
import { FULL_MASK, layersFor, TERRAINS } from '../map/terrain';
import type { WorldShape } from '../map/WorldShape';

export const TERRAIN_DEPTH = { land: -1500, glints: -1450 } as const;

const FRAME_MS = 900;
const TILESET_NAME = 'terrain';
const EMPTY = -1;
/** Extra tiles drawn past each screen edge. */
const CULL_MARGIN = 1;
/** Layers stack in terrain order at the same depth; this keeps them apart. */
const LAYER_DEPTH_STEP = 0.01;

// The ground as an isometric tilemap built from the tileset PNGs (see art/terrain/tileSheet):
// one layer per terrain, stacked in order, each tile picked by which of its corners (on the
// centres of four grid cells) are that terrain or anything above it.
export class TerrainTiles {
  private readonly layers: Phaser.Tilemaps.TilemapLayer[] = [];
  private readonly tileset: Phaser.Tilemaps.Tileset;
  private readonly visible: Phaser.Tilemaps.Tile[] = [];
  private seasonId: string;
  private frame = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: IsoGrid,
    private readonly shape: WorldShape,
    seasonId: string,
  ) {
    this.seasonId = seasonId;
    const { range, width, height } = shape.terrain;
    const { tileW, tileH } = grid.art;
    const map = new Phaser.Tilemaps.Tilemap(
      scene,
      new Phaser.Tilemaps.MapData({
        tileWidth: tileW,
        tileHeight: tileH,
        width: width - 1,
        height: height - 1,
        orientation: Phaser.Tilemaps.Orientation.ISOMETRIC,
      }),
    );
    const key = ensureSheetFrame(scene, seasonId, 0);
    const tileset = map.addTilesetImage(
      TILESET_NAME,
      key,
      tileW,
      tileH,
      SHEET.gutter,
      SHEET.gutter,
    );
    if (!tileset) throw new Error('Terrain tileset failed to load');
    this.tileset = tileset;
    // Tile (0, 0)'s top corner is the centre of the first cell.
    const top = grid.toScreen(range.minCol + 0.5, range.minRow + 0.5);
    const data = this.indexTiles(width - 1, height - 1);
    TERRAINS.forEach((name, code) => {
      const layer = map.createBlankLayer(name, tileset, top.x - grid.tileW / 2, top.y);
      if (!layer) throw new Error(`Terrain layer ${name} failed to create`);
      layer.setScale(PIXEL_SCALE).setDepth(TERRAIN_DEPTH.land + code * LAYER_DEPTH_STEP);
      layer.putTilesAt(data[code] ?? [], 0, 0, false);
      layer.cullCallback = (_layer: unknown, camera: Phaser.Cameras.Scene2D.Camera) =>
        this.cull(layer, camera);
      this.layers.push(layer);
    });
    scene.time.addEvent({ delay: FRAME_MS, loop: true, callback: () => this.animate() });
  }

  setSeason(seasonId: string): void {
    this.seasonId = seasonId;
    this.show();
  }

  private animate(): void {
    if (reducedMotion(this.scene)) return;
    this.frame = (this.frame + 1) % SHEET_FRAMES;
    this.show();
  }

  private show(): void {
    const key = ensureSheetFrame(this.scene, this.seasonId, this.frame);
    this.tileset.setImage(this.scene.textures.get(key));
  }

  // Per terrain, a grid of tileset indices (EMPTY where that layer has nothing to draw).
  private indexTiles(width: number, height: number): number[][][] {
    const { terrain, noise } = this.shape;
    const layers = TERRAINS.map(() =>
      Array.from({ length: height }, () => new Array<number>(width).fill(EMPTY)),
    );
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const col = terrain.range.minCol + x;
        const row = terrain.range.minRow + y;
        for (const { code, mask } of layersFor(terrain.corners(col, row))) {
          const variant =
            mask === FULL_MASK ? Math.floor(noise.hash(col, row) * SHEET.variants) : 0;
          const cells = layers[code]?.[y];
          if (cells) cells[x] = sheetIndex(code, mask, variant);
        }
      }
    }
    return layers;
  }

  // Only the tiles under the camera, found from its corners instead of testing every tile.
  private cull(
    layer: Phaser.Tilemaps.TilemapLayer,
    camera: Phaser.Cameras.Scene2D.Camera,
  ): Phaser.Tilemaps.Tile[] {
    this.visible.length = 0;
    const view = camera.worldView;
    const halfW = this.grid.tileW / 2;
    const halfH = this.grid.tileH / 2;
    const toTile = (x: number, y: number) => ({
      d: (x - layer.x - halfW) / halfW,
      s: (y - layer.y) / halfH,
    });
    const from = toTile(view.x, view.y);
    const to = toTile(view.right, view.bottom);
    const sMin = Math.floor(from.s) - 1 - CULL_MARGIN;
    const sMax = Math.ceil(to.s) + CULL_MARGIN;
    const dMin = Math.floor(from.d) - 1 - CULL_MARGIN;
    const dMax = Math.ceil(to.d) + 1 + CULL_MARGIN;
    const data = layer.layer.data;
    for (let s = sMin; s <= sMax; s++) {
      for (let d = dMin; d <= dMax; d++) {
        if ((s + d) % 2 !== 0) continue;
        const tile = data[(s - d) / 2]?.[(s + d) / 2];
        if (tile && tile.index >= 0) this.visible.push(tile);
      }
    }
    return this.visible;
  }
}
