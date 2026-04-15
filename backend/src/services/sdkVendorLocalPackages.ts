import { execFile as execFileCallback } from "node:child_process"
import fs from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFile = promisify(execFileCallback)

export interface PackedLocalModalVendorTarballs {
    typesTgzPath: string
    sdkTgzPath: string
    cliTgzPath: string
    packDir: string
}

/** Default: three levels up from `backend/src/services/` → repo root */
export function resolveTerseMonorepoRoot(explicitRoot: string | undefined): string {
    if (explicitRoot?.trim()) {
        return path.resolve(explicitRoot.trim())
    }
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
}

/**
 * Runs `pnpm pack` for terse-types, terse-sdk, and terse-cli into a new temp directory (dependency order).
 * Caller must remove `packDir` when finished (e.g. after uploading to Modal).
 */
export async function packLocalSdkCliForVendor(monorepoRoot: string): Promise<PackedLocalModalVendorTarballs> {
    const packDir = await fs.mkdtemp(path.join(tmpdir(), "terse-vendor-"))
    try {
        for (const filter of ["terse-types", "terse-sdk", "terse-cli"] as const) {
            await execFile("pnpm", ["pack", "--filter", filter, "--pack-destination", packDir], {
                cwd: monorepoRoot,
                maxBuffer: 20 * 1024 * 1024
            })
        }
    } catch (err) {
        await fs.rm(packDir, { recursive: true, force: true }).catch(() => {})
        throw err
    }

    const entries = await fs.readdir(packDir)
    const tgzs = entries.filter(f => f.endsWith(".tgz"))
    const typesName = tgzs.find(f => f.startsWith("terse-types-"))
    const sdkName = tgzs.find(f => f.startsWith("terse-sdk-"))
    const cliName = tgzs.find(f => f.startsWith("terse-cli-"))
    if (!typesName || !sdkName || !cliName) {
        await fs.rm(packDir, { recursive: true, force: true }).catch(() => {})
        throw new Error(`Expected terse-types-*.tgz, terse-sdk-*.tgz, and terse-cli-*.tgz in pack dir, found: ${tgzs.join(", ") || "(none)"}`)
    }

    return {
        typesTgzPath: path.join(packDir, typesName),
        sdkTgzPath: path.join(packDir, sdkName),
        cliTgzPath: path.join(packDir, cliName),
        packDir
    }
}

export async function removeModalVendorPackDir(packDir: string): Promise<void> {
    await fs.rm(packDir, { recursive: true, force: true })
}
