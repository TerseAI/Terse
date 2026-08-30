import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import logger from "../common/logger"
import { logProviderBanner } from "../common/providerBanner"

export interface LocalPackageTarball {
    name: string
    version: string
    fileName: string
    tarball: Buffer
}

export interface LocalPackagesBundle {
    packages: LocalPackageTarball[]
    contentHash: string
}

const LOCAL_PACKAGE_DIRS = ["terse-types", "packages/durable-runtime", "packages/terse-sdk", "packages/terse-cli"] as const

/**
 * Packs the local SDK/CLI workspace closure into npm tarballs so a dev's uncommitted
 * changes can be hoisted into sandboxes without publishing to the registry. `pnpm pack`
 * rewrites `workspace:*` specs to concrete versions exactly as `publish` would, and packs
 * reproducibly, so `contentHash` is stable until the built output actually changes.
 *
 * Dev-only — callers must gate on `settings.devLocalPackages` before invoking this.
 */
export function packLocalSdkPackages(monorepoRoot: string): LocalPackagesBundle {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), "terse-local-pkgs-"))
    try {
        const packages = LOCAL_PACKAGE_DIRS.map(rel => packOne(path.join(monorepoRoot, rel), dest))
        const contentHash = hashBundle(packages)
        // Loud, deliberate signal that local packages are being hoisted instead of the registry —
        // confirms the right build during dev, and is an alarm if it ever shows up in prod logs.
        logProviderBanner("local", "HOISTING LOCAL TERSE PACKAGES (TERSE_DEV_LOCAL_PACKAGES)", packages.map(p => `${p.name}@${p.version}`).join(", "))
        logger.info("Packed local SDK packages for sandbox hoist", { monorepoRoot, contentHash })
        return { packages, contentHash }
    } finally {
        fs.rmSync(dest, { recursive: true, force: true })
    }
}

function packOne(packageDir: string, dest: string): LocalPackageTarball {
    const pkgJsonPath = path.join(packageDir, "package.json")
    if (!fs.existsSync(pkgJsonPath)) {
        throw new Error(`Local package not found at ${packageDir}. Check TERSE_LOCAL_PACKAGES_ROOT points at a monorepo checkout.`)
    }
    if (!fs.existsSync(path.join(packageDir, "dist"))) {
        throw new Error(`Local package ${packageDir} has no dist/. Build the workspace first (e.g. \`pnpm -r build\`) before deploying with TERSE_DEV_LOCAL_PACKAGES.`)
    }

    const { name, version } = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")) as { name: string; version: string }

    const before = new Set(fs.readdirSync(dest))
    execFileSync("pnpm", ["pack", "--pack-destination", dest], { cwd: packageDir, stdio: ["ignore", "ignore", "inherit"] })
    const fileName = fs.readdirSync(dest).find(f => f.endsWith(".tgz") && !before.has(f))
    if (!fileName) {
        throw new Error(`pnpm pack produced no tarball for ${name} (${packageDir})`)
    }

    return { name, version, fileName, tarball: fs.readFileSync(path.join(dest, fileName)) }
}

function hashBundle(packages: LocalPackageTarball[]): string {
    const hash = crypto.createHash("sha256")
    for (const pkg of packages) {
        hash.update(`${pkg.name}@${pkg.version}`)
        hash.update(pkg.tarball)
    }
    return hash.digest("hex")
}
