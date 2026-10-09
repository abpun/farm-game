import type {
  AchievementDef,
  AnimalDef,
  BuildingDef,
  FishDef,
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
    const where = `achievement ${achievement.id}`;
    for (const id of Object.keys(achievement.reward.items ?? {})) this.assertItem(id, where);
    for (const id of achievement.reward.unlocks ?? []) {
      if (!this.catalog.has(id)) throw new Error(`${where}: unknown unlock ${id}`);
    }
  }
}
