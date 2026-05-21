import logger from "../common/logger"
import { settings } from "../settings"

export function buildCorsAllowedOrigins(): Set<string> {
    const origins = new Set<string>()
    const add = (value: string | undefined | null) => {
        if (!value) return
        const origin = normalizeToOrigin(value)
        if (origin) {
            origins.add(origin)
        } else if (value.trim()) {
            logger.warn("[CORS] Ignoring invalid URL for allowlist", { value })
        }
    }

    add(settings.urls.frontend)
    add(settings.urls.socketFrontend)
    add(settings.urls.backendProxy)

    const extra = settings.optional.corsAllowedOrigins
    if (extra) {
        for (const part of extra.split(",")) {
            add(part)
        }
    }

    if (settings.nodeEnv === "development") {
        add("http://localhost:5173")
        add("http://127.0.0.1:5173")
        add("http://localhost:3000")
        add("http://127.0.0.1:3000")
        add(settings.urls.backend)
    }

    return origins
}

export function isCorsOriginAllowed(origin: string | undefined, allowedOrigins: Set<string>): boolean {
    if (!origin) return true
    const normalizedOrigin = normalizeToOrigin(origin)
    return normalizedOrigin !== null && allowedOrigins.has(normalizedOrigin)
}

function normalizeToOrigin(raw: string): string | null {
    const trimmed = raw.trim()
    if (!trimmed || !URL.canParse(trimmed)) return null
    return new URL(trimmed).origin
}
