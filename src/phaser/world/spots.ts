import type { EdgeSide, PlacedObject } from '@core/entities/types';
import type { Spot } from '@core/systems/WorldSystem';

export interface GridPoint {
  col: number;
  row: number;
}

/** The tile edge nearest a fractional grid point: a north or west edge of some cell. */
export function nearestEdge({ col, row }: GridPoint): Spot & { edge: EdgeSide } {
  const toRow = Math.abs(row - Math.round(row));
  const toCol = Math.abs(col - Math.round(col));
  if (toRow <= toCol) return { col: Math.floor(col), row: Math.round(row), edge: 'n' };
  return { col: Math.round(col), row: Math.floor(row), edge: 'w' };
}

/** Where an item lands under the pointer: an edge for edge items, else the tile. */
export function spotUnder(point: GridPoint, onEdge: boolean, rotated = false): Spot {
  if (onEdge) return nearestEdge(point);
  const spot: Spot = { col: Math.floor(point.col), row: Math.floor(point.row) };
  if (rotated) spot.rotated = true;
  return spot;
}

export const spotKey = (spot: Spot) => `${spot.col},${spot.row},${spot.edge ?? ''}`;

/** Picking prefers a fence this close to the pointer (tiles) over the tile it borders. */
const EDGE_PICK = 0.22;

interface Occupants {
  objectAt(col: number, row: number): PlacedObject | undefined;
  edgeAt(col: number, row: number, side: EdgeSide): PlacedObject | undefined;
}

/** The object under the pointer: a nearby fence or hedge first, then whatever fills the tile. */
export function pickObject(world: Occupants, point: GridPoint): PlacedObject | undefined {
  const edge = nearestEdge(point);
  const onEdge = world.edgeAt(edge.col, edge.row, edge.edge);
  const distance =
    edge.edge === 'n' ? Math.abs(point.row - edge.row) : Math.abs(point.col - edge.col);
  if (onEdge && distance < EDGE_PICK) return onEdge;
  return world.objectAt(Math.floor(point.col), Math.floor(point.row)) ?? onEdge;
}
