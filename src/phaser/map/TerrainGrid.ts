import { blendCorners, CODE, type Corners, type TerrainCode } from './terrain';

/** Grid cells covered by the terrain, inclusive of `min`, exclusive of `max`. */
export interface CellRange {
  minCol: number;
  minRow: number;
  maxCol: number;
  maxRow: number;
}

/** Linear terrains: a diagonal-only link between two cells is widened so they stay joined. */
const JOINED: TerrainCode[] = [CODE.fresh, CODE.path];
const JOIN_PASSES = 2;

// One terrain per grid cell, sampled at the cell centre. Tiles are drawn on the dual grid:
// each tile's corners sit on four cell centres, so a terrain covers exactly its cells.
export class TerrainGrid {
  readonly width: number;
  readonly height: number;
  private readonly codes: Uint8Array;

  constructor(
    readonly range: CellRange,
    classify: (col: number, row: number) => TerrainCode,
    /** For a cell next to a diagonal link, how far it is from that terrain (lower joins). */
    reach: (code: TerrainCode, col: number, row: number) => number = () => 0,
    private readonly outside: TerrainCode = CODE.sea,
  ) {
    this.width = range.maxCol - range.minCol;
    this.height = range.maxRow - range.minRow;
    this.codes = new Uint8Array(this.width * this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.codes[y * this.width + x] = classify(range.minCol + x, range.minRow + y);
      }
    }
    for (let pass = 0; pass < JOIN_PASSES; pass++) this.joinDiagonals(reach);
  }

  at(col: number, row: number): TerrainCode {
    const x = col - this.range.minCol;
    const y = row - this.range.minRow;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return this.outside;
    return this.codes[y * this.width + x] ?? this.outside;
  }

  /** Corners of the dual tile whose top corner is the centre of cell (col, row). */
  corners(col: number, row: number): Corners {
    return [
      this.at(col, row),
      this.at(col + 1, row),
      this.at(col + 1, row + 1),
      this.at(col, row + 1),
    ];
  }

  /** The terrain drawn at a fractional grid point. */
  terrainAt(col: number, row: number): TerrainCode {
    const x = col - 0.5;
    const y = row - 0.5;
    const c = Math.floor(x);
    const r = Math.floor(y);
    return blendCorners(this.corners(c, r), x - c, y - r).top;
  }

  /** Repaints cells of one terrain as another, for details added after the first pass. */
  repaint(col: number, row: number, from: TerrainCode, to: TerrainCode): void {
    if (this.at(col, row) === from) this.set(col, row, to);
  }

  private set(col: number, row: number, code: TerrainCode): void {
    const x = col - this.range.minCol;
    const y = row - this.range.minRow;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.codes[y * this.width + x] = code;
  }

  private joinDiagonals(reach: (code: TerrainCode, col: number, row: number) => number): void {
    for (let row = this.range.minRow; row < this.range.maxRow - 1; row++) {
      for (let col = this.range.minCol; col < this.range.maxCol - 1; col++) {
        const [n, e, s, w] = this.corners(col, row);
        for (const code of JOINED) {
          if (n === code && s === code && e !== code && w !== code) {
            this.join(code, [col + 1, row], [col, row + 1], reach);
          } else if (e === code && w === code && n !== code && s !== code) {
            this.join(code, [col, row], [col + 1, row + 1], reach);
          }
        }
      }
    }
  }

  // Fills whichever of the two open cells is nearer the terrain; protected cells never change.
  private join(
    code: TerrainCode,
    first: [number, number],
    other: [number, number],
    reach: (code: TerrainCode, col: number, row: number) => number,
  ): void {
    const a = reach(code, ...first);
    const b = reach(code, ...other);
    if (!Number.isFinite(Math.min(a, b))) return;
    const [col, row] = a <= b ? first : other;
    this.set(col, row, code);
  }
}
