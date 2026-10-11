import type { BlockExpansion, GridRect, LandConfig, RingBand } from '../entities/types';

// Turns the start rect plus four ring bands into fixed stone-bordered plots that tile the
// frame between the start rect and the world edge: top/bottom bands span the full width
// (including corners), left/right bands fill the strip between them. Every plot this
// produces touches the start rect, so buying the ring in is always reachable from day one.
export function generateExpansionBlocks(
  land: LandConfig,
  world: { columns: number; rows: number },
): BlockExpansion[] {
  const { start } = land;
  const topMargin = start.row;
  const bottomMargin = world.rows - (start.row + start.rows);
  const leftMargin = start.col;
  const rightMargin = world.columns - (start.col + start.cols);

  // Top/bottom span the full world width, covering the corners; left/right only fill the
  // strip between them, so every cell outside the start rect is covered exactly once.
  return [
    ...band('top', land.top, 'cols', 0, world.columns, 0, topMargin),
    ...band('bottom', land.bottom, 'cols', 0, world.columns, start.row + start.rows, bottomMargin),
    ...band('left', land.left, 'rows', start.row, start.rows, 0, leftMargin),
    ...band(
      'right',
      land.right,
      'rows',
      start.row,
      start.rows,
      start.col + start.cols,
      rightMargin,
    ),
  ];
}

// Tiles one straight strip into chunks along its length (sized by the band's config in that
// axis); the final chunk absorbs whatever remainder doesn't divide evenly. `across`/`thickness`
// are the strip's position and depth on the other axis (e.g. a top band's row and height).
function band(
  id: string,
  spec: RingBand,
  axis: 'cols' | 'rows',
  alongStart: number,
  length: number,
  across: number,
  thickness: number,
): BlockExpansion[] {
  if (thickness <= 0) return [];
  const chunkSize = axis === 'cols' ? spec.cols : spec.rows;
  const blocks: BlockExpansion[] = [];
  let index = 0;
  for (let at = alongStart; at < alongStart + length; at += chunkSize) {
    const size = Math.min(chunkSize, alongStart + length - at);
    const rect: GridRect =
      axis === 'cols'
        ? { col: at, row: across, cols: size, rows: thickness }
        : { col: across, row: at, cols: thickness, rows: size };
    blocks.push({
      id: `${id}-${index++}`,
      ...rect,
      price: spec.price,
      unlockLevel: spec.unlockLevel,
    });
  }
  return blocks;
}
