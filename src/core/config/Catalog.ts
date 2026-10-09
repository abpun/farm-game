import type { CatalogCategory, CatalogData, CatalogItem } from '../entities/types';

export class Catalog {
  private readonly byId = new Map<string, CatalogItem>();
  private readonly categoryList: CatalogCategory[];

  constructor(data: CatalogData) {
    this.categoryList = data.categories;
    const categoryIds = new Set(data.categories.map((category) => category.id));
    for (const item of data.items) {
      this.assertValid(item, categoryIds);
      this.byId.set(item.id, item);
    }
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): CatalogItem {
    const item = this.byId.get(id);
    if (!item) throw new Error(`Unknown catalog item: ${id}`);
    return item;
  }

  categories(): readonly CatalogCategory[] {
    return this.categoryList;
  }

  /** Items shown in the market for a category, in catalog order. */
  listed(categoryId: string): CatalogItem[] {
    return [...this.byId.values()].filter((item) => item.category === categoryId && item.listed);
  }

  all(): CatalogItem[] {
    return [...this.byId.values()];
  }

  private assertValid(item: CatalogItem, categoryIds: Set<string>): void {
    if (this.byId.has(item.id)) throw new Error(`Duplicate catalog id: ${item.id}`);
    if (!categoryIds.has(item.category))
      throw new Error(`${item.id}: unknown category ${item.category}`);
    if (item.price < 0) throw new Error(`${item.id}: price must be >= 0`);
    if (item.footprint.cols < 1 || item.footprint.rows < 1) {
      throw new Error(`${item.id}: footprint must be at least 1×1`);
    }
  }
}
