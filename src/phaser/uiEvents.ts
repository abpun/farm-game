import { EventBus } from '@core/events/EventBus';

/** Requests from the farm view to the UI layer (opening panels for things tapped on the map). */
export interface UiEvents {
  OpenBuilding: { objectId: number };
  OpenFishing: { spotId: string };
  OpenLand: Record<string, never>;
  OpenMine: Record<string, never>;
  LeaveMine: Record<string, never>;
  OpenHarbor: Record<string, never>;
  /** A hidden place on the map was tapped. */
  Discover: { id: string };
  /** Pan the farm camera to a named landmark (or the farm itself). */
  FocusMap: { featureId: string };
  /** Something entered the barn at this screen position (for the fly-to-barn effect). */
  Collected: { x: number; y: number; itemId: string };
  /** An action was refused; the UI can point at the reason (full barn, no money). */
  Denied: { reason: string };
}

export type UiBus = EventBus<UiEvents>;
export const createUiBus = (): UiBus => new EventBus<UiEvents>();
