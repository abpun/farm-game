import type * as Phaser from 'phaser';
import { addArt } from '../art/paint';
import { PROP_TEXTURES } from '../art/PropArtist';
import { lookFor, seasonalTexture } from '../art/seasonLooks';
import {
  ensureTerrainTexture,
  placeSea,
  placeTerrain,
  terrainRaster,
  type Bounds,
  type TerrainRaster,
} from '../art/TerrainArtist';
import type { IsoGrid } from '../iso/IsoGrid';
import { plantForests } from '../map/vegetation';
import { mapBounds, WORLD } from '../map/WorldMap';
import { WorldShape } from '../map/WorldShape';
import type { PathConfig } from '@core/entities/types';
import { AmbientWeather } from './AmbientWeather';
import { Highlands } from './Highlands';
import { placeGlints } from './SeaGlints';
import { SkyLife } from './SkyLife';
import { WaterMotion } from './WaterMotion';
import { TreeSway } from './TreeSway';

const SEA_GLINTS = 60;
const RIVER_GLINTS = 24;
const RIVER_GLINT_DEPTH = -1450;
const PROP_ORIGIN = { x: 0.5, y: 0.95 };
const PROP_LAYER = 5;
const SEA_MARGIN = 10;
const STARTER_FOCUS = { col: 4.2, row: 4.2 };

const KIND_TEXTURES: Record<string, string[]> = {
  maple: [PROP_TEXTURES.treeOrange, PROP_TEXTURES.treeAmber, PROP_TEXTURES.treeRed],
  pine: [PROP_TEXTURES.pine],
  pineTall: [PROP_TEXTURES.pineTall],
  bush: [PROP_TEXTURES.bush],
  rock: [PROP_TEXTURES.rock],
};
const SWAYING = new Set(['maple', 'pine', 'pineTall']);

interface Prop {
  image: Phaser.GameObjects.Image;
  baseKey: string;
}

export const createWorldShape = (grid: IsoGrid, farmPaths: PathConfig[]) =>
  new WorldShape(WORLD, grid.columns, grid.rows, farmPaths);

/** Where the camera centres at start: the starter field and cottage. */
export const farmFocus = (grid: IsoGrid) => grid.toScreen(STARTER_FOCUS.col, STARTER_FOCUS.row);

/** The camera may roam the whole authored map. */
export const worldArea = (grid: IsoGrid): Bounds => mapBounds(grid.tileW, grid.tileH);

// Everything the player does not build: sea, land, river, forests and weather.
export class WorldScenery {
  private readonly land: Phaser.GameObjects.Image;
  private readonly props: Prop[] = [];
  private readonly weather: AmbientWeather;
  private readonly sway: TreeSway;
  private readonly raster: TerrainRaster;
  private readonly highlands: Highlands;
  private readonly skyLife: SkyLife;
  private readonly water: WaterMotion;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: IsoGrid,
    readonly shape: WorldShape,
    seasonId: string,
  ) {
    const area = worldArea(grid);
    this.raster = terrainRaster(grid, area);
    const seaTop =
      (Math.min(...WORLD.coast.points.map(([, v]) => v)) - SEA_MARGIN) * (grid.tileH / 2);
    const sea = { ...area, y: seaTop, height: area.y + area.height - seaTop };
    placeSea(scene, sea);
    this.land = placeTerrain(scene, shape, this.raster, seasonId);
    this.highlands = new Highlands(scene, grid, shape, seasonId);
    const onWater = (surface: string) => (x: number, y: number) => {
      const at = grid.toGrid(x, y);
      return shape.surface(at.col, at.row) === surface;
    };
    placeGlints(scene, sea, SEA_GLINTS, onWater('water'));
    placeGlints(scene, area, RIVER_GLINTS, onWater('fresh'), RIVER_GLINT_DEPTH);
    this.plant();
    this.skyLife = new SkyLife(scene, grid);
    this.water = new WaterMotion(scene, grid);
    this.weather = new AmbientWeather(scene, () => scene.cameras.main.worldView);
    this.sway = new TreeSway(
      scene,
      this.props.filter((p) => SWAYING.has(p.image.name)).map((p) => p.image),
    );
    this.setSeason(seasonId);
  }

  setSeason(seasonId: string): void {
    this.land.setTexture(ensureTerrainTexture(this.scene, this.shape, this.raster, seasonId));
    for (const prop of this.props) {
      prop.image.setTexture(seasonalTexture(this.scene.textures, prop.baseKey, seasonId));
    }
    this.weather.setSeason(lookFor(seasonId));
    this.highlands.setSeason(seasonId);
  }

  update(deltaSec: number, reducedMotion: boolean, effects: boolean): void {
    this.weather.setHidden(reducedMotion);
    this.weather.update(deltaSec);
    this.sway.update(deltaSec);
    this.skyLife.update(deltaSec, reducedMotion, effects);
    this.water.update(deltaSec, reducedMotion, effects);
  }

  private plant(): void {
    for (const planting of plantForests(this.shape)) {
      const options = KIND_TEXTURES[planting.kind] ?? KIND_TEXTURES.bush ?? [];
      const variant = Math.floor(
        this.shape.noise.hash(planting.col * 7, planting.row * 13) * options.length,
      );
      const baseKey = options[variant] ?? PROP_TEXTURES.bush;
      const { x, y } = this.grid.toScreen(planting.col, planting.row);
      const image = addArt(this.scene, x, y, baseKey, PROP_ORIGIN.x, PROP_ORIGIN.y)
        .setDepth(this.grid.depthOf(planting.col, planting.row) + PROP_LAYER)
        .setName(planting.kind);
      this.props.push({ image, baseKey });
    }
  }
}
