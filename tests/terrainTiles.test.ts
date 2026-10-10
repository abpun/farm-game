import { describe, expect, it } from 'vitest';
import { blendCorners, CODE, isUniform, signature, type Corners } from '@game/map/terrain';
import { TerrainGrid } from '@game/map/TerrainGrid';

const { sea, sand, grass, fresh, path } = CODE;

describe('blendCorners', () => {
  it('returns the corner terrain at each corner of a tile', () => {
    const corners: Corners = [grass, sea, fresh, path];
    expect(blendCorners(corners, 0, 0).top).toBe(grass);
    expect(blendCorners(corners, 1, 0).top).toBe(sea);
    expect(blendCorners(corners, 1, 1).top).toBe(fresh);
    expect(blendCorners(corners, 0, 1).top).toBe(path);
  });

  it('meets halfway along a shared edge, so neighbouring tiles line up', () => {
    const corners: Corners = [grass, sea, sea, grass];
    expect(blendCorners(corners, 0.4, 0.5).top).toBe(grass);
    expect(blendCorners(corners, 0.6, 0.5).top).toBe(sea);
    expect(blendCorners(corners, 0.6, 0.5).margin).toBeCloseTo(0.2);
  });

  it('breaks ties toward the later terrain so rivers win their own saddles', () => {
    expect(blendCorners([fresh, grass, fresh, grass], 0.5, 0.5).top).toBe(fresh);
  });

  it('names uniform tiles and signatures', () => {
    expect(isUniform([sea, sea, sea, sea])).toBe(true);
    expect(isUniform([sea, sea, sand, sea])).toBe(false);
    expect(signature([sea, grass, sea, grass], 2)).toBe(signature([sea, grass, sea, grass], 2));
    expect(signature([sea, grass, sea, grass], 1)).not.toBe(signature([sea, grass, sea, grass], 2));
  });
});

describe('TerrainGrid', () => {
  const range = { minCol: 0, minRow: 0, maxCol: 6, maxRow: 6 };

  it('stores one terrain per cell and treats outside as sea', () => {
    const grid = new TerrainGrid(range, (col) => (col < 3 ? grass : sea));
    expect(grid.at(1, 4)).toBe(grass);
    expect(grid.at(4, 4)).toBe(sea);
    expect(grid.at(-1, 0)).toBe(sea);
    expect(grid.corners(2, 2)).toEqual([grass, sea, sea, grass]);
  });

  it('draws a line of cells over exactly those cells', () => {
    const grid = new TerrainGrid(range, (col) => (col === 2 ? path : grass));
    for (const row of [1.1, 2.5, 3.9]) {
      expect(grid.terrainAt(2.05, row)).toBe(path);
      expect(grid.terrainAt(2.95, row)).toBe(path);
      expect(grid.terrainAt(1.95, row)).toBe(grass);
      expect(grid.terrainAt(3.05, row)).toBe(grass);
    }
  });

  it('widens diagonal-only river links so the water stays joined', () => {
    const grid = new TerrainGrid(range, (col, row) => (col === row ? fresh : grass));
    for (let i = 0; i < 5; i++) {
      const joined = grid.at(i + 1, i) === fresh || grid.at(i, i + 1) === fresh;
      expect(joined, `${i}`).toBe(true);
    }
  });

  it('never widens into protected cells', () => {
    const grid = new TerrainGrid(
      range,
      (col, row) => (col === row ? fresh : grass),
      () => Infinity,
    );
    expect(grid.at(1, 0)).toBe(grass);
    expect(grid.at(0, 1)).toBe(grass);
  });
});
