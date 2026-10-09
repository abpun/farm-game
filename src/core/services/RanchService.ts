import { fail, ok, type ActionResult } from '../actions';
import type { AnimalDef } from '../entities/content';
import type { AnimalState } from '../entities/types';
import { BARN_FULL } from '../FarmService';
import {
  animalStatus,
  bonusChance,
  collectAnimal,
  feedAnimal,
  happinessAt,
  newAnimal,
  type AnimalStatus,
} from '../systems/animalRules';
import type { GameContext } from './GameContext';

// Buying, feeding and collecting from animals, one housing building at a time.
export class RanchService {
  constructor(
    private readonly ctx: GameContext,
    private readonly dayLengthSec: number,
  ) {}

  private get rules() {
    return this.ctx.content.config.animals.happiness;
  }

  animalOf(objectId: number): AnimalDef | undefined {
    const object = this.ctx.world.get(objectId);
    return object ? this.ctx.content.animalFor(object.itemId) : undefined;
  }

  animals(objectId: number): readonly AnimalState[] {
    return this.ctx.buildings.isBuilding(objectId)
      ? this.ctx.buildings.record(objectId).animals
      : [];
  }

  capacity(objectId: number): number {
    return this.ctx.buildings.levelDef(objectId).capacity ?? 0;
  }

  status(animal: AnimalState): AnimalStatus {
    return animalStatus(animal, this.ctx.time.now());
  }

  happiness(animal: AnimalState): number {
    return happinessAt(animal, this.ctx.time.now(), this.rules, this.dayLengthSec);
  }

  countByStatus(objectId: number, status: AnimalStatus): number {
    return this.animals(objectId).filter((animal) => this.status(animal) === status).length;
  }

  /** Animals that are happy and either producing or waiting to be collected. */
  productiveCount(): number {
    return this.ctx.buildings
      .ofRole('housing')
      .flatMap((id) => this.animals(id))
      .filter(
        (animal) =>
          this.status(animal) !== 'hungry' && this.happiness(animal) >= this.rules.productiveMin,
      ).length;
  }

  totalAnimals(): number {
    return this.ctx.buildings.ofRole('housing').reduce((n, id) => n + this.animals(id).length, 0);
  }

  produceSec(objectId: number, animal: AnimalDef): number {
    return animal.produceSec / this.ctx.buildings.levelDef(objectId).speed;
  }

  buyAnimal(objectId: number): ActionResult {
    const { buildings, progression, economy, time, bus } = this.ctx;
    const animal = this.animalOf(objectId);
    if (!animal || !buildings.isBuilding(objectId)) return fail('No animals live here');
    if (!buildings.isOperational(objectId)) return fail('Still under construction');
    if (!progression.isUnlocked(animal.unlockLevel)) {
      return fail(`Unlocks at level ${animal.unlockLevel}`);
    }
    const record = buildings.record(objectId);
    if (record.animals.length >= this.capacity(objectId)) return fail('No room left');
    if (!economy.spend(animal.price)) return fail('Not enough money');
    record.animals.push(newAnimal(animal.id, time.now(), this.rules));
    bus.emit('AnimalBought', { objectId, animalId: animal.id });
    return ok;
  }

  /** Buys into the first housing of the right kind with room (used by the market). */
  buyAnimalAnywhere(animalId: string): ActionResult {
    const { content, buildings } = this.ctx;
    const animal = content.animals.find(animalId);
    if (!animal) return fail('Unknown animal');
    const homes = buildings.ofRole('housing').filter((id) => this.animalOf(id)?.id === animalId);
    if (homes.length === 0) {
      return fail(`Build a ${content.catalog.get(animal.housing).name} first`);
    }
    const home = homes.find(
      (id) => buildings.isOperational(id) && this.animals(id).length < this.capacity(id),
    );
    return home === undefined ? fail('No room left') : this.buyAnimal(home);
  }

  /** Feeds every hungry animal the feed stock allows. */
  feedAll(objectId: number): ActionResult {
    const { inventory, time, bus, content } = this.ctx;
    const animal = this.animalOf(objectId);
    if (!animal) return fail('No animals live here');
    const hungry = this.animals(objectId).filter((a) => this.status(a) === 'hungry');
    if (hungry.length === 0) return fail('Nobody is hungry');
    let fed = 0;
    for (const target of hungry) {
      if (!inventory.remove(animal.feed, animal.feedAmount)) break;
      feedAnimal(
        target,
        time.now(),
        this.produceSec(objectId, animal),
        this.rules,
        this.dayLengthSec,
      );
      fed += 1;
    }
    if (fed === 0) {
      return fail(`Need ${animal.feedAmount} ${content.items.name(animal.feed)}`);
    }
    bus.emit('AnimalsFed', { objectId, count: fed });
    return ok;
  }

  /** Collects from every ready animal until the barn is full; happy animals may give extra. */
  collectAll(objectId: number): ActionResult {
    const { inventory, time, bus, progression, random } = this.ctx;
    const animal = this.animalOf(objectId);
    if (!animal) return fail('No animals live here');
    const ready = this.animals(objectId).filter((a) => this.status(a) === 'ready');
    if (ready.length === 0) return fail('Nothing to collect');
    let collected = 0;
    for (const target of ready) {
      if (!inventory.canFit(1)) break;
      const bonus = random() < bonusChance(this.happiness(target), this.rules) ? 1 : 0;
      const amount = inventory.canFit(1 + bonus) ? 1 + bonus : 1;
      collectAnimal(target, time.now(), this.rules, this.dayLengthSec);
      inventory.add(animal.product, amount);
      progression.addXp(animal.xp);
      collected += amount;
    }
    if (collected === 0) return fail(BARN_FULL);
    bus.emit('AnimalProductsCollected', { objectId, itemId: animal.product, amount: collected });
    return ok;
  }
}
