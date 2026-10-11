import { describe, expect, it } from 'vitest';
import { generateExpansionBlocks } from '@core/config/expandBlocks';
import { loadConfig } from '@core/config/loadConfig';
import type { GridRect } from '@core/entities/types';

const config = loadConfig();

// Two rects are adjacent when they share a border segment, not just a corner.
function adjacent(a: GridRect, b: GridRect): boolean {
  const colsTouch = a.col + a.cols === b.col || b.col + b.cols === a.col;
  const rowsOverlap = a.row < b.row + b.rows && b.row < a.row + a.rows;
  const rowsTouch = a.row + a.rows === b.row || b.row + b.rows === a.row;
  const colsOverlap = a.col < b.col + b.cols && b.col < a.col + a.cols;
  return (colsTouch && rowsOverlap) || (rowsTouch && colsOverlap);
}

describe('generateExpansionBlocks', () => {
  const blocks = generateExpansionBlocks(config.farm.land, config.farm.world);

  it('gives every plot a unique id', () => {
    expect(new Set(blocks.map((b) => b.id)).size).toBe(blocks.length);
  });

  it('keeps every plot inside the world grid', () => {
    const { columns, rows } = config.farm.world;
    for (const b of blocks) {
      expect(b.col).toBeGreaterThanOrEqual(0);
      expect(b.row).toBeGreaterThanOrEqual(0);
      expect(b.col + b.cols).toBeLessThanOrEqual(columns);
      expect(b.row + b.rows).toBeLessThanOrEqual(rows);
    }
  });

  it('covers every tile outside the start rect exactly once, with no overlaps', () => {
    const { columns, rows } = config.farm.world;
    const { start } = config.farm.land;
    const covered = new Map<string, number>();
    for (const b of blocks) {
      for (let r = b.row; r < b.row + b.rows; r++) {
        for (let c = b.col; c < b.col + b.cols; c++) {
          const key = `${c},${r}`;
          covered.set(key, (covered.get(key) ?? 0) + 1);
        }
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const inStart =
          col >= start.col &&
          col < start.col + start.cols &&
          row >= start.row &&
          row < start.row + start.rows;
        expect(covered.get(`${col},${row}`) ?? 0).toBe(inStart ? 0 : 1);
      }
    }
  });

  it('keeps the whole ring reachable: every plot connects back to the start rect', () => {
    const { start } = config.farm.land;
    const visited = new Set<string>();
    const queue = blocks.filter((b) => adjacent(start, b));
    queue.forEach((b) => visited.add(b.id));
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i]!;
      for (const candidate of blocks) {
        if (visited.has(candidate.id) || !adjacent(current, candidate)) continue;
        visited.add(candidate.id);
        queue.push(candidate);
      }
    }
    expect(visited.size).toBe(blocks.length);
  });
});
