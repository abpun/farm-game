import type { GameSession } from '@core/GameSession';
import { IsoGrid } from './IsoGrid';

export const createFarmGrid = (session: GameSession): IsoGrid =>
  new IsoGrid(session.config.farm.world.columns, session.config.farm.world.rows);
