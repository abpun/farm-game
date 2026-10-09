import { Catalog } from './config/Catalog';
import { CropRegistry } from './config/CropRegistry';
import { expandLayout } from './config/expandLayout';
import type { FarmState, GameConfig } from './entities/types';
import { EventBus, type GameBus } from './events/EventBus';
import type { GameEvents } from './events/GameEvents';
import { FarmService } from './FarmService';
import { systemClock, type Clock } from './save/Clock';
import type { KeyValueStore } from './save/KeyValueStore';
import { SaveSystem } from './save/SaveSystem';
import { EconomySystem } from './systems/EconomySystem';
import { InventorySystem } from './systems/InventorySystem';
import { PlotSystem } from './systems/PlotSystem';
import { SeasonSystem } from './systems/SeasonSystem';
import { TimeSystem } from './systems/TimeSystem';
import { WorldSystem } from './systems/WorldSystem';

const MS_PER_SEC = 1000;
const SEC_PER_HOUR = 3600;

export class GameSession {
  readonly bus: GameBus = new EventBus<GameEvents>();
  readonly crops: CropRegistry;
  readonly catalog: Catalog;
  readonly state: FarmState;
  readonly time: TimeSystem;
  readonly seasons: SeasonSystem;
  readonly economy: EconomySystem;
  readonly inventory: InventorySystem;
  readonly world: WorldSystem;
  readonly plots: PlotSystem;
  readonly farm: FarmService;
  /** Game seconds simulated on load for the time the player was away. */
  readonly offlineSeconds: number;
  private readonly saves: SaveSystem;
  private savesLocked = false;

  constructor(
    readonly config: GameConfig,
    store: KeyValueStore,
    private readonly clock: Clock = systemClock,
  ) {
    this.crops = new CropRegistry(config.crops);
    this.catalog = new Catalog(config.catalog);
    this.saves = new SaveSystem(store, this.crops, this.catalog, clock);
    const loaded = this.saves.load();
    this.state = loaded?.state ?? createEmptyState(config);
    this.time = new TimeSystem(this.state);
    this.seasons = new SeasonSystem(this.time, config.seasons, config.farm.dayLengthSec, this.bus);
    this.economy = new EconomySystem(this.state, this.bus);
    this.inventory = new InventorySystem(this.state, this.bus);
    this.world = new WorldSystem(this.state, this.catalog, config.farm.world, config.farm.paths);
    this.plots = new PlotSystem(this.state, this.crops, this.seasons, this.bus);
    this.farm = new FarmService({
      crops: this.crops,
      catalog: this.catalog,
      plots: this.plots,
      seasons: this.seasons,
      world: this.world,
      economy: this.economy,
      inventory: this.inventory,
      bus: this.bus,
      refundRatio: config.farm.refundRatio,
    });
    if (!loaded || loaded.layoutPending) this.applyStarterLayout();
    this.offlineSeconds = this.awaySeconds(loaded?.savedAt ?? null);
    this.update(this.offlineSeconds);
  }

  // Steps never cross a season boundary, so crops always grow at the right season's pace.
  update(dtSec: number): void {
    let remaining = dtSec;
    while (remaining > 0) {
      const step = Math.min(remaining, this.seasons.secondsToNextSeason());
      this.plots.grow(step, this.seasons.current().id);
      this.time.update(step);
      remaining -= step;
    }
    this.seasons.checkForChange();
  }

  save(): boolean {
    if (this.savesLocked || !this.saves.save(this.state)) return false;
    this.bus.emit('GameSaved', { savedAt: this.clock.now() });
    return true;
  }

  exportSave(): string {
    return this.saves.export(this.state);
  }

  // Import and reset rewrite storage for the next boot, so this session stops saving.
  importSave(text: string): boolean {
    if (!this.saves.import(text)) return false;
    this.savesLocked = true;
    return true;
  }

  resetSave(): void {
    this.saves.clear();
    this.savesLocked = true;
  }

  // Free placement of the starter pieces; tiles that are already taken are skipped.
  private applyStarterLayout(): void {
    for (const { itemId, col, row } of expandLayout(this.config.farm.starterLayout)) {
      const object = this.world.place(itemId, col, row);
      if (object && this.catalog.get(itemId).kind === 'plot') this.plots.create(object.id);
    }
  }

  private awaySeconds(savedAt: number | null): number {
    if (savedAt === null) return 0;
    const cap = this.config.farm.maxOfflineHours * SEC_PER_HOUR;
    return Math.min(cap, Math.max(0, (this.clock.now() - savedAt) / MS_PER_SEC));
  }
}

function createEmptyState(config: GameConfig): FarmState {
  return {
    money: config.farm.startingMoney,
    time: 0,
    inventory: {},
    nextObjectId: 1,
    objects: [],
    plots: {},
  };
}
