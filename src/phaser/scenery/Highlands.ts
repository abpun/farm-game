import type * as Phaser from 'phaser';
import { bakeRange, rangeKey, type RangeGeometry, type RangeLayer } from '../art/MountainArtist';
import { bakeSky, skyKey } from '../art/SkyArtist';
import type { IsoGrid } from '../iso/IsoGrid';
import { PIXEL_SCALE } from '../layout';
import type { WorldShape } from '../map/WorldShape';

/** Behind the land, above the sea; the near range sits just above the terrain. */
export const HIGHLAND_DEPTH = { sky: -1700, far: -1690, mid: -1680, clouds: -1675, near: -1460 };

// Distant layers drift slower than the world for a gentle sense of depth.
const PARALLAX: Record<RangeLayer, number> = { far: 0.9, mid: 0.95, near: 1 };
const SKY_PARALLAX = 0.88;
const SKY_MARGIN = 900;

interface Range {
  layer: RangeLayer;
  image: Phaser.GameObjects.Image;
}

// The sky and three mountain ranges framing the north of the valley.
export class Highlands {
  private readonly ranges: Range[] = [];
  private readonly sky: Phaser.GameObjects.TileSprite;
  private readonly skyArtHeight: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: IsoGrid,
    private readonly shape: WorldShape,
    seasonId: string,
  ) {
    const area = shape.data.bounds;
    const top = (area.north * grid.tileH) / 2 - SKY_MARGIN;
    const bottom = (Math.max(...shape.data.mountains.foot.map(([, v]) => v)) * grid.tileH) / 2;
    const left = (area.west * grid.tileW) / 2 - SKY_MARGIN;
    const width = ((area.east - area.west) * grid.tileW) / 2 + SKY_MARGIN * 2;
    this.skyArtHeight = Math.ceil((bottom - top) / PIXEL_SCALE);
    bakeSky(scene, seasonId, this.skyArtHeight);
    this.sky = scene.add
      .tileSprite(left, top, Math.ceil(width / PIXEL_SCALE), this.skyArtHeight, skyKey(seasonId))
      .setOrigin(0)
      .setScale(PIXEL_SCALE)
      .setDepth(HIGHLAND_DEPTH.sky)
      .setScrollFactor(SKY_PARALLAX);
    for (const spec of shape.data.mountains.ranges) {
      const geometry = this.bake(spec.layer, seasonId);
      const image = scene.add
        .image(geometry.x, geometry.top, rangeKey(spec.layer, seasonId))
        .setOrigin(0)
        .setScale(PIXEL_SCALE)
        .setDepth(HIGHLAND_DEPTH[spec.layer])
        .setScrollFactor(PARALLAX[spec.layer]);
      this.place(image, spec.layer, geometry);
      this.ranges.push({ layer: spec.layer, image });
    }
  }

  setSeason(seasonId: string): void {
    bakeSky(this.scene, seasonId, this.skyArtHeight);
    this.sky.setTexture(skyKey(seasonId));
    for (const range of this.ranges) {
      this.bake(range.layer, seasonId);
      range.image.setTexture(rangeKey(range.layer, seasonId));
    }
  }

  private bake(layer: RangeLayer, seasonId: string): RangeGeometry {
    const spec = this.shape.data.mountains.ranges.find((r) => r.layer === layer);
    if (!spec) throw new Error(`No ${layer} range in world.json`);
    return bakeRange(this.scene, this.shape, spec, seasonId, {
      w: this.grid.tileW,
      h: this.grid.tileH,
    });
  }

  // A parallax layer is offset so it lines up with the world when the camera is at the
  // top of the map, where the ranges are seen; lower down it sinks behind the near peaks.
  private place(image: Phaser.GameObjects.Image, layer: RangeLayer, geometry: RangeGeometry): void {
    const factor = PARALLAX[layer];
    if (factor === 1) return;
    const north = (this.shape.data.bounds.north * this.grid.tileH) / 2;
    image.setPosition(geometry.x * factor, geometry.top - (1 - factor) * north);
  }
}
