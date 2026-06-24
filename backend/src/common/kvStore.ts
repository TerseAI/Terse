/**
 * Small key/value store with per-entry TTL. Values must be JSON-serializable so a Redis-backed
 * implementation can be slotted in unchanged.
 */
export interface KvStore {
    get<T>(key: string): Promise<T | null>
    set<T>(key: string, value: T, ttlMs: number): Promise<void>
    delete(key: string): Promise<void>
}

class InMemoryKvStore implements KvStore {
    private readonly store = new Map<string, { value: unknown; expiresAt: number }>()

    async get<T>(key: string): Promise<T | null> {
        const entry = this.store.get(key)
        if (!entry) return null
        if (entry.expiresAt <= Date.now()) {
            this.store.delete(key)
            return null
        }
        return entry.value as T
    }

    async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
        this.sweepExpired()
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
    }

    async delete(key: string): Promise<void> {
        this.store.delete(key)
    }

    private sweepExpired(): void {
        const now = Date.now()
        for (const [key, entry] of this.store) {
            if (entry.expiresAt <= now) this.store.delete(key)
        }
    }
}

let kvStoreSingleton: KvStore | null = null

export function getKvStore(): KvStore {
    if (!kvStoreSingleton) {
        kvStoreSingleton = new InMemoryKvStore()
    }
    return kvStoreSingleton
}
