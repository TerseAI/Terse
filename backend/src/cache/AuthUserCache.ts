import { User } from "../shared/types"

interface CacheEntry {
    user: User
    expiresAt: number
}

export interface AuthUserCache {
    get(key: string): User | undefined
    set(key: string, user: User): void
    delete(key: string): void
}

const DEFAULT_TTL_MS = 30_000

export function createInMemoryAuthUserCache(ttlMs = DEFAULT_TTL_MS): AuthUserCache {
    const store = new Map<string, CacheEntry>()

    return {
        get(key) {
            const entry = store.get(key)
            if (!entry) return undefined
            if (Date.now() > entry.expiresAt) {
                store.delete(key)
                return undefined
            }
            return entry.user
        },
        set(key, user) {
            store.set(key, { user, expiresAt: Date.now() + ttlMs })
        },
        delete(key) {
            store.delete(key)
        }
    }
}
