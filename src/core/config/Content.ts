import type {
  AchievementDef,
  AnimalDef,
  BoatDef,
  BuildingDef,
  DepositDef,
  DiscoveryDef,
  FishDef,
  MineNodeDef,
  PickaxeDef,
  Quantities,
  RecipeDef,
  RodDef,
  SpotDef,
} from '../entities/content';
import type { GameConfig } from '../entities/types';
import { Catalog } from './Catalog';
import { CropRegistry } from './CropRegistry';
import { ItemRegistry } from './ItemRegistry';
import { Registry } from './Registry';

// All game content, with every cross-reference checked once at boot so systems can trust ids.
export class Content {
  readonly crops: CropRegistry;
  readonly catalog: Catalog;
  readonly items: ItemRegistry;
  readonly recipes: Registry<RecipeDef>;
  readonly buildings: Registry<BuildingDef>;
  readonly animals: Registry<AnimalDef>;
  readonly fish: Registry<FishDef>;
  readonly rods: Registry<RodDef>;
  readonly spots: Registry<SpotDef>;
  readonly achievements: Registry<AchievementDef>;
  readonly boats: Registry<BoatDef>;
  readonly pickaxes: Registry<PickaxeDef>;
  readonly deposits: Registry<DepositDef>;
  readonly mineNodes: Registry<MineNodeDef>;
  readonly discoveries: Registry<DiscoveryDef>;

  constructor(readonly config: GameConfig) {
    this.crops = new CropRegistry(config.crops);
    this.catalog = new Catalog(config.catalog);
    this.items = new ItemRegistry(config.items.items, config.crops, config.fishing.fish);
    this.recipes = new Registry('recipe', config.recipes.recipes, (r) => this.checkRecipe(r));
    this.buildings = new Registry('building', config.buildings.buildings, (b) =>
      this.checkBuilding(b),
    );
    this.animals = new Registry('animal', config.animals.animals, (a) => this.checkAnimal(a));
    this.spots = new Registry('fishing spot', config.fishing.spots);
    this.fish = new Registry('fish', config.fishing.fish, (f) =>
      f.spots.forEach((spot) => this.spots.get(spot)),
    );
    this.rods = new Registry('rod', config.fishing.rods);
    config.fishing.baits.forEach((bait) => this.assertItem(bait.item, 'bait'));
    this.achievements = new Registry('achievement', config.achievements.achievements, (a) =>
      this.checkAchievement(a),
    );
    if (this.rods.all().length === 0) throw new Error('At least one fishing rod is required');
    this.boats = new Registry('boat', config.fishing.boats, (b) =>
      this.assertQuantities(b.materials, `boat ${b.id}`),
    );
    this.pickaxes = new Registry('pickaxe', config.mining.pickaxes, (p) =>
      this.assertQuantities(p.materials, `pickaxe ${p.id}`),
    );
    if (this.pickaxes.all().length === 0) throw new Error('At least one pickaxe is required');
    this.deposits = new Registry('deposit', config.mining.deposits, (d) => {
      if (d.drops.length === 0) throw new Error(`deposit ${d.id}: needs drops`);
      d.drops.forEach((drop) => this.assertItem(drop.item, `deposit ${d.id}`));
    });
    this.mineNodes = new Registry('mine node', config.mining.nodes, (n) =>
      this.deposits.get(n.deposit),
    );
    this.discoveries = new Registry('discovery', config.exploration.discoveries, (d) =>
      this.checkReward(d.reward, `discovery ${d.id}`),
    );
    for (const building of this.buildings.all()) {
      building.levels.forEach((level) =>
        this.assertQuantities(level.materials ?? {}, `building ${building.id}`),
      );
    }
  }

  private assertQuantities(quantities: Quantities, where: string): void {
    Object.keys(quantities).forEach((id) => this.assertItem(id, where));
  }

  private checkReward(reward: AchievementDef['reward'], where: string): void {
    for (const id of Object.keys(reward.items ?? {})) this.assertItem(id, where);
    for (const id of reward.unlocks ?? []) {
      if (!this.catalog.has(id)) throw new Error(`${where}: unknown unlock ${id}`);
    }
  }

  recipesFor(buildingId: string): RecipeDef[] {
    return this.recipes.all().filter((recipe) => recipe.building === buildingId);
  }

  /** The animal kept in a housing building, if it is one. */
  animalFor(buildingId: string): AnimalDef | undefined {
    return this.animals.all().find((animal) => animal.housing === buildingId);
  }

  private assertItem(id: string, where: string): void {
    if (!this.items.has(id)) throw new Error(`${where}: unknown item ${id}`);
  }

  private checkRecipe(recipe: RecipeDef): void {
    const where = `recipe ${recipe.id}`;
    if (!this.catalog.has(recipe.building)) throw new Error(`${where}: unknown building`);
    if (recipe.durationSec <= 0) throw new Error(`${where}: durationSec must be > 0`);
    for (const [id, count] of [
      ...Object.entries(recipe.inputs),
      ...Object.entries(recipe.outputs),
    ]) {
      this.assertItem(id, where);
      if (!Number.isInteger(count) || count < 1) throw new Error(`${where}: bad quantity`);
    }
  }

  private checkBuilding(building: BuildingDef): void {
    if (!this.catalog.has(building.id)) throw new Error(`building ${building.id}: not in catalog`);
    if (building.levels.length === 0) throw new Error(`building ${building.id}: needs levels`);
  }

  private checkAnimal(animal: AnimalDef): void {
    const where = `animal ${animal.id}`;
    if (!this.catalog.has(animal.housing)) throw new Error(`${where}: unknown housing`);
    this.assertItem(animal.feed, where);
    this.assertItem(animal.product, where);
  }

  private checkAchievement(achievement: AchievementDef): void {
    this.checkReward(achievement.reward, `achievement ${achievement.id}`);
  }
}
