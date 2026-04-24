import Conf from "conf"
import type { SerializedEvent } from "terse-types"

import { hashEventKey } from "./sampleEventId.js"

type CacheEntry = {
    event: SerializedEvent
    jobName: string
    cachedAt: number
}

type Schema = {
    sampleEventCache?: Record<string, CacheEntry>
}

export const SAMPLE_CACHE_TTL_MS = 60 * 60 * 1000 // 1h

let _store: Conf<Schema> | null = null

function store(): Conf<Schema> {
    if (!_store) _store = new Conf<Schema>({ projectName: "terse" })
    return _store
}

function readCache(): Record<string, CacheEntry> {
    return store().get("sampleEventCache") ?? {}
}

function writeCache(cache: Record<string, CacheEntry>): void {
    store().set("sampleEventCache", cache)
}

function isFresh(entry: CacheEntry, now: number): boolean {
    return now - entry.cachedAt < SAMPLE_CACHE_TTL_MS
}

export function readCachedEvent(hash: string, jobName: string): SerializedEvent | null {
    const cache = readCache()
    const entry = cache[hash]
    if (!entry) return null
    if (entry.jobName !== jobName) return null
    if (!isFresh(entry, Date.now())) return null
    return entry.event
}

/**
 * Overwrites any existing cache entries for this job with the fresh fetch,
 * prunes expired entries from other jobs. Called by `terse test list`.
 */
export function writeCachedEvents(jobName: string, events: SerializedEvent[]): void {
    const now = Date.now()
    const cache = readCache()

    for (const [hash, entry] of Object.entries(cache)) {
        if (entry.jobName === jobName || !isFresh(entry, now)) {
            delete cache[hash]
        }
    }

    for (const event of events) {
        cache[hashEventKey(event)] = { event, jobName, cachedAt: now }
    }

    writeCache(cache)
}
