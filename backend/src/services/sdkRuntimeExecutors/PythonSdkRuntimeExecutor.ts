import type { SandboxCommandResult, SdkRuntimeExecutor, SdkRuntimeExecutorContext } from "./types"
import { SandboxStage, runSandboxExecStage, runSandboxStage } from "./types"

export class PythonSdkRuntimeExecutor implements SdkRuntimeExecutor {
    readonly runtime = "python" as const
    readonly sandboxImage = "node:22-slim"

    matchesArchive(entries: Set<string>): boolean {
        return entries.has("pyproject.toml")
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        await runSandboxStage(context, SandboxStage.INSTALLING_DEPENDENCIES, async () => {
            await context.ensureSandboxCommand(
                "install python & uv",
                "apt-get update && apt-get install -y --no-install-recommends python3 python3-venv curl && curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh"
            )
            await context.ensureSandboxCommand("uv sync", `cd ${context.projectDir} && uv sync`)
        })

        await runSandboxStage(context, SandboxStage.INSTALLING_CLI, () =>
            context.ensureSandboxCommand("npm install terse-cli", `cd ${context.projectDir} && npm install terse-sdk@latest terse-cli@latest --no-fund`)
        )

        return runSandboxExecStage(context, () =>
            context.runSandboxCommandStreaming("terse run", `cd ${context.projectDir} && npx terse run ${context.escapeShellArg(context.jobName)} --event-file ${context.eventFilePath}`)
        )
    }
}
