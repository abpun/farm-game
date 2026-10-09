// Ordered id → definition lookup that rejects duplicates and unknown ids.
export class Registry<T extends { id: string }> {
  private readonly byId = new Map<string, T>();

  constructor(
    private readonly label: string,
    entries: readonly T[],
    validate: (entry: T) => void = () => undefined,
  ) {
    for (const entry of entries) {
      if (this.byId.has(entry.id)) throw new Error(`Duplicate ${label} id: ${entry.id}`);
      validate(entry);
      this.byId.set(entry.id, entry);
    }
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): T {
    const entry = this.byId.get(id);
    if (!entry) throw new Error(`Unknown ${this.label}: ${id}`);
    return entry;
  }

  find(id: string): T | undefined {
    return this.byId.get(id);
  }

  all(): T[] {
    return [...this.byId.values()];
  }
}
