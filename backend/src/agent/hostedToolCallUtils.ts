type HostedToolCallLike = {
    name?: unknown
    id?: unknown
    callId?: unknown
    arguments?: unknown
    output?: unknown
    providerData?: unknown
}

const WEB_SEARCH_ACTION_TYPES = new Set(["search", "open_page"])

export function resolveHostedToolCallStepId(item: HostedToolCallLike, fallback = "unknown"): string {
    const candidateIds = [item.id, item.callId, getProviderDataField(item.providerData, "id")]

    for (const candidate of candidateIds) {
        if (typeof candidate !== "string") continue
        const normalized = candidate.trim()
        if (normalized) {
            return normalized
        }
    }

    return fallback
}

export function stringifyHostedToolCallResult(item: HostedToolCallLike): string | undefined {
    const action = extractHostedToolCallAction(item)
    return action ? JSON.stringify(action) : undefined
}

function extractHostedToolCallAction(item: HostedToolCallLike): Record<string, unknown> | undefined {
    if (item.name !== "web_search_call") {
        return undefined
    }

    const providerData = asRecord(item.providerData)
    const candidates = [providerData?.action, item.output, providerData?.output]

    for (const candidate of candidates) {
        const action = normalizeHostedToolAction(candidate)
        if (action) {
            return action
        }
    }

    return undefined
}

function normalizeHostedToolAction(value: unknown): Record<string, unknown> | undefined {
    if (typeof value === "string") {
        const trimmedValue = value.trim()
        if (!trimmedValue) {
            return undefined
        }

        try {
            return normalizeHostedToolAction(JSON.parse(trimmedValue))
        } catch {
            return undefined
        }
    }

    const record = asRecord(value)
    if (!record) {
        return undefined
    }

    const nestedAction = normalizeHostedToolAction(record.action)
    if (nestedAction) {
        return nestedAction
    }

    const actionType = record.type
    if (typeof actionType === "string" && WEB_SEARCH_ACTION_TYPES.has(actionType)) {
        return record
    }

    return undefined
}

function getProviderDataField(providerData: unknown, key: string): unknown {
    const record = asRecord(providerData)
    return record?.[key]
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined
}
