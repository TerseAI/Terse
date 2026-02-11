/**
 * Set of helper functions for safely working with browser storage.
 */

export function safeStorageGet(key: string, storage?: Storage): string | null {
    try {
        const s = storage ?? sessionStorage
        return s.getItem(key)
    } catch (error) {
        console.error("Error getting item from storage", error)
        return null
    }
}

export function safeStorageSet(key: string, value: string, storage?: Storage): boolean {
    try {
        const s = storage ?? sessionStorage
        s.setItem(key, value)
        return true
    } catch (error) {
        console.error("Error setting item in storage", error)
        return false
    }
}

export function safeStorageRemove(key: string, storage?: Storage): boolean {
    try {
        const s = storage ?? sessionStorage
        s.removeItem(key)
        return true
    } catch (error) {
        console.error("Error removing item from storage", error)
        return false
    }
}
