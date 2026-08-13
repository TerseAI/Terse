import crypto from "crypto"

import logger from "../../common/logger"
import type { LocalPackagesBundle } from "../../utility/localPackages"

import type { DefineDeployImageParams, SandboxCommandResult, SdkDeployImageBuildContext, SdkDeployImageDefinition, SdkProjectArchive, SdkRuntimeExecutor, SdkRuntimeExecutorContext } from "./types"
import { type PackageManager, buildLocalDependencyInstallCommand, installLocalCli, withTerseOverrides, writeHoistMarker, writeLocalTarballs } from "./typescriptLocalPackages"

const DEFAULT_PNPM_VERSION = "10.34.1"
const CLI_VERSION_MARKER = ".terse-cli-version"
const PNPM_NON_INTERACTIVE = "--config.confirmModulesPurge=false"

export class TypescriptSdkRuntimeExecutor implements SdkRuntimeExecutor {
    readonly runtime = "typescript" as const
    readonly sandboxImage = "node:22.22.3-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732"
    readonly releaseImageName = "terse-sandbox-node"

    matchesArchive(entries: Set<string>): boolean {
        return entries.has("package.json")
    }

    defineDeployImage({ archive, organizationId, sourceHash, cliVersion, baseImage, localPackages }: DefineDeployImageParams): SdkDeployImageDefinition {
        const hashPayload = {
            version: 4,
            runtime: this.runtime,
            organizationId,
            sourceHash,
            baseImage: baseImage.reference,
            packageManager: this.detectPackageManager(archive),
            terseCliSpec: `terse-cli@${cliVersion}`,
            localPackages: localPackages?.contentHash
        }

        return {
            buildHash: crypto.createHash("sha256").update(JSON.stringify(hashPayload)).digest("hex")
        }
    }

    /**
     * One sandbox, one snapshot: the source is already unzipped into projectDir, so this installs
     * what the project needs and builds the workflow bundle.
     *
     * Everything the install requires goes in one command. Each sandbox exec is a round trip to
     * Modal, and the CLI check is usually just a file comparison against the baked version, so
     * paying a round trip to learn "already there" cost more than the check saved.
     */
    async buildDeployImage(context: SdkDeployImageBuildContext): Promise<void> {
        const packageJson = context.archive.readText("package.json")
        if (!packageJson) {
            throw new Error("package.json is required to build the TypeScript sandbox image")
        }

        const packageManager = this.detectPackageManager(context.archive)

        // Dev-only: hoist the dev's locally-built SDK/CLI into the sandbox instead of the npm registry.
        const localPackages = context.localPackages
        let localTarballs: Map<string, string> | undefined
        if (localPackages) {
            localTarballs = await writeLocalTarballs(context, localPackages)
            await context.writeFile(`${context.projectDir}/package.json`, withTerseOverrides(packageJson, localTarballs, packageManager))
            await installLocalCli(context, localTarballs)
            await writeHoistMarker(context, localPackages)
        }
        // === end dev-only ===

        // One exec: unpack, CLI, package manager, dependencies, bundle. Entering the sandbox costs a
        // round trip each time, and the container readiness gate is paid by whichever comes first.
        const install = [
            context.unpackCommand,
            localTarballs ? undefined : this.ensureCliCommand(context),
            this.ensurePackageManagerCommand(context, packageManager),
            localTarballs
                ? buildLocalDependencyInstallCommand(packageManager, context.projectDir, context.escapeShellArg)
                : this.buildDependencyInstallCommand(context.archive, context.projectDir, context.escapeShellArg)
        ].filter((command): command is string => command !== undefined)

        // Only the durable runtime reads .terse/wf; directJobRuntime calls the handler from source.
        if (context.requiresWorkflowBundle) {
            // Older CLIs lack `terse build`; they always ship a prebuilt .terse/wf inside the source zip.
            const cliBin = `${context.escapeShellArg(context.cliCachePath)}/bin/terse`
            install.push(`cd ${context.escapeShellArg(context.projectDir)} && { ${cliBin} build || [ -d .terse/wf ]; }`)
        } else {
            logger.info("SDK image build: no durable jobs, skipping the workflow bundle")
        }

        await context.ensureSandboxCommand("building_project", install.join(" && "))
    }

