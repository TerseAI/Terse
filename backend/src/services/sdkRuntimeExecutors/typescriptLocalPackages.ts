import type { LocalPackagesBundle } from "../../utility/localPackages"

import type { SdkDependencyImageBuildContext } from "./types"

export type PackageManager = "npm" | "pnpm"

// Dev-only (TERSE_DEV_LOCAL_PACKAGES) helpers that hoist a dev's locally-built terse-types/terse-sdk/
// terse-cli into the sandbox instead of installing from the npm registry. Kept out of the executor so
// the registry install path stays clean and self-contained.

// Writes the packed tarballs into the sandbox and returns name -> absolute sandbox path.
export async function writeLocalTarballs(context: SdkDependencyImageBuildContext, localPackages: LocalPackagesBundle): Promise<Map<string, string>> {
    const tarballDir = `${context.cliCachePath}/local-packages`
    await context.ensureSandboxCommand("prepare local package dir", `mkdir -p ${context.escapeShellArg(tarballDir)}`)

    const paths = new Map<string, string>()
    for (const pkg of localPackages.packages) {
        const tarballPath = `${tarballDir}/${pkg.fileName}`
        await context.writeBinaryFile(tarballPath, pkg.tarball)
        paths.set(pkg.name, tarballPath)
    }
    return paths
}

// Pins terse-sdk/terse-types in the user project to the local tarballs via overrides, so the
// project's transitive SDK resolves local. pnpm reads `pnpm.overrides`; npm reads `overrides`.
export function withTerseOverrides(packageJsonText: string, tarballs: Map<string, string>, packageManager: PackageManager): string {
    const pkg = JSON.parse(packageJsonText) as Record<string, unknown> & { pnpm?: { overrides?: Record<string, string> }; overrides?: Record<string, string> }

    const overrides: Record<string, string> = {}
    for (const name of ["terse-sdk", "terse-types"]) {
        const tarballPath = tarballs.get(name)
        if (tarballPath) {
            overrides[name] = `file:${tarballPath}`
        }
    }

    if (packageManager === "pnpm") {
        pkg.pnpm = { ...pkg.pnpm, overrides: { ...pkg.pnpm?.overrides, ...overrides } }
    } else {
        pkg.overrides = { ...pkg.overrides, ...overrides }
    }
    return JSON.stringify(pkg, null, 2)
}

// Installs the CLI from its local tarball into a host project so npm `overrides` apply to its nested
// terse-sdk/terse-types (global `npm install -g` ignores overrides). Symlinks the bin to the same
// `${cliCachePath}/bin/terse` path the registry install and execute() already expect.
export async function installLocalCli(context: SdkDependencyImageBuildContext, tarballs: Map<string, string>): Promise<void> {
    const cliTarball = tarballs.get("terse-cli")
    const sdkTarball = tarballs.get("terse-sdk")
    const typesTarball = tarballs.get("terse-types")
    if (!cliTarball || !sdkTarball || !typesTarball) {
        throw new Error("Local packages bundle is missing terse-cli, terse-sdk, or terse-types")
    }

    const hostPackageJson = {
        name: "terse-cli-local-host",
        private: true,
        dependencies: { "terse-cli": `file:${cliTarball}` },
        overrides: { "terse-sdk": `file:${sdkTarball}`, "terse-types": `file:${typesTarball}` }
    }
    await context.writeFile(`${context.cliCachePath}/package.json`, JSON.stringify(hostPackageJson, null, 2))

    const cliCachePath = context.escapeShellArg(context.cliCachePath)
    const binDir = context.escapeShellArg(`${context.cliCachePath}/bin`)
    const installedBin = context.escapeShellArg(`${context.cliCachePath}/node_modules/.bin/terse`)
    const linkedBin = context.escapeShellArg(`${context.cliCachePath}/bin/terse`)
    await context.ensureSandboxCommand("install local terse cli", `cd ${cliCachePath} && npm install --no-fund && mkdir -p ${binDir} && ln -sf ${installedBin} ${linkedBin}`)
}

// Local installs inject overrides that desync the lockfile, so a frozen install (pnpm --frozen-lockfile
// / npm ci) would fail. Always do a regular install that can update the lockfile.
export function buildLocalDependencyInstallCommand(packageManager: PackageManager, templateDir: string, escapeShellArg: (value: string) => string): string {
    const escapedTemplateDir = escapeShellArg(templateDir)

    if (packageManager === "pnpm") {
        return `cd ${escapedTemplateDir} && pnpm install --prod --no-frozen-lockfile`
    }

    return `cd ${escapedTemplateDir} && npm install --omit=dev --no-fund`
}
