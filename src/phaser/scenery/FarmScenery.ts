import type * as Phaser from 'phaser';
import type { PathConfig } from '@core/entities/types';
import {
  ensureIslandTexture,
  placeIsland,
  placeSea,
  placeSeaGlints,
  type Bounds,
} from '../art/IslandArtist';
import { addArt, seededRandom } from '../art/paint';
import { PROP_TEXTURES } from '../art/PropArtist';
import { lookFor, seasonalTexture } from '../art/seasonLooks';
import { IslandShape } from '../art/terrain/IslandShape';
import type { IsoGrid, Point } from '../iso/IsoGrid';
import { ISLAND } from '../layout';
import { reducedMotion } from '../fx/prefs';
import { AmbientWeather } from './AmbientWeather';
import { TreeSway } from './TreeSway';

const WILD = {
  attempts: 500,
  count: 16,
  spacing: 1.4,
  /** Keep wild props off the build grid and away from the beach. */
  gridClearance: 0.8,
  shoreClearance: 0.6,
  kinds: [
    [PROP_TEXTURES.treeOrange, 3],
    [PROP_TEXTURES.treeAmber, 3],
    [PROP_TEXTURES.treeRed, 2],
    [PROP_TEXTURES.bush, 3],
    [PROP_TEXTURES.rock, 2],
  ] as Array<[string, number]>,
};
const PROP_ORIGIN = { x: 0.5, y: 0.95 };
const TREE_TEXTURES: ReadonlySet<string> = new Set([
  PROP_TEXTURES.treeOrange,
  PROP_TEXTURES.treeAmber,
  PROP_TEXTURES.treeRed,
]);
const PROP_LAYER = 5;
const OPEN_WATER = 0.8;
const STARTER_FOCUS = { col: 4.2, row: 4.2 };

export const createIslandShape = (grid: IsoGrid, paths: PathConfig[]): IslandShape =>
  new IslandShape({ columns: grid.columns, rows: grid.rows, ...ISLAND }, paths);

export const islandExtent = (grid: IsoGrid, shape: IslandShape): Bounds => grid.extent(shape.reach);

// Point the camera centres on at start: the starter field and cottage.
export const sceneryFocus = (grid: IsoGrid): Point =>
  grid.toScreen(STARTER_FOCUS.col, STARTER_FOCUS.row);

interface WildProp {
  image: Phaser.GameObjects.Image;
  baseKey: string;
}

// Everything around the farm that the player does not build: sea, island, wild props, weather.
export class FarmScenery {
  private readonly island: Phaser.GameObjects.Image;
  private readonly props: WildProp[];
  private readonly weather: AmbientWeather;
  private readonly sway: TreeSway;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: IsoGrid,
    private readonly shape: IslandShape,
    seaArea: Bounds,
    seasonId: string,
  ) {
    placeSea(scene, seaArea);
    this.island = placeIsland(scene, grid, shape, seasonId);
    placeSeaGlints(scene, seaArea, (x, y) => {
      const at = grid.toGrid(x, y);
      return shape.shoreDistance(at.col, at.row) > OPEN_WATER;
    });
    this.props = scatterWildProps(scene, grid, shape);
    const extent = islandExtent(grid, shape);
    const sky = grid.tileH * 2;
    this.weather = new AmbientWeather(scene, {
      ...extent,
      y: extent.y - sky,
      height: extent.height + sky,
    });
    this.sway = new TreeSway(
      scene,
      this.props.filter((prop) => TREE_TEXTURES.has(prop.baseKey)).map((prop) => prop.image),
    );
    this.setSeason(seasonId);
  }

  setSeason(seasonId: string): void {
    this.island.setTexture(ensureIslandTexture(this.scene, this.grid, this.shape, seasonId));
    for (const prop of this.props) {
      prop.image.setTexture(seasonalTexture(this.scene.textures, prop.baseKey, seasonId));
    }
    this.weather.setSeason(lookFor(seasonId));
  }

  update(deltaSec: number): void {
    this.weather.setHidden(reducedMotion(this.scene));
    this.weather.update(deltaSec);
    this.sway.update(deltaSec);
  }
}

// Seeded scatter of trees, bushes and rocks on wild grass, spaced so they read as groves.
function scatterWildProps(scene: Phaser.Scene, grid: IsoGrid, shape: IslandShape): WildProp[] {
  const random = seededRandom(ISLAND.seed * 31);
  const reach = shape.reach;
  const placed: WildProp[] = [];
  const spots: Array<[number, number]> = [];
  const totalWeight = WILD.kinds.reduce((sum, [, weight]) => sum + weight, 0);
  const pickKind = () => {
    let roll = random() * totalWeight;
    for (const [texture, weight] of WILD.kinds) {
      roll -= weight;
      if (roll <= 0) return texture;
    }
    return PROP_TEXTURES.bush;
  };

  for (let i = 0; i < WILD.attempts && placed.length < WILD.count; i++) {
    const col = -reach + random() * (grid.columns + reach * 2);
    const row = -reach + random() * (grid.rows + reach * 2);
    if (shape.surface(col, row) !== 'grass' || shape.isPath(col, row)) continue;
    if (shape.gridDistance(col, row) < WILD.gridClearance) continue;
    if (shape.shoreDistance(col, row) > -WILD.shoreClearance) continue;
    if (spots.some(([c, r]) => Math.hypot(c - col, r - row) < WILD.spacing)) continue;
    spots.push([col, row]);
    const baseKey = pickKind();
    const { x, y } = grid.toScreen(col, row);
    const image = addArt(scene, x, y, baseKey, PROP_ORIGIN.x, PROP_ORIGIN.y).setDepth(
      grid.depthOf(col, row) + PROP_LAYER,
    );
    placed.push({ image, baseKey });
  }
  return placed;
}
