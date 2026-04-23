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
