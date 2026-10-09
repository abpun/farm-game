import type { Content } from '../config/Content';
import type { BuildingDef, BuildingLevel } from '../entities/content';
import type { BuildingState, FarmState } from '../entities/types';
import type { GameBus } from '../events/EventBus';
import type { TimeSystem } from './TimeSystem';
import type { WorldSystem } from './WorldSystem';

// State shared by production buildings and animal housing: level, construction, queue, animals.
export class BuildingSystem {
  private readonly underConstruction = new Set<number>();

  constructor(
    private readonly state: FarmState,
    private readonly content: Content,
    private readonly world: WorldSystem,
    private readonly time: TimeSystem,
    private readonly bus: GameBus,
  ) {
    for (const id of this.ids()) {
      if (!this.isOperational(id)) this.underConstruction.add(id);
    }
  }

  ids(): number[] {
    return Object.keys(this.state.buildings).map(Number);
  }

  /** True for placed objects that have production or housing behaviour. */
  isBuilding(objectId: number): boolean {
    return String(objectId) in this.state.buildings;
  }

  /** Whether a catalog item gets a building record when placed. */
  hasBehaviour(itemId: string): boolean {
    return this.content.buildings.has(itemId);
  }

  create(objectId: number, itemId: string): void {
    const def = this.content.buildings.get(itemId);
    this.state.buildings[String(objectId)] = {
      level: 1,
      readyAt: this.time.now() + def.buildSec,
      queue: [],
      animals: [],
    };
    this.underConstruction.add(objectId);
  }

  delete(objectId: number): void {
    delete this.state.buildings[String(objectId)];
    this.underConstruction.delete(objectId);
  }

  record(objectId: number): BuildingState {
    const record = this.state.buildings[String(objectId)];
    if (!record) throw new Error(`Unknown building: ${objectId}`);
    return record;
  }

  def(objectId: number): BuildingDef {
    const object = this.world.get(objectId);
    if (!object) throw new Error(`Unknown building object: ${objectId}`);
    return this.content.buildings.get(object.itemId);
  }

  /** Placed buildings of a role, in placement order. */
  ofRole(role: BuildingDef['role']): number[] {
    return this.ids().filter((id) => this.def(id).role === role);
  }

  isOperational(objectId: number): boolean {
    return this.time.now() >= this.record(objectId).readyAt;
  }

  constructionRemaining(objectId: number): number {
    return Math.max(0, this.record(objectId).readyAt - this.time.now());
  }

  levelDef(objectId: number): BuildingLevel {
    const def = this.def(objectId);
    return def.levels[this.record(objectId).level - 1] ?? (def.levels[0] as BuildingLevel);
  }

  nextLevel(objectId: number): BuildingLevel | undefined {
    return this.def(objectId).levels[this.record(objectId).level];
  }

  upgrade(objectId: number): void {
    const record = this.record(objectId);
    record.level += 1;
    this.bus.emit('BuildingUpgraded', { objectId, level: record.level });
  }

  /** Announces buildings whose construction finished since the last call. */
  update(): void {
    for (const id of this.underConstruction) {
      if (!this.isBuilding(id)) {
        this.underConstruction.delete(id);
        continue;
      }
      if (!this.isOperational(id)) continue;
      this.underConstruction.delete(id);
      this.bus.emit('BuildingCompleted', { objectId: id });
    }
  }
}
