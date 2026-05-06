/**
 * Set of helper functions for safely working with browser storage.
 */

export function safeStorageGet(key: string, storage?: Storage): string | null {
    try {
        const s = storage ?? sessionStorage
        return s.getItem(key)
    } catch {
        return null
    }
}

export function safeStorageSet(key: string, value: string, storage?: Storage): boolean {
    try {
        const s = storage ?? sessionStorage
        s.setItem(key, value)
        return true
    } catch {
        return false
    }
}

export function safeStorageRemove(key: string, storage?: Storage): boolean {
    try {
        const s = storage ?? sessionStorage
        s.removeItem(key)
        return true
    } catch {
        return false
    }
}
