import { describe, expect, it } from 'vitest';
import { polylineDistance } from '@core/config/geometry';
import { loadConfig } from '@core/config/loadConfig';
import { dressWorld } from '@game/map/dressing';
import { CODE } from '@game/map/terrain';
import { plantForests } from '@game/map/vegetation';
import { toGrid, WORLD } from '@game/map/WorldMap';
import { WorldShape } from '@game/map/WorldShape';

const config = loadConfig();
const shape = new WorldShape(
  WORLD,
  config.farm.world.columns,
  config.farm.world.rows,
  config.farm.paths,
);
const at = (u: number, v: number) => toGrid(u, v);
const surfaceAt = (u: number, v: number) => {
  const { col, row } = at(u, v);
  return shape.surface(col, row);
};

// The map is authored data; these checks keep edits from breaking the geography.
describe('world map', () => {
  it('keeps every build-grid tile dry grass', () => {
    const { columns, rows } = config.farm.world;
    for (let col = 0; col < columns; col += 0.5) {
      for (let row = 0; row < rows; row += 0.5) expect(shape.surface(col, row)).toBe('grass');
    }
  });

  it('puts the sea only in the south and dry land along the north edge', () => {
    for (let u = WORLD.bounds.west; u <= WORLD.bounds.east; u += 4) {
      expect(surfaceAt(u, WORLD.bounds.south - 1)).toBe('water');
      expect(
        shape.isWater(at(u, WORLD.bounds.north + 1).col, at(u, WORLD.bounds.north + 1).row),
      ).toBe(false);
    }
  });

  it('draws the farm paths on exactly the tiles the farm keeps clear', () => {
    const { columns, rows } = config.farm.world;
    const farmOnly = new WorldShape({ ...WORLD, paths: [] }, columns, rows, config.farm.paths);
    let pathCells = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const crossed = [0.2, 0.5, 0.8].some((dy) =>
          [0.2, 0.5, 0.8].some((dx) =>
            config.farm.paths.some(
              (p) => polylineDistance(p.points, col + dx, row + dy) < p.width / 2,
            ),
          ),
        );
        expect(farmOnly.terrain.at(col, row) === CODE.path, `${col},${row}`).toBe(crossed);
        if (crossed) pathCells++;
      }
    }
    expect(pathCells).toBeGreaterThan(0);
  });

  it('runs the river from the pond to the sea without a gap', () => {
    const points = WORLD.river.points;
    for (let i = 1; i < points.length; i++) {
      const [u0, v0] = points[i - 1]!;
      const [u1, v1] = points[i]!;
      for (let t = 0; t <= 1; t += 0.1) {
        const surface = surfaceAt(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t);
        expect(['fresh', 'water']).toContain(surface);
      }
    }
    expect(surfaceAt(WORLD.river.pond.u, WORLD.river.pond.v)).toBe('fresh');
  });

  it('places land features on land, shore spots by the water and bridges over the river', () => {
    for (const feature of WORLD.features) {
      const surface = surfaceAt(feature.u, feature.v);
      if (feature.kind === 'spot') {
        const { col, row } = at(feature.u, feature.v);
        const near = [0, 1.2, -1.2].some((d) => shape.isWater(col + d, row + d));
        expect(near, feature.id).toBe(true);
      } else if (feature.kind !== 'harbor' && feature.kind !== 'waterfall') {
        expect(['grass', 'sand', 'rock'], feature.id).toContain(surface);
      }
    }
    for (const bridge of WORLD.bridges) {
      expect(surfaceAt(bridge.u, bridge.v)).toBe('fresh');
      const { col, row } = at(bridge.u, bridge.v);
      expect(shape.isPath(col, row)).toBe(true);
    }
  });

  it('references real game content from the map', () => {
    for (const feature of WORLD.features) {
      if (feature.discovery)
        expect(config.exploration.discoveries.some((d) => d.id === feature.discovery)).toBe(true);
      if (feature.spot) expect(config.fishing.spots.some((s) => s.id === feature.spot)).toBe(true);
    }
    for (const spot of config.fishing.spots.filter((s) => s.access === 'boat')) {
      expect(WORLD.seaSpots[spot.id], spot.id).toBeDefined();
    }
  });

  it('grows forests off paths, water and the farm, and dresses the banks', () => {
    const trees = plantForests(shape);
    expect(trees.length).toBeGreaterThan(150);
    for (const tree of trees) {
      expect(shape.isWater(tree.col, tree.row)).toBe(false);
      expect(shape.isPath(tree.col, tree.row)).toBe(false);
      expect(shape.gridDistance(tree.col, tree.row)).toBeGreaterThan(1);
    }
    const dressing = dressWorld(shape);
    expect(dressing.some((d) => d.kind === 'reeds')).toBe(true);
    expect(
      dressing.filter((d) => d.kind === 'lily').every((d) => shape.isWater(d.col, d.row)),
    ).toBe(true);
  });
});
