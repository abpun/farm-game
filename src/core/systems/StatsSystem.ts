import type { Content } from '../config/Content';
import type { FarmState } from '../entities/types';
import type { GameBus } from '../events/EventBus';

const HARVESTED_PREFIX = 'harvested:';

// Lifetime counters fed by gameplay events; achievements read them, no UI writes them.
export class StatsSystem {
  constructor(
    private readonly state: FarmState,
    content: Content,
    bus: GameBus,
  ) {
    bus.on('CropHarvested', ({ cropId, amount }) => {
      this.add('cropsHarvested', amount);
      this.add(`${HARVESTED_PREFIX}${cropId}`, amount);
      if (content.crops.get(cropId).category === 'fruit') this.add('fruitsHarvested', amount);
    });
    bus.on('CropPlanted', ({ cropId }) => {
      if (content.crops.get(cropId).plantOn === 'orchard') this.add('treesPlanted', 1);
    });
    bus.on('FishCaught', ({ fishId }) => {
      this.add('fishCaught', 1);
      if (content.fish.get(fishId).rarity === 'legendary') this.add('legendaryCaught', 1);
    });
    bus.on('AnimalProductsCollected', ({ amount }) => this.add('animalProducts', amount));
    bus.on('ProductionCollected', ({ batches }) => this.add('batchesProduced', batches));
    bus.on('ObjectPlaced', ({ object }) => {
      if (content.buildings.has(object.itemId)) this.add('buildingsBuilt', 1);
    });
    bus.on('OrderCompleted', ({ order }) => {
      this.add('ordersCompleted', 1);
      if (order.daily) this.add('dailiesCompleted', 1);
    });
    bus.on('MoneyChanged', ({ delta, source }) => {
      if (delta > 0 && (source === 'sale' || source === 'order')) {
        this.add('lifetimeEarnings', delta);
      }
    });
    bus.on('LandExpanded', () => this.add('landExpansions', 1));
  }

  get(stat: string): number {
    return this.state.stats[stat] ?? 0;
  }

  /** Distinct crops ever harvested. */
  cropTypes(): number {
    return Object.keys(this.state.stats).filter((key) => key.startsWith(HARVESTED_PREFIX)).length;
  }

  private add(stat: string, amount: number): void {
    this.state.stats[stat] = this.get(stat) + amount;
  }
}
