import type { Catalog } from '../config/Catalog';
import { polylineDistance } from '../config/geometry';
import type { FarmState, PathConfig, PlacedObject } from '../entities/types';

const cellKey = (col: number, row: number) => `${col},${row}`;
// Points inside a tile tested against paths; edges are skipped so paths can run beside tiles.
const TILE_SAMPLES = [0.2, 0.5, 0.8];

/** Where an object goes: the cell its top corner sits in, turned or not. */
export interface Spot {
  col: number;
  row: number;
  rotated?: boolean;
}

// Owns placed objects on the build grid: which tiles each one fills.
export class WorldSystem {
  private readonly occupancy = new Map<string, number>();
  private readonly blocked = new Set<string>();

  constructor(
    private readonly state: FarmState,
    private readonly catalog: Catalog,
    readonly size: { columns: number; rows: number },
    paths: readonly PathConfig[] = [],
  ) {
    for (const object of state.objects) this.mark(object, object.id);
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
    if (!this.inBounds(col, row)) return false;
    return this.state.ownedBlocks.some(
      (b) => col >= b.col && col < b.col + b.cols && row >= b.row && row < b.row + b.rows,
    );
  }

  countOf(itemId: string): number {
    return this.state.objects.filter((object) => object.itemId === itemId).length;
  }

  canPlace(itemId: string, spot: Spot): boolean {
    const cells = this.cellsFor(itemId, spot.col, spot.row, spot.rotated);
    return cells.every(
      ([c, r]) => this.isOwned(c, r) && !this.isBlocked(c, r) && !this.occupancy.has(cellKey(c, r)),
    );
  }

  place(itemId: string, spot: Spot): PlacedObject | null {
    if (!this.canPlace(itemId, spot)) return null;
    const object: PlacedObject = { id: this.state.nextObjectId++, itemId, ...cleanSpot(spot) };
    this.state.objects.push(object);
    this.mark(object, object.id);
    return object;
  }

  /** Whether an object would fit at a spot once lifted from where it is now. */
  canMove(id: number, spot: Spot): boolean {
    const object = this.get(id);
    if (!object) return false;
    this.mark(object, null);
    const fits = this.canPlace(object.itemId, { rotated: object.rotated, ...spot });
    this.mark(object, object.id);
    return fits;
  }

  /** Moves (and optionally turns) an object; returns its old spot, or null if it does not fit. */
  move(id: number, spot: Spot): PlacedObject | null {
    const object = this.get(id);
    if (!object) return null;
    const from = { ...object };
    this.mark(object, null);
    const target = { rotated: object.rotated, ...spot };
    if (!this.canPlace(object.itemId, target)) {
      this.mark(object, object.id);
      return null;
    }
    Object.assign(object, cleanSpot(target));
    if (!target.rotated) delete object.rotated;
    this.mark(object, object.id);
    return from;
  }

  remove(id: number): PlacedObject | null {
    const index = this.state.objects.findIndex((object) => object.id === id);
    const [object] = index >= 0 ? this.state.objects.splice(index, 1) : [];
    if (!object) return null;
    this.mark(object, null);
    return object;
  }

  cellsFor(itemId: string, col: number, row: number, rotated = false): Array<[number, number]> {
    const footprint = this.catalog.get(itemId).footprint;
    const cols = rotated ? footprint.rows : footprint.cols;
    const rows = rotated ? footprint.cols : footprint.rows;
    const result: Array<[number, number]> = [];
    for (let r = row; r < row + rows; r++) {
      for (let c = col; c < col + cols; c++) result.push([c, r]);
    }
    return result;
  }

  /** Tiles an object fills right now. */
  cellsOf(object: PlacedObject): Array<[number, number]> {
    return this.cellsFor(object.itemId, object.col, object.row, object.rotated);
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

  private mark(object: PlacedObject, id: number | null): void {
    for (const [c, r] of this.cellsOf(object)) {
      if (id === null) this.occupancy.delete(cellKey(c, r));
      else this.occupancy.set(cellKey(c, r), id);
    }
  }
}

const cleanSpot = ({ col, row, rotated }: Spot) => ({ col, row, ...(rotated ? { rotated } : {}) });
