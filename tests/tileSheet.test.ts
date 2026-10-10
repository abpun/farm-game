import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellOrigin, SHEET, SHEET_SIZE, sheetIndex, sheetRow } from '@game/art/terrain/tileSheet';
import { SEASON_LOOKS } from '@game/art/seasonLooks';
import { CODE, FULL_MASK, layersFor } from '@game/map/terrain';

const { sea, sand, grass, path, fresh } = CODE;

describe('terrain layers', () => {
  it('fills a plain tile from one layer', () => {
    expect(layersFor([grass, grass, grass, grass])).toEqual([{ code: grass, mask: FULL_MASK }]);
  });

  it('stacks higher terrains over the lowest one by corner mask', () => {
    expect(layersFor([grass, path, path, grass])).toEqual([
      { code: grass, mask: FULL_MASK },
      { code: path, mask: 2 | 4 },
    ]);
    expect(layersFor([sand, grass, fresh, grass])).toEqual([
      { code: sand, mask: FULL_MASK },
      { code: grass, mask: 2 | 4 | 8 },
      { code: fresh, mask: 4 },
    ]);
  });

  it('gives the sea a mask of its own corners so it can draw the shore', () => {
    expect(layersFor([sand, sand, sea, sea])).toEqual([
      { code: sea, mask: 4 | 8 },
      { code: sand, mask: 1 | 2 },
    ]);
  });
});

describe('tileset layout', () => {
  it('puts each terrain on its row and each mask in its column', () => {
    const columns = SHEET.masks + SHEET.variants - 1;
    expect(sheetIndex(grass, 5)).toBe(grass * columns + 5);
    expect(sheetIndex(grass, FULL_MASK, 2)).toBe(grass * columns + SHEET.masks + 1);
    expect(sheetRow(sea, 1)).toBeGreaterThan(fresh);
    expect(sheetRow(grass, 1)).toBe(grass);
    expect(cellOrigin(0, 0)).toEqual({ x: SHEET.gutter, y: SHEET.gutter });
  });

  it('ships a PNG per season with the documented size', () => {
    for (const seasonId of Object.keys(SEASON_LOOKS)) {
      const png = readFileSync(`public/assets/tiles/terrain-${seasonId}.png`);
      expect(png.readUInt32BE(16), seasonId).toBe(SHEET_SIZE.width);
      expect(png.readUInt32BE(20), seasonId).toBe(SHEET_SIZE.height);
    }
  });
});
