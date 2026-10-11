import type { PlacedObject } from '@core/entities/types';
import type { Spot } from '@core/systems/WorldSystem';

export interface GridPoint {
  col: number;
  row: number;
}

/** Where an item lands under the pointer: the tile it's over. */
export function spotUnder(point: GridPoint, rotated = false): Spot {
  const spot: Spot = { col: Math.floor(point.col), row: Math.floor(point.row) };
  if (rotated) spot.rotated = true;
  return spot;
}

export const spotKey = (spot: Spot) => `${spot.col},${spot.row}`;

interface Occupants {
  objectAt(col: number, row: number): PlacedObject | undefined;
}

/** The object under the pointer, if any. */
export function pickObject(world: Occupants, point: GridPoint): PlacedObject | undefined {
  return world.objectAt(Math.floor(point.col), Math.floor(point.row));
}
