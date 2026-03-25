import type { SandboxCommandResult, SdkRuntimeExecutor, SdkRuntimeExecutorContext } from "./types"

export class PythonSdkRuntimeExecutor implements SdkRuntimeExecutor {
    readonly runtime = "python" as const
    readonly sandboxImage = "python:3.11-slim"
    readonly detectionEntries = ["pyproject.toml"] as const

    matchesArchive(entries: Set<string>): boolean {
        return entries.has("pyproject.toml")
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        await context.ensureSandboxCommand("install uv", "python -m pip install --no-cache-dir uv")
        await context.ensureSandboxCommand("uv sync", `cd ${context.projectDir} && uv sync`)
        await context.ensureSandboxCommand("install terse-cli", `cd ${context.projectDir} && uv pip install --python .venv/bin/python terse-cli`)
        return context.runSandboxCommand(
            "terse run",
            `cd ${context.projectDir} && TERSE_DEBUG=1 uv run --no-sync --python .venv/bin/python terse --debug run ${context.escapeShellArg(context.jobName)} --event-file ${context.eventFilePath}`
        )
    }
}
