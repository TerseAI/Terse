import { useState } from "react"

import { v4 as uuidv4 } from "uuid"

import { safeStorageGet, safeStorageRemove, safeStorageSet } from "../lib/storage"

const SETUP_SESSION_KEY = "terse:agent-setup-session-id"

function getOrCreateSetupSessionId(): string {
    const existing = safeStorageGet(SETUP_SESSION_KEY)
    if (existing) return existing
    const id = uuidv4()
    safeStorageSet(SETUP_SESSION_KEY, id)
    return id
}

export function useBuilderSession() {
    const [sessionId, setSessionId] = useState(() => getOrCreateSetupSessionId())

    function setAndPersistSessionId(id: string): void {
        safeStorageSet(SETUP_SESSION_KEY, id)
        setSessionId(id)
    }

    function resetSessionId(): string {
        const id = uuidv4()
        safeStorageSet(SETUP_SESSION_KEY, id)
        setSessionId(id)
        return id
    }

    function clearSessionId(): void {
        safeStorageRemove(SETUP_SESSION_KEY)
        setSessionId("")
    }

    return {
        sessionId,
        setSessionId: setAndPersistSessionId,
        resetSessionId,
        clearSessionId
    }
}
