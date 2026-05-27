import crypto from "crypto"

import type {
    SandboxCommandResult,
    SdkDependencyImageBuildContext,
    SdkDependencyImageDefinition,
    SdkProjectArchive,
    SdkRuntimeExecutor,
    SdkRuntimeExecutorContext,
    SdkSourceImageBuildContext
} from "./types"
import { SandboxStage, runSandboxExecStage, runSandboxStage } from "./types"

export class TypescriptSdkRuntimeExecutor implements SdkRuntimeExecutor {
    readonly runtime = "typescript" as const
    readonly sandboxImage = "node:22-slim"

    matchesArchive(entries: Set<string>): boolean {
        return entries.has("package.json")
    }

    defineDependencyImage(archive: SdkProjectArchive, cliVersion: string): SdkDependencyImageDefinition {
        const packageManager = this.detectPackageManager(archive)
        const relevantFiles = ["package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]
        const hashPayload = {
            version: 3,
            runtime: this.runtime,
            baseImage: this.sandboxImage,
            packageManager,
            terseCliSpec: `terse-cli@${cliVersion}`,
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

        await context.ensureSandboxCommand("prepare TypeScript image filesystem", `mkdir -p ${templateDir} ${cliCachePath}`)

        await context.writeFile(`${context.templateDir}/package.json`, packageJson)

        for (const path of ["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]) {
            const content = context.archive.readText(path)
            if (content) {
                await context.writeFile(`${context.templateDir}/${path}`, content)
            }
        }

        // Install into a prefix inside the sandbox working dir so the CLI is captured in the snapshotted image.
        // A global (-g without --prefix) install lands in /usr/local, which the local sandbox provider does not snapshot,
        // so the binary would disappear when the backend container is recreated (e.g. docker-compose down/up).
        await context.ensureSandboxCommand("install terse cli", `npm install -g --prefix ${cliCachePath} ${context.escapeShellArg(`terse-cli@${context.cliVersion}`)} --no-fund >/dev/null`)
        await context.ensureSandboxCommand("install cached TypeScript dependencies", this.buildDependencyInstallCommand(context.archive, context.templateDir, context.escapeShellArg))
    }

    async prepareSourceImage(context: SdkSourceImageBuildContext): Promise<void> {
        await context.ensureSandboxCommand(
            "copy cached node_modules",
            `rm -rf ${context.escapeShellArg(`${context.projectDir}/node_modules`)} && cp -R ${context.escapeShellArg(`${context.templateDir}/node_modules`)} ${context.escapeShellArg(`${context.projectDir}/node_modules`)}`
        )
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        const cliBin = `${context.escapeShellArg(context.cliCachePath)}/bin/terse`

        if (context.usesPrebuiltImage) {
            return runSandboxExecStage(context, () =>
                context.runSandboxCommandStreaming("terse run", `cd ${context.projectDir} && ${cliBin} run ${context.escapeShellArg(context.jobName)} --no-verbose`)
            )
        }

        await runSandboxStage(context, SandboxStage.INSTALLING_DEPENDENCIES, () => context.ensureSandboxCommand("npm install", `cd ${context.projectDir} && npm install --omit=dev --no-fund`))

        await runSandboxStage(context, SandboxStage.INSTALLING_CLI, () =>
            context.ensureSandboxCommand(
                "npm install terse-cli",
                `mkdir -p ${context.escapeShellArg(context.cliCachePath)} && npm install -g --prefix ${context.escapeShellArg(context.cliCachePath)} ${context.escapeShellArg(`terse-cli@${context.cliVersion}`)} --no-fund`
            )
        )

        return runSandboxExecStage(context, () => context.runSandboxCommandStreaming("terse run", `cd ${context.projectDir} && ${cliBin} run ${context.escapeShellArg(context.jobName)} --no-verbose`))
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

    private buildDependencyInstallCommand(archive: SdkProjectArchive, templateDir: string, escapeShellArg: (value: string) => string): string {
        const escapedTemplateDir = escapeShellArg(templateDir)
        const packageManager = this.detectPackageManager(archive)

        if (packageManager === "pnpm") {
            const frozen = archive.has("pnpm-lock.yaml") ? "--frozen-lockfile" : "--no-frozen-lockfile"
            return `corepack enable >/dev/null && cd ${escapedTemplateDir} && pnpm install --prod ${frozen}`
        }

        if (archive.has("package-lock.json") || archive.has("npm-shrinkwrap.json")) {
            return `cd ${escapedTemplateDir} && npm ci --omit=dev --no-fund`
        }

        return `cd ${escapedTemplateDir} && npm install --omit=dev --no-fund`
    }
}
