import * as Phaser from 'phaser';
import { bakeTileset, TILE_GUTTER, TILESET_FRAMES, type TileSpec } from '../art/TilesetArtist';
import { reducedMotion } from '../fx/prefs';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';
import { isUniform, signature } from '../map/terrain';
import type { WorldShape } from '../map/WorldShape';

export const TERRAIN_DEPTH = { land: -1500, glints: -1450 } as const;

/** Plain tiles come in this many looks so meadows and sea do not read as a grid. */
const VARIANTS = 4;
const FRAME_MS = 900;
const TILESET_NAME = 'terrain';
/** Extra tiles drawn past each screen edge. */
const CULL_MARGIN = 1;

// The ground as one isometric tilemap. Tiles sit on the dual grid (corners on cell centres),
// so every corner combination the map needs is baked once per season into a small tileset.
export class TerrainTiles {
  private readonly specs: TileSpec[] = [];
  private readonly layer: Phaser.Tilemaps.TilemapLayer;
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
    const indices = this.indexTiles(width - 1, height - 1);
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
    const key = this.bake(seasonId, 0);
    const tileset = map.addTilesetImage(TILESET_NAME, key, tileW, tileH, TILE_GUTTER, TILE_GUTTER);
    if (!tileset) throw new Error('Terrain tileset failed to load');
    this.tileset = tileset;
    // Tile (0, 0)'s top corner is the centre of the first cell.
    const top = grid.toScreen(range.minCol + 0.5, range.minRow + 0.5);
    const layer = map.createBlankLayer('ground', tileset, top.x - grid.tileW / 2, top.y);
    if (!layer) throw new Error('Terrain layer failed to create');
    this.layer = layer.setScale(PIXEL_SCALE).setDepth(TERRAIN_DEPTH.land);
    layer.putTilesAt(indices, 0, 0, false);
    layer.cullCallback = (_layer: unknown, camera: Phaser.Cameras.Scene2D.Camera) =>
      this.cull(camera);
    scene.time.addEvent({ delay: FRAME_MS, loop: true, callback: () => this.animate() });
  }

  setSeason(seasonId: string): void {
    this.seasonId = seasonId;
    this.show();
  }

  /** How many distinct tiles the map uses (for tests and tuning). */
  get tileCount(): number {
    return this.specs.length;
  }

  private animate(): void {
    if (reducedMotion(this.scene)) return;
    this.frame = (this.frame + 1) % TILESET_FRAMES;
    this.show();
  }

  private show(): void {
    this.tileset.setImage(this.scene.textures.get(this.bake(this.seasonId, this.frame)));
  }

  private bake(seasonId: string, frame: number): string {
    const { tileW, tileH } = this.grid.art;
    return bakeTileset(this.scene, this.specs, { w: tileW, h: tileH }, seasonId, frame);
  }

  private indexTiles(width: number, height: number): number[][] {
    const { terrain, noise } = this.shape;
    const lookup = new Map<string, number>();
    const rows: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        const col = terrain.range.minCol + x;
        const r = terrain.range.minRow + y;
        const corners = terrain.corners(col, r);
        const variant = isUniform(corners) ? Math.floor(noise.hash(col, r) * VARIANTS) : 0;
        const id = signature(corners, variant);
        let index = lookup.get(id);
        if (index === undefined) {
          index = this.specs.length;
          lookup.set(id, index);
          this.specs.push({ corners, variant });
        }
        row.push(index);
      }
      rows.push(row);
    }
    return rows;
  }

  // Only the tiles under the camera, found from its corners instead of testing every tile.
  private cull(camera: Phaser.Cameras.Scene2D.Camera): Phaser.Tilemaps.Tile[] {
    this.visible.length = 0;
    const view = camera.worldView;
    const halfW = this.grid.tileW / 2;
    const halfH = this.grid.tileH / 2;
    const toTile = (x: number, y: number) => ({
      d: (x - this.layer.x - halfW) / halfW,
      s: (y - this.layer.y) / halfH,
    });
    const from = toTile(view.x, view.y);
    const to = toTile(view.right, view.bottom);
    const sMin = Math.floor(from.s) - 1 - CULL_MARGIN;
    const sMax = Math.ceil(to.s) + CULL_MARGIN;
    const dMin = Math.floor(from.d) - 1 - CULL_MARGIN;
    const dMax = Math.ceil(to.d) + 1 + CULL_MARGIN;
    const data = this.layer.layer.data;
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
