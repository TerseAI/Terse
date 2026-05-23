import Conf from "conf"
import fs from "node:fs"

// User-level credential store backing `terse auth login`. Storage is delegated
// to `conf` (atomic writes, OS-correct paths via env-paths). Tokens are kept
// per-organization so `terse auth org switch` can flip locally without a
// round-trip once an org has been seen.

type OrgTokenEntry = {
    orgId: string
    orgName: string
    apiKey: string
}

type Schema = {
    // Legacy single-key field from before multi-org support. Read as a
    // fallback when no per-org entry exists yet. Cleared on the next
    // login/switch.
    apiKey?: string
    activeOrgId?: string
    tokensByOrg?: Record<string, OrgTokenEntry>
    completionAsked?: boolean
}

let _store: Conf<Schema> | null = null

function store(): Conf<Schema> {
    if (!_store) _store = new Conf<Schema>({ projectName: "terse" })
    return _store
}

export function getAuthFilePath(): string {
    return store().path
}

export function getStoredActiveOrgId(): string | null {
    const id = store().get("activeOrgId")
    return typeof id === "string" && id ? id : null
}

export function getStoredApiKeyForOrg(orgId: string): string | null {
    const entry = store().get("tokensByOrg")?.[orgId]
    return entry?.apiKey ?? null
}

export function getStoredApiKey(): string | null {
    const activeOrgId = getStoredActiveOrgId()
    if (activeOrgId) {
        const fromOrg = getStoredApiKeyForOrg(activeOrgId)
        if (fromOrg) return fromOrg
    }
    const legacy = store().get("apiKey")
    return typeof legacy === "string" && legacy ? legacy : null
}

export function setActiveOrgToken(orgId: string, apiKey: string, orgName: string): void {
    const s = store()
    const tokens = { ...(s.get("tokensByOrg") ?? {}) }
    tokens[orgId] = { orgId, orgName, apiKey }
    s.set("tokensByOrg", tokens)
    s.set("activeOrgId", orgId)
    if (s.get("apiKey")) s.delete("apiKey")
}

// Cache a token for an org without changing which org is active. Used by
// `terse attach` when the user picks a different org for a project than the
// one they're currently using in the CLI.
export function cacheOrgToken(orgId: string, apiKey: string, orgName: string): void {
    const s = store()
    const tokens = { ...(s.get("tokensByOrg") ?? {}) }
    tokens[orgId] = { orgId, orgName, apiKey }
    s.set("tokensByOrg", tokens)
}

export function setActiveOrg(orgId: string): void {
    store().set("activeOrgId", orgId)
}

export function hasCompletionPromptBeenAsked(): boolean {
    return Boolean(store().get("completionAsked"))
}

export function markCompletionPromptAsked(): void {
    store().set("completionAsked", true)
}

// Returns true if any credentials were present before clearing. Removes the
// underlying file so `ls` on the config dir doesn't show a stale empty `{}`.
export function clearStoredApiKey(): boolean {
    const s = store()
    const hadAny = Boolean(s.get("apiKey")) || Object.keys(s.get("tokensByOrg") ?? {}).length > 0
    s.clear()
    try {
        fs.rmSync(s.path)
    } catch {
        // best-effort
    }
    return hadAny
}
