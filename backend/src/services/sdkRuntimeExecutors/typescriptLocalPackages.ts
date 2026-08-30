import type { LocalPackagesBundle } from "../../utility/localPackages"

import type { SdkDeployImageBuildContext } from "./types"

export type PackageManager = "npm" | "pnpm"

// Dev-only (TERSE_DEV_LOCAL_PACKAGES) helpers that hoist the dev's locally-built Terse packages into
// the sandbox instead of installing from the npm registry. Kept out of the executor so the registry
// install path stays clean and self-contained.

// Writes the packed tarballs into the sandbox and returns name -> absolute sandbox path.
export async function writeLocalTarballs(context: SdkDeployImageBuildContext, localPackages: LocalPackagesBundle): Promise<Map<string, string>> {
    const tarballDir = `${context.cliCachePath}/local-packages`
    await context.ensureSandboxCommand("building_project", `mkdir -p ${context.escapeShellArg(tarballDir)}`)

    const paths = new Map<string, string>()
    for (const pkg of localPackages.packages) {
        const tarballPath = `${tarballDir}/${pkg.fileName}`
        await context.writeBinaryFile(tarballPath, pkg.tarball)
        paths.set(pkg.name, tarballPath)
    }
    return paths
}

// Points the user project's Terse dependencies at the local tarballs. With the dev flags on, versions
// in the project's package.json are ignored in favor of the local build.
export function withTerseOverrides(packageJsonText: string, tarballs: Map<string, string>, packageManager: PackageManager): string {
    type DepRecord = Record<string, string>
    const pkg = JSON.parse(packageJsonText) as {
        dependencies?: DepRecord
        devDependencies?: DepRecord
        optionalDependencies?: DepRecord
        overrides?: DepRecord
        pnpm?: { overrides?: DepRecord }
        [key: string]: unknown
    }

    const targets = ["@terse/durable", "terse-sdk", "terse-types"] as const
    const depSections = ["dependencies", "devDependencies", "optionalDependencies"] as const

    const directlyPinned = new Set<string>()
    for (const section of depSections) {
        const deps = pkg[section]
        if (!deps) continue
        for (const name of targets) {
            const tarballPath = tarballs.get(name)
            if (tarballPath && name in deps) {
                deps[name] = `file:${tarballPath}`
                directlyPinned.add(name)
            }
        }
    }

    const overrides: DepRecord = {}
    for (const name of targets) {
        const tarballPath = tarballs.get(name)
        if (tarballPath && (packageManager === "pnpm" || !directlyPinned.has(name))) {
            overrides[name] = `file:${tarballPath}`
        }
    }

    if (Object.keys(overrides).length > 0) {
        if (packageManager === "pnpm") {
            pkg.pnpm = { ...pkg.pnpm, overrides: { ...pkg.pnpm?.overrides, ...overrides } }
        } else {
            pkg.overrides = { ...pkg.overrides, ...overrides }
        }
    }
    return JSON.stringify(pkg, null, 2)
}

// Installs the CLI from its local tarball into a host project so npm `overrides` apply to its nested
// @terse/durable/terse-sdk/terse-types (global `npm install -g` ignores overrides). Symlinks the bin to the same
// `${cliCachePath}/bin/terse` path the registry install and execute() already expect.
export async function installLocalCli(context: SdkDeployImageBuildContext, tarballs: Map<string, string>): Promise<void> {
    const cliTarball = tarballs.get("terse-cli")
    const durableTarball = tarballs.get("@terse/durable")
    const sdkTarball = tarballs.get("terse-sdk")
    const typesTarball = tarballs.get("terse-types")
    if (!cliTarball || !durableTarball || !sdkTarball || !typesTarball) {
        throw new Error("Local packages bundle is missing @terse/durable, terse-cli, terse-sdk, or terse-types")
    }

    const hostPackageJson = {
        name: "terse-cli-local-host",
        private: true,
        dependencies: { "terse-cli": `file:${cliTarball}` },
        overrides: { "@terse/durable": `file:${durableTarball}`, "terse-sdk": `file:${sdkTarball}`, "terse-types": `file:${typesTarball}` }
    }
    await context.writeFile(`${context.cliCachePath}/package.json`, JSON.stringify(hostPackageJson, null, 2))

    const cliCachePath = context.escapeShellArg(context.cliCachePath)
    const binDir = context.escapeShellArg(`${context.cliCachePath}/bin`)
    const installedBin = context.escapeShellArg(`${context.cliCachePath}/node_modules/.bin/terse`)
    const linkedBin = context.escapeShellArg(`${context.cliCachePath}/bin/terse`)
    await context.ensureSandboxCommand("building_project", `cd ${cliCachePath} && npm install --no-fund && mkdir -p ${binDir} && ln -sf ${installedBin} ${linkedBin}`)
}

// Bakes a marker into the installed CLI recording the hoisted versions + content hash. The CLI reads
// it (relative to its own install) at run time to confirm in the run output that the local build ran.
// Living in the image makes it authoritative: it travels with the image, unlike a runtime env flag.
export async function writeHoistMarker(context: SdkDeployImageBuildContext, localPackages: LocalPackagesBundle): Promise<void> {
    const markerPath = `${context.cliCachePath}/node_modules/terse-cli/.terse-local-hoist`
    const versions = localPackages.packages.map(p => `${p.name}@${p.version}`).join(", ")
    await context.writeFile(markerPath, `${versions} (${localPackages.contentHash.slice(0, 12)})`)
}

// Local installs inject overrides that desync the lockfile, so a frozen install (pnpm --frozen-lockfile
// / npm ci) would fail. Always do a regular install that can update the lockfile.
export function buildLocalDependencyInstallCommand(packageManager: PackageManager, projectDir: string, escapeShellArg: (value: string) => string): string {
    const escapedProjectDir = escapeShellArg(projectDir)

    if (packageManager === "pnpm") {
        return `cd ${escapedProjectDir} && pnpm install --prod --no-frozen-lockfile --config.confirmModulesPurge=false`
    }

    return `cd ${escapedProjectDir} && npm install --omit=dev --no-fund`
}
