type Entry<V> = { value: V; expiresAt: number };

export class TtlCache<V> {
  private store = new Map<string, Entry<V>>();
  private inflight = new Map<string, Promise<V>>();

  constructor(private ttlMs: number) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  async getOrFetch(key: string, fetcher: () => Promise<V>): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const p = fetcher().finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    const result = await p;
    this.set(key, result);
    return result;
  }

  clear(): void {
    this.store.clear();
  }
}
