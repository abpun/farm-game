import type { FishDef, ItemCategory, ItemDef } from '../entities/content';
import type { CropDef } from '../entities/types';
import { Registry } from './Registry';

// Every inventory item: items.json plus the produce of each crop and every fish.
export class ItemRegistry extends Registry<ItemDef> {
  constructor(items: readonly ItemDef[], crops: readonly CropDef[], fish: readonly FishDef[]) {
    const fromCrops = crops.map((crop): ItemDef => ({
      id: crop.id,
      name: crop.name,
      category: crop.category,
      sellPrice: crop.sellPrice,
    }));
    const fromFish = fish.map((f): ItemDef => ({
      id: f.id,
      name: f.name,
      category: 'fish',
      sellPrice: f.sellPrice,
      icon: f.icon,
    }));
    super('item', [...fromCrops, ...fromFish, ...items], (item) => {
      if (item.sellPrice < 0) throw new Error(`${item.id}: sellPrice must be >= 0`);
      if (item.buyPrice !== undefined && item.buyPrice <= item.sellPrice) {
        throw new Error(`${item.id}: buyPrice must exceed sellPrice`);
      }
    });
  }

  name(id: string): string {
    return this.find(id)?.name ?? id;
  }

  inCategory(category: ItemCategory): ItemDef[] {
    return this.all().filter((item) => item.category === category);
  }

  /** Items the market stocks. */
  buyable(): ItemDef[] {
    return this.all().filter((item) => item.buyPrice !== undefined);
  }

  /** Sell value of a bundle of items. */
  value(quantities: Record<string, number>): number {
    return Object.entries(quantities).reduce(
      (sum, [id, count]) => sum + (this.find(id)?.sellPrice ?? 0) * count,
      0,
    );
  }
}
