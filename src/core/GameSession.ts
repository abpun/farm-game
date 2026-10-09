import { Content } from './config/Content';
import type { Catalog } from './config/Catalog';
import type { CropRegistry } from './config/CropRegistry';
import { expandLayout } from './config/expandLayout';
import type { FarmState, GameConfig } from './entities/types';
import { EventBus, type GameBus } from './events/EventBus';
import type { GameEvents } from './events/GameEvents';
import { FarmService } from './FarmService';
import type { Random } from './random';
import { systemClock, type Clock } from './save/Clock';
import type { KeyValueStore } from './save/KeyValueStore';
import { createEmptyState } from './save/normalizeState';
import { SaveSystem } from './save/SaveSystem';
import { AchievementService } from './services/AchievementService';
import { FishingService } from './services/FishingService';
import type { GameContext } from './services/GameContext';
import { OrderService } from './services/OrderService';
import { ProductionService } from './services/ProductionService';
import { RanchService } from './services/RanchService';
import { BuildingSystem } from './systems/BuildingSystem';
import { EconomySystem } from './systems/EconomySystem';
import { InventorySystem } from './systems/InventorySystem';
import { PlotSystem } from './systems/PlotSystem';
import { ProgressionSystem } from './systems/ProgressionSystem';
import { SeasonSystem } from './systems/SeasonSystem';
import { StatsSystem } from './systems/StatsSystem';
import { TimeSystem } from './systems/TimeSystem';
import { WorldSystem } from './systems/WorldSystem';

const MS_PER_SEC = 1000;
const SEC_PER_HOUR = 3600;

export interface SessionOptions {
  clock?: Clock;
  random?: Random;
}

export class GameSession {
  readonly bus: GameBus = new EventBus<GameEvents>();
  readonly content: Content;
  readonly crops: CropRegistry;
  readonly catalog: Catalog;
  readonly state: FarmState;
  readonly time: TimeSystem;
  readonly seasons: SeasonSystem;
  readonly economy: EconomySystem;
  readonly inventory: InventorySystem;
  readonly progression: ProgressionSystem;
  readonly world: WorldSystem;
  readonly plots: PlotSystem;
  readonly buildings: BuildingSystem;
  readonly stats: StatsSystem;
  readonly farm: FarmService;
  readonly production: ProductionService;
  readonly ranch: RanchService;
  readonly fishing: FishingService;
  readonly orders: OrderService;
  readonly achievements: AchievementService;
  /** Game seconds simulated on load for the time the player was away. */
  readonly offlineSeconds: number;
  private readonly saves: SaveSystem;
  private readonly clock: Clock;
  private savesLocked = false;

  constructor(
    readonly config: GameConfig,
    store: KeyValueStore,
    options: Clock | SessionOptions = {},
  ) {
    const { clock = systemClock, random = Math.random } =
      'now' in options ? { clock: options } : options;
    this.clock = clock;
    this.content = new Content(config);
    this.crops = this.content.crops;
    this.catalog = this.content.catalog;
    this.saves = new SaveSystem(store, this.content, clock);
    const loaded = this.saves.load();
    this.state = loaded?.state ?? createEmptyState(config);

    const { farm } = config;
    this.time = new TimeSystem(this.state);
    this.seasons = new SeasonSystem(this.time, config.seasons, farm.dayLengthSec, this.bus);
    this.economy = new EconomySystem(this.state, this.bus);
    this.inventory = new InventorySystem(
      this.state,
      this.content.items,
      config.buildings.storage,
      this.bus,
    );
    this.progression = new ProgressionSystem(
      this.state,
      config.progression.levels,
      this.economy,
      this.bus,
    );
    this.world = new WorldSystem(this.state, this.catalog, farm.world, farm.paths);
    this.plots = new PlotSystem(this.state, this.crops, this.seasons, this.bus, farm.waterBoost);
    this.buildings = new BuildingSystem(this.state, this.content, this.world, this.time, this.bus);
    this.stats = new StatsSystem(this.state, this.content, this.bus);

    const ctx: GameContext = {
      content: this.content,
      state: this.state,
      bus: this.bus,
      random,
      time: this.time,
      seasons: this.seasons,
      economy: this.economy,
      inventory: this.inventory,
      progression: this.progression,
      world: this.world,
      plots: this.plots,
      buildings: this.buildings,
    };
    this.farm = new FarmService(ctx, farm.refundRatio, farm.land.expansions);
    this.production = new ProductionService(ctx);
    this.ranch = new RanchService(ctx, farm.dayLengthSec);
    this.fishing = new FishingService(ctx);
    this.orders = new OrderService(ctx, this.fishing, farm.dayLengthSec);
    this.achievements = new AchievementService(ctx, this.stats, {
      productiveAnimals: () => this.ranch.productiveCount(),
      fishSpecies: () => Object.keys(this.state.fishing.journal).length,
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
    this.buildings.update();
    this.fishing.update();
    this.orders.update();
    this.achievements.check();
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
