import { polylineDistance } from '@core/config/geometry';
import type { PathConfig } from '@core/entities/types';
import { createNoise, type Noise } from './noise';

export type Surface = 'grass' | 'sand' | 'water';

export interface IslandShapeOptions {
  columns: number;
  rows: number;
  /** Average grass width around the build grid, in tiles. */
  grassMargin: number;
  /** Average beach width, in tiles. */
  sandWidth: number;
  /** How far the coastline wanders in and out, in tiles. */
  coastWobble: number;
  seed: number;
}

const COAST_FREQUENCY = 0.32;
const SAND_FREQUENCY = 0.7;
const BANK_FREQUENCY = 0.55;
const PATH_WOBBLE_FREQUENCY = 2.2;
const PATH_WOBBLE = 0.07;
const BANK_HEIGHT = { min: 2, max: 6 };

// Island geometry in grid space: the build grid is always grass, the coast is noise-shaped.
export class IslandShape {
  readonly noise: Noise;

  constructor(
    readonly options: IslandShapeOptions,
    private readonly paths: PathConfig[] = [],
  ) {
    this.noise = createNoise(options.seed);
  }

  /** The farthest the land can reach from the build grid, in tiles. */
  get reach(): number {
    const { grassMargin, sandWidth, coastWobble } = this.options;
    return grassMargin + sandWidth + coastWobble + 0.5;
  }

  /** Distance in tiles from the build grid (0 inside it). */
  gridDistance(col: number, row: number): number {
    const dx = Math.max(-col, col - this.options.columns, 0);
    const dy = Math.max(-row, row - this.options.rows, 0);
    return Math.hypot(dx, dy);
  }

  /** Signed distance to the shoreline in tiles: negative on land, positive in the water. */
  shoreDistance(col: number, row: number): number {
    return this.gridDistance(col, row) - this.sandEdge(col, row);
  }

  surface(col: number, row: number): Surface {
    const distance = this.gridDistance(col, row);
    if (distance <= this.grassEdge(col, row)) return 'grass';
    return distance <= this.sandEdge(col, row) ? 'sand' : 'water';
  }

  /** Height in art pixels of the bank where land drops into the sea. */
  bankHeight(col: number, row: number): number {
    const t = this.noise.fbm(col * BANK_FREQUENCY + 40, row * BANK_FREQUENCY + 40, 2);
    return Math.round(BANK_HEIGHT.min + t * (BANK_HEIGHT.max - BANK_HEIGHT.min));
  }

  isPath(col: number, row: number): boolean {
    const wobble =
      (this.noise.value(col * PATH_WOBBLE_FREQUENCY, row * PATH_WOBBLE_FREQUENCY) - 0.5) * 2;
    return this.paths.some(
      (path) => polylineDistance(path.points, col, row) < path.width / 2 + wobble * PATH_WOBBLE,
    );
  }

  private grassEdge(col: number, row: number): number {
    const { grassMargin, coastWobble } = this.options;
    const n = this.noise.fbm(col * COAST_FREQUENCY, row * COAST_FREQUENCY);
    return grassMargin + (n - 0.5) * 2 * coastWobble;
  }

  private sandEdge(col: number, row: number): number {
    const n = this.noise.fbm(col * SAND_FREQUENCY + 100, row * SAND_FREQUENCY + 100, 2);
    return this.grassEdge(col, row) + this.options.sandWidth * (0.6 + n * 0.8);
  }
}
