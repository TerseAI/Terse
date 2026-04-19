import Conf from "conf"
import fs from "node:fs"

// User-level credential store backing `terse login`. Replaces the historical
// project `.env` write. Storage is delegated to `conf` (atomic writes,
// OS-correct paths via env-paths).

type Schema = {
    apiKey?: string
}

let _store: Conf<Schema> | null = null

function store(): Conf<Schema> {
    if (!_store) _store = new Conf<Schema>({ projectName: "terse" })
    return _store
}

export function getAuthFilePath(): string {
    return store().path
}

export function getStoredApiKey(): string | null {
    const key = store().get("apiKey")
    return typeof key === "string" && key ? key : null
}

export function setStoredApiKey(apiKey: string): void {
    store().set("apiKey", apiKey)
}

// Returns true if a key was present before clearing. Removes the underlying
// file so `ls` on the config dir doesn't show a stale empty `{}`.
export function clearStoredApiKey(): boolean {
    const hadKey = !!store().get("apiKey")
    store().clear()
    try {
        fs.rmSync(store().path)
    } catch {
        // best-effort
    }
    return hadKey
}
