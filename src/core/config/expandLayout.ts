import type { LayoutEntry } from '../entities/types';

export interface Placement {
  itemId: string;
  col: number;
  row: number;
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