    /**
     * The sandbox image bakes whichever CLI was newest when it was built and records that version
     * beside it, so the skip is a file comparison rather than anything the control plane has to
     * know about the image. Any other version installs, warm, off the image's package cache.
     */
    private ensureCliCommand(context: SdkDeployImageBuildContext): string {
        const marker = context.escapeShellArg(`${context.cliCachePath}/${CLI_VERSION_MARKER}`)
        const wanted = context.escapeShellArg(context.cliVersion)
        const cliCachePath = context.escapeShellArg(context.cliCachePath)
        const install = `mkdir -p ${cliCachePath} && npm install -g --prefix ${cliCachePath} ${context.escapeShellArg(`terse-cli@${context.cliVersion}`)} --no-fund >/dev/null`

        return `if [ "$(cat ${marker} 2>/dev/null)" = ${wanted} ]; then echo "terse-cli ${context.cliVersion} already baked"; else ${install}; fi`
    }

    private ensurePackageManagerCommand(context: SdkDeployImageBuildContext, packageManager: PackageManager): string | undefined {
        if (packageManager !== "pnpm") return undefined

        const pnpmVersion = this.detectPnpmVersion(context.archive)
        if (context.baseImage.kind === "sandbox" && pnpmVersion === DEFAULT_PNPM_VERSION) {
            logger.info("SDK image build: reusing prebuilt pnpm", { pnpmVersion })
            return undefined
        }

        // --force: overwrite any pre-existing pnpm shim (e.g. corepack's at
        // /usr/local/bin/pnpm in the self-host image), which npm otherwise EEXISTs on.
        return `npm install -g ${context.escapeShellArg(`pnpm@${pnpmVersion}`)} --no-fund --force >/dev/null`
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        await this.ensureCliAvailable(context)
        const cliBin = `${context.escapeShellArg(context.cliCachePath)}/bin/terse`
        const runCmd = `cd ${context.projectDir} && ${cliBin} run ${context.escapeShellArg(context.jobName)} --no-verbose`
        return context.runSandboxCommandStreaming("terse run", runCmd)
    }

    async resume(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        await this.ensureCliAvailable(context)
        const cliBin = `${context.escapeShellArg(context.cliCachePath)}/bin/terse`
        const resumeCmd = `cd ${context.projectDir} && ${cliBin} resume --run-id ${context.escapeShellArg(context.runId)} --no-verbose`
        return context.runSandboxCommandStreaming("terse resume", resumeCmd)
    }

    private async ensureCliAvailable(context: SdkRuntimeExecutorContext): Promise<void> {
        if (context.usesPrebuiltImage) return
        await context.ensureSandboxCommand("npm install", `cd ${context.projectDir} && npm install --omit=dev --no-fund`)
        await context.ensureSandboxCommand(
            "npm install terse-cli",
            `mkdir -p ${context.escapeShellArg(context.cliCachePath)} && npm install -g --prefix ${context.escapeShellArg(context.cliCachePath)} ${context.escapeShellArg(`terse-cli@${context.cliVersion}`)} --no-fund`
        )
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

    private buildDependencyInstallCommand(archive: SdkProjectArchive, projectDir: string, escapeShellArg: (value: string) => string): string {
        const escapedProjectDir = escapeShellArg(projectDir)
        const packageManager = this.detectPackageManager(archive)

        if (packageManager === "pnpm") {
            const frozen = archive.has("pnpm-lock.yaml") ? "--frozen-lockfile" : "--no-frozen-lockfile"
            // A sandbox has no TTY, so pnpm aborts rather than prompt before clearing a
            // node_modules it did not create.
            return `cd ${escapedProjectDir} && pnpm install --prod ${frozen} ${PNPM_NON_INTERACTIVE}`
        }

        // The image bakes a pnpm-shaped node_modules, which npm cannot read: arborist fails on the
        // symlinked virtual store rather than replacing it. Clearing it costs a whiteout, and npm
        // was going to rebuild the tree from its own cache regardless.
        const clearPnpmTree = `rm -rf ${escapeShellArg(`${projectDir}/node_modules`)}`

        if (archive.has("package-lock.json") || archive.has("npm-shrinkwrap.json")) {
            return `${clearPnpmTree} && cd ${escapedProjectDir} && npm ci --omit=dev --no-fund`
        }

        return `${clearPnpmTree} && cd ${escapedProjectDir} && npm install --omit=dev --no-fund`
    }
}
