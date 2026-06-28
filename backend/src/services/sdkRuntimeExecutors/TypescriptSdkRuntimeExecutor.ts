import crypto from "crypto"

import type { LocalPackagesBundle } from "../../utility/localPackages"

import type {
    SandboxCommandResult,
    SdkDependencyImageBuildContext,
    SdkDependencyImageDefinition,
    SdkProjectArchive,
    SdkRuntimeExecutor,
    SdkRuntimeExecutorContext,
    SdkSourceImageBuildContext
} from "./types"
import { buildLocalDependencyInstallCommand, installLocalCli, withTerseOverrides, writeHoistMarker, writeLocalTarballs } from "./typescriptLocalPackages"

const DEFAULT_PNPM_VERSION = "10.34.1"

export class TypescriptSdkRuntimeExecutor implements SdkRuntimeExecutor {
    readonly runtime = "typescript" as const
    readonly sandboxImage = "node:22.22.3-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732"

    matchesArchive(entries: Set<string>): boolean {
        return entries.has("package.json")
    }

    defineDependencyImage(archive: SdkProjectArchive, cliVersion: string, localPackages?: LocalPackagesBundle): SdkDependencyImageDefinition {
        const packageManager = this.detectPackageManager(archive)
        const relevantFiles = ["package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]
        const hashPayload = {
            version: 3,
            runtime: this.runtime,
            baseImage: this.sandboxImage,
            packageManager,
            terseCliSpec: `terse-cli@${cliVersion}`,
            localPackages: localPackages?.contentHash,
            files: Object.fromEntries(relevantFiles.filter(path => archive.has(path)).map(path => [path, archive.readText(path)]))
        }

        return {
            dependencyHash: crypto.createHash("sha256").update(JSON.stringify(hashPayload)).digest("hex")
        }
    }

    async buildDependencyImage(context: SdkDependencyImageBuildContext): Promise<void> {
        const templateDir = context.escapeShellArg(context.templateDir)
        const cliCachePath = context.escapeShellArg(context.cliCachePath)
        const packageJson = context.archive.readText("package.json")
        if (!packageJson) {
            throw new Error("package.json is required to build the TypeScript sandbox image")
        }

        const packageManager = this.detectPackageManager(context.archive)

        await context.ensureSandboxCommand("prepare TypeScript image filesystem", `mkdir -p ${templateDir} ${cliCachePath}`)

        // Dev-only: hoist the dev's locally-built SDK/CLI into the sandbox instead of the npm registry.
        const localPackages = context.localPackages
        let localTarballs: Map<string, string> | undefined
        if (localPackages) {
            localTarballs = await writeLocalTarballs(context, localPackages)
            await context.writeFile(`${context.templateDir}/package.json`, withTerseOverrides(packageJson, localTarballs, packageManager))
        } else {
            await context.writeFile(`${context.templateDir}/package.json`, packageJson)
        }
        // === end dev-only ===

        for (const path of ["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]) {
            const content = context.archive.readText(path)
            if (content) {
                await context.writeFile(`${context.templateDir}/${path}`, content)
            }
        }

        if (localPackages && localTarballs) {
            await installLocalCli(context, localTarballs)
            await writeHoistMarker(context, localPackages)
        } else {
            await context.ensureSandboxCommand("install terse cli", `npm install -g --prefix ${cliCachePath} ${context.escapeShellArg(`terse-cli@${context.cliVersion}`)} --no-fund >/dev/null`)
        }

        if (packageManager === "pnpm") {
            const pnpmVersion = this.detectPnpmVersion(context.archive)
            // --force: overwrite any pre-existing pnpm shim (e.g. corepack's at
            // /usr/local/bin/pnpm in the self-host image), which npm otherwise EEXISTs on.
            await context.ensureSandboxCommand("install pnpm", `npm install -g ${context.escapeShellArg(`pnpm@${pnpmVersion}`)} --no-fund --force >/dev/null`)
        }
        const installCommand = localTarballs
            ? buildLocalDependencyInstallCommand(packageManager, context.templateDir, context.escapeShellArg)
            : this.buildDependencyInstallCommand(context.archive, context.templateDir, context.escapeShellArg)
        await context.ensureSandboxCommand("install cached TypeScript dependencies", installCommand)
    }

    async prepareSourceImage(context: SdkSourceImageBuildContext): Promise<void> {
        await context.ensureSandboxCommand(
            "copy cached node_modules",
            `rm -rf ${context.escapeShellArg(`${context.projectDir}/node_modules`)} && cp -R ${context.escapeShellArg(`${context.templateDir}/node_modules`)} ${context.escapeShellArg(`${context.projectDir}/node_modules`)}`
        )
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        const cliBin = `${context.escapeShellArg(context.cliCachePath)}/bin/terse`
        const runCmd = `cd ${context.projectDir} && ${cliBin} run ${context.escapeShellArg(context.jobName)} --no-verbose`

        if (context.usesPrebuiltImage) {
            return context.runSandboxCommandStreaming("terse run", runCmd)
        }

        await context.ensureSandboxCommand("npm install", `cd ${context.projectDir} && npm install --omit=dev --no-fund`)
        await context.ensureSandboxCommand(
            "npm install terse-cli",
            `mkdir -p ${context.escapeShellArg(context.cliCachePath)} && npm install -g --prefix ${context.escapeShellArg(context.cliCachePath)} ${context.escapeShellArg(`terse-cli@${context.cliVersion}`)} --no-fund`
        )

        return context.runSandboxCommandStreaming("terse run", runCmd)
    }

    private detectPackageManager(archive: SdkProjectArchive): "npm" | "pnpm" {
        if (archive.has("pnpm-lock.yaml")) {
            return "pnpm"
        }

        const packageJson = archive.readText("package.json")
        if (!packageJson) {
            return "npm"
        }

        try {
            const parsed = JSON.parse(packageJson) as { packageManager?: string }
            if (parsed.packageManager?.startsWith("pnpm@")) {
                return "pnpm"
            }
        } catch {
            // Ignore malformed package.json here; the install step will surface it.
        }

        return "npm"
    }

    private detectPnpmVersion(archive: SdkProjectArchive): string {
        const packageJson = archive.readText("package.json")
        if (!packageJson) {
            return DEFAULT_PNPM_VERSION
        }

        try {
            const parsed = JSON.parse(packageJson) as { packageManager?: string }
            const pinned = parsed.packageManager
            if (pinned?.startsWith("pnpm@")) {
                const version = pinned.slice("pnpm@".length).split("+")[0].trim()
                if (version) {
                    return version
                }
            }
        } catch {
            // Ignore malformed package.json here; the install step will surface it.
        }

        return DEFAULT_PNPM_VERSION
    }

    private buildDependencyInstallCommand(archive: SdkProjectArchive, templateDir: string, escapeShellArg: (value: string) => string): string {
        const escapedTemplateDir = escapeShellArg(templateDir)
        const packageManager = this.detectPackageManager(archive)

        if (packageManager === "pnpm") {
            const frozen = archive.has("pnpm-lock.yaml") ? "--frozen-lockfile" : "--no-frozen-lockfile"
            return `cd ${escapedTemplateDir} && pnpm install --prod ${frozen}`
        }

        if (archive.has("package-lock.json") || archive.has("npm-shrinkwrap.json")) {
            return `cd ${escapedTemplateDir} && npm ci --omit=dev --no-fund`
        }

        return `cd ${escapedTemplateDir} && npm install --omit=dev --no-fund`
    }
}
