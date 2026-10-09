import type { CropDef } from '../entities/types';

export class CropRegistry {
  private readonly byId = new Map<string, CropDef>();

  constructor(crops: readonly CropDef[]) {
    for (const crop of crops) {
      this.assertValid(crop);
      this.byId.set(crop.id, crop);
    }
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): CropDef {
    const crop = this.byId.get(id);
    if (!crop) throw new Error(`Unknown crop: ${id}`);
    return crop;
  }

  all(): CropDef[] {
    return [...this.byId.values()];
  }

  /** Display name for what gets planted (e.g. "Apple Tree"). */
  plantName(id: string): string {
    const crop = this.get(id);
    return crop.plantName ?? crop.name;
  }

  private assertValid(crop: CropDef): void {
    if (this.byId.has(crop.id)) throw new Error(`Duplicate crop id: ${crop.id}`);
    if (crop.growthTimeSec <= 0) throw new Error(`${crop.id}: growthTimeSec must be > 0`);
    if (crop.stages < 2) throw new Error(`${crop.id}: stages must be >= 2`);
    if (crop.yield < 1) throw new Error(`${crop.id}: yield must be >= 1`);
    if (crop.regrowSec !== undefined && crop.regrowSec <= 0) {
      throw new Error(`${crop.id}: regrowSec must be > 0`);
    }
    if (Object.values(crop.seasonGrowth).some((rate) => rate < 0)) {
      throw new Error(`${crop.id}: seasonGrowth rates must be >= 0`);
    }
  }
}
