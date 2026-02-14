/**
 * Lightweight event bus for auth lifecycle events.
 *
 * Modules that store user-scoped data (sessionStorage, SWR cache, PostHog, etc.)
 * subscribe here so cleanup is decentralized — each module owns its own teardown.
 */

type AuthEvent = "logout"
type Listener = () => void

const listeners = new Map<AuthEvent, Set<Listener>>()

export function onAuthEvent(event: AuthEvent, listener: Listener): () => void {
    if (!listeners.has(event)) {
        listeners.set(event, new Set())
    }
    listeners.get(event)!.add(listener)

    // Return unsubscribe function
    return () => {
        listeners.get(event)?.delete(listener)
    }
}

export function emitAuthEvent(event: AuthEvent): void {
    const eventListeners = listeners.get(event)
    if (!eventListeners) return

    for (const listener of eventListeners) {
        try {
            listener()
        } catch (error) {
            console.error(`[authEvents] Listener failed for "${event}":`, error)
        }
    }
}
