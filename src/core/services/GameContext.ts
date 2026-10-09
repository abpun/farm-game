import type { Content } from '../config/Content';
import type { FarmState } from '../entities/types';
import type { GameBus } from '../events/EventBus';
import type { Random } from '../random';
import type { BuildingSystem } from '../systems/BuildingSystem';
import type { EconomySystem } from '../systems/EconomySystem';
import type { InventorySystem } from '../systems/InventorySystem';
import type { PlotSystem } from '../systems/PlotSystem';
import type { ProgressionSystem } from '../systems/ProgressionSystem';
import type { SeasonSystem } from '../systems/SeasonSystem';
import type { TimeSystem } from '../systems/TimeSystem';
import type { WorldSystem } from '../systems/WorldSystem';

/** Everything a player-action service may touch. */
export interface GameContext {
  content: Content;
  state: FarmState;
  bus: GameBus;
  random: Random;
  time: TimeSystem;
  seasons: SeasonSystem;
  economy: EconomySystem;
  inventory: InventorySystem;
  progression: ProgressionSystem;
  world: WorldSystem;
  plots: PlotSystem;
  buildings: BuildingSystem;
}
