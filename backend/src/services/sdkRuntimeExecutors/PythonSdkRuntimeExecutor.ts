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

export class PythonSdkRuntimeExecutor implements SdkRuntimeExecutor {
    readonly runtime = "python" as const
    readonly sandboxImage = "node:22-slim"

    matchesArchive(entries: Set<string>): boolean {
        return entries.has("pyproject.toml")
    }

    defineDependencyImage(archive: SdkProjectArchive, cliVersion: string): SdkDependencyImageDefinition {
        const relevantFiles = ["pyproject.toml", "uv.lock", ".python-version"]
        const hashPayload = {
            version: 2,
            runtime: this.runtime,
            baseImage: this.sandboxImage,
            terseCliSpec: `terse-cli@${cliVersion}`,
            files: Object.fromEntries(relevantFiles.filter(path => archive.has(path)).map(path => [path, archive.readText(path)]))
        }

        return {
            dependencyHash: crypto.createHash("sha256").update(JSON.stringify(hashPayload)).digest("hex")
        }
    }

    async buildDependencyImage(context: SdkDependencyImageBuildContext): Promise<void> {
        const templateDir = context.escapeShellArg(context.templateDir)
        const pyproject = context.archive.readText("pyproject.toml")
        if (!pyproject) {
            throw new Error("pyproject.toml is required to build the Python sandbox image")
        }

        await context.ensureSandboxCommand(
            "prepare Python image filesystem",
            `export DEBIAN_FRONTEND=noninteractive && apt-get update -qq && apt-get install -y --no-install-recommends python3 python3-venv curl unzip >/dev/null && mkdir -p ${templateDir}`
        )

        await context.ensureSandboxCommand("install uv", "command -v uv >/dev/null || (curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh)")
        await context.ensureSandboxCommand(
            "install terse cli",
            `npm install -g ${context.escapeShellArg(`terse-cli@${context.cliVersion}`)} --no-fund >/dev/null`
        )

        await context.writeFile(`${context.templateDir}/pyproject.toml`, pyproject)

        for (const path of ["uv.lock", ".python-version"]) {
            const content = context.archive.readText(path)
            if (content) {
                await context.writeFile(`${context.templateDir}/${path}`, content)
            }
        }

        await context.ensureSandboxCommand("install cached Python dependencies", this.buildDependencyInstallCommand(context.archive, context.templateDir, context.escapeShellArg))
    }

    async prepareSourceImage(context: SdkSourceImageBuildContext): Promise<void> {
        await context.ensureSandboxCommand(
            "attach cached virtualenv",
            `rm -rf ${context.escapeShellArg(`${context.projectDir}/.venv`)} && ln -s ${context.escapeShellArg(`${this.getTemplateDir()}/.venv`)} ${context.escapeShellArg(`${context.projectDir}/.venv`)}`
        )
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        if (context.usesPrebuiltImage) {
            context.sandboxEnv.UV_NO_SYNC = "1"
            context.sandboxEnv.UV_PROJECT_ENVIRONMENT = `${context.projectDir}/.venv`

            return runSandboxExecStage(context, () => context.runSandboxCommandStreaming("terse run", `cd ${context.projectDir} && terse run ${context.escapeShellArg(context.jobName)}`))
        }

        await runSandboxStage(context, SandboxStage.INSTALLING_DEPENDENCIES, async () => {
            await context.ensureSandboxCommand(
                "install python & uv",
                "apt-get update && apt-get install -y --no-install-recommends python3 python3-venv curl && curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh"
            )
            await context.ensureSandboxCommand("uv sync", `cd ${context.projectDir} && uv sync`)
        })

        await runSandboxStage(context, SandboxStage.INSTALLING_CLI, () =>
            context.ensureSandboxCommand(
                "npm install terse-cli",
                `cd ${context.projectDir} && npm install ${context.escapeShellArg(`terse-sdk@${context.cliVersion}`)} ${context.escapeShellArg(`terse-cli@${context.cliVersion}`)} --no-fund`
            )
        )

        return runSandboxExecStage(context, () => context.runSandboxCommandStreaming("terse run", `cd ${context.projectDir} && npx terse run ${context.escapeShellArg(context.jobName)}`))
    }

    private getTemplateDir(): string {
        return "/opt/terse-sdk-cache/python/project"
    }

    private buildDependencyInstallCommand(archive: SdkProjectArchive, templateDir: string, escapeShellArg: (value: string) => string): string {
        const escapedTemplateDir = escapeShellArg(templateDir)
        const frozen = archive.has("uv.lock") ? "--frozen " : ""
        return `cd ${escapedTemplateDir} && uv sync ${frozen}--no-dev --no-install-project`
    }
}
