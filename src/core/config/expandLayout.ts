import type { EdgeSide, LayoutEntry } from '../entities/types';

export interface Placement {
  itemId: string;
  col: number;
  row: number;
  edge?: EdgeSide;
}

// Turns compact layout entries (single tiles, filled areas, outlines with gaps) into tiles.
export function expandLayout(entries: readonly LayoutEntry[]): Placement[] {
  return entries.flatMap((entry): Placement[] => {
    if ('area' in entry) {
      const { col, row, cols, rows } = entry.area;
      return cells(col, row, cols, rows).map(([c, r]) => ({
        itemId: entry.itemId,
        col: c,
        row: r,
      }));
    }
    if ('around' in entry) {
      const gaps = new Set((entry.gaps ?? []).map((gap) => gap.join(',')));
      return edgesAround(entry.around)
        .filter(([c, r, side]) => !gaps.has(`${c},${r},${side}`))
        .map(([c, r, side]) => ({ itemId: entry.itemId, col: c, row: r, edge: side }));
    }
    if ('outline' in entry) {
      const { col, row, cols, rows } = entry.outline;
      const gaps = new Set((entry.gaps ?? []).map(([c, r]) => `${c},${r}`));
      return cells(col, row, cols, rows)
        .filter(([c, r]) => c === col || r === row || c === col + cols - 1 || r === row + rows - 1)
        .filter(([c, r]) => !gaps.has(`${c},${r}`))
        .map(([c, r]) => ({ itemId: entry.itemId, col: c, row: r }));
    }
    return [{ itemId: entry.itemId, col: entry.col, row: entry.row }];
  });
}

function cells(col: number, row: number, cols: number, rows: number): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  for (let r = row; r < row + rows; r++) {
    for (let c = col; c < col + cols; c++) result.push([c, r]);
  }
  return result;
}

// Every tile edge on the border of a rectangle, as [col, row, side] of the cell it belongs to.
function edgesAround({
  col,
  row,
  cols,
  rows,
}: {
  col: number;
  row: number;
  cols: number;
  rows: number;
}): Array<[number, number, EdgeSide]> {
  const edges: Array<[number, number, EdgeSide]> = [];
  for (let c = col; c < col + cols; c++) edges.push([c, row, 'n'], [c, row + rows, 'n']);
  for (let r = row; r < row + rows; r++) edges.push([col, r, 'w'], [col + cols, r, 'w']);
  return edges;
}
