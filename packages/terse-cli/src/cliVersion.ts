import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

let cached: string | undefined

/** Semver from `packages/terse-cli/package.json` (installed CLI). */
export function getCliVersion(): string {
    if (cached !== undefined) return cached

    const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url))
    const { version } = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string }
    cached = version
    return version
}

/**
 * Returns the local-package hoist marker baked into the CLI install during dev (TERSE_DEV_LOCAL_PACKAGES),
 * or null on a normal registry install. Lets a run confirm in its output that it ran the local build.
 */
export function getLocalHoistMarker(): string | null {
    try {
        const markerPath = fileURLToPath(new URL("../.terse-local-hoist", import.meta.url))
        return readFileSync(markerPath, "utf8").trim() || null
    } catch {
        return null
    }
}
