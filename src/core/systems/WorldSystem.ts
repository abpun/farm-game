import type { Catalog } from '../config/Catalog';
import { polylineDistance } from '../config/geometry';
import type { FarmState, PathConfig, PlacedObject } from '../entities/types';

const cellKey = (col: number, row: number) => `${col},${row}`;
// Points inside a tile tested against paths; edges are skipped so paths can run beside tiles.
const TILE_SAMPLES = [0.2, 0.5, 0.8];

// Owns placed objects on the build grid and which tiles each one occupies.
export class WorldSystem {
  private readonly occupancy = new Map<string, number>();
  private readonly blocked = new Set<string>();

  constructor(
    private readonly state: FarmState,
    private readonly catalog: Catalog,
    readonly size: { columns: number; rows: number },
    paths: readonly PathConfig[] = [],
  ) {
    for (const object of state.objects) this.markCells(object, object.id);
    this.blockPaths(paths);
  }

  /** True for tiles reserved for walkways. */
  isBlocked(col: number, row: number): boolean {
    return this.blocked.has(cellKey(col, row));
  }

  objects(): readonly PlacedObject[] {
    return this.state.objects;
  }

  get(id: number): PlacedObject | undefined {
    return this.state.objects.find((object) => object.id === id);
  }

  objectAt(col: number, row: number): PlacedObject | undefined {
    const id = this.occupancy.get(cellKey(col, row));
    return id === undefined ? undefined : this.get(id);
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.size.columns && row < this.size.rows;
  }

  /** True for tiles inside the land the player has bought. */
  isOwned(col: number, row: number): boolean {
    return this.inBounds(col, row) && col < this.state.landSize && row < this.state.landSize;
  }

  countOf(itemId: string): number {
    return this.state.objects.filter((object) => object.itemId === itemId).length;
  }

  canPlace(itemId: string, col: number, row: number): boolean {
    return this.cellsFor(itemId, col, row).every(
      ([c, r]) => this.isOwned(c, r) && !this.isBlocked(c, r) && !this.occupancy.has(cellKey(c, r)),
    );
  }

  place(itemId: string, col: number, row: number): PlacedObject | null {
    if (!this.canPlace(itemId, col, row)) return null;
    const object = { id: this.state.nextObjectId++, itemId, col, row };
    this.state.objects.push(object);
    this.markCells(object, object.id);
    return object;
  }

  remove(id: number): PlacedObject | null {
    const index = this.state.objects.findIndex((object) => object.id === id);
    const [object] = index >= 0 ? this.state.objects.splice(index, 1) : [];
    if (!object) return null;
    this.markCells(object, null);
    return object;
  }

  cellsFor(itemId: string, col: number, row: number): Array<[number, number]> {
    const { cols, rows } = this.catalog.get(itemId).footprint;
    const result: Array<[number, number]> = [];
    for (let r = row; r < row + rows; r++) {
      for (let c = col; c < col + cols; c++) result.push([c, r]);
    }
    return result;
  }

  private blockPaths(paths: readonly PathConfig[]): void {
    for (let row = 0; row < this.size.rows; row++) {
      for (let col = 0; col < this.size.columns; col++) {
        const crossed = paths.some((path) =>
          TILE_SAMPLES.some((dy) =>
            TILE_SAMPLES.some(
              (dx) => polylineDistance(path.points, col + dx, row + dy) < path.width / 2,
            ),
          ),
        );
        if (crossed) this.blocked.add(cellKey(col, row));
      }
    }
  }

  private markCells(object: PlacedObject, id: number | null): void {
    for (const [c, r] of this.cellsFor(object.itemId, object.col, object.row)) {
      if (id === null) this.occupancy.delete(cellKey(c, r));
      else this.occupancy.set(cellKey(c, r), id);
    }
  }
}
