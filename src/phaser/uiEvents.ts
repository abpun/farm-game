import { EventBus } from '@core/events/EventBus';

/** Requests from the farm view to the UI layer (opening panels for things tapped on the map). */
export interface UiEvents {
  OpenBuilding: { objectId: number };
  OpenFishing: { spotId: string };
  OpenLand: Record<string, never>;
}

export type UiBus = EventBus<UiEvents>;
export const createUiBus = (): UiBus => new EventBus<UiEvents>();
