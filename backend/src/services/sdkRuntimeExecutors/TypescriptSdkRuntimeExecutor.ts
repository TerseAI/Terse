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
            version: 2,
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
        const packageJson = context.archive.readText("package.json")
        if (!packageJson) {
            throw new Error("package.json is required to build the TypeScript sandbox image")
        }

        await context.ensureSandboxCommand(
            "prepare TypeScript image filesystem",
            `export DEBIAN_FRONTEND=noninteractive && apt-get update -qq && apt-get install -y -qq unzip >/dev/null && mkdir -p ${templateDir}`
        )

        await context.writeFile(`${context.templateDir}/package.json`, packageJson)

        for (const path of ["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]) {
            const content = context.archive.readText(path)
            if (content) {
                await context.writeFile(`${context.templateDir}/${path}`, content)
            }
        }

        await context.ensureSandboxCommand("install terse cli", `npm install -g ${context.escapeShellArg(`terse-cli@${context.cliVersion}`)} --no-fund >/dev/null`)
        await context.ensureSandboxCommand("install cached TypeScript dependencies", this.buildDependencyInstallCommand(context.archive, context.templateDir, context.escapeShellArg))
    }

    async prepareSourceImage(context: SdkSourceImageBuildContext): Promise<void> {
        await context.ensureSandboxCommand(
            "copy cached node_modules",
            `rm -rf ${context.escapeShellArg(`${context.projectDir}/node_modules`)} && cp -R ${context.escapeShellArg(`${this.getTemplateDir()}/node_modules`)} ${context.escapeShellArg(`${context.projectDir}/node_modules`)}`
        )
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        if (context.usesPrebuiltImage) {
            return runSandboxExecStage(context, () => context.runSandboxCommandStreaming("terse run", `cd ${context.projectDir} && npx terse run ${context.escapeShellArg(context.jobName)} --no-verbose`))
        }

        await runSandboxStage(context, SandboxStage.INSTALLING_DEPENDENCIES, () => context.ensureSandboxCommand("npm install", `cd ${context.projectDir} && npm install --omit=dev --no-fund`))

        await runSandboxStage(context, SandboxStage.INSTALLING_CLI, () =>
            context.ensureSandboxCommand("npm install terse-cli", `cd ${context.projectDir} && ${context.escapeShellArg(`terse-cli@${context.cliVersion}`)} --no-fund`)
        )

        return runSandboxExecStage(context, () => context.runSandboxCommandStreaming("terse run", `cd ${context.projectDir} && npx terse run ${context.escapeShellArg(context.jobName)} --no-verbose`))
    }

    private getTemplateDir(): string {
        return "/opt/terse-sdk-cache/typescript/project"
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
