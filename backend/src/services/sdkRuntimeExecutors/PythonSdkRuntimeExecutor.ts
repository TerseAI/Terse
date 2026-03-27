import type { SandboxCommandResult, SdkRuntimeExecutor, SdkRuntimeExecutorContext } from "./types"
import { SandboxStage } from "./types"

export class PythonSdkRuntimeExecutor implements SdkRuntimeExecutor {
    readonly runtime = "python" as const
    readonly sandboxImage = "python:3.11-slim"

    matchesArchive(entries: Set<string>): boolean {
        return entries.has("pyproject.toml")
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        context.emitSandboxStatus(SandboxStage.INSTALLING_DEPENDENCIES, "started")
        const depStart = performance.now()
        try {
            await context.ensureSandboxCommand("install uv", "python -m pip install --no-cache-dir uv")
            await context.ensureSandboxCommand("uv sync", `cd ${context.projectDir} && uv sync`)
            context.emitSandboxStatus(SandboxStage.INSTALLING_DEPENDENCIES, "completed", { duration_ms: Math.round(performance.now() - depStart) })
        } catch (err) {
            context.emitSandboxStatus(SandboxStage.INSTALLING_DEPENDENCIES, "failed", {
                duration_ms: Math.round(performance.now() - depStart),
                detail: err instanceof Error ? err.message : String(err)
            })
            throw err
        }

        context.emitSandboxStatus(SandboxStage.INSTALLING_CLI, "started")
        const cliStart = performance.now()
        try {
            await context.ensureSandboxCommand("install terse-cli", `cd ${context.projectDir} && uv pip install --python .venv/bin/python terse-cli`)
            context.emitSandboxStatus(SandboxStage.INSTALLING_CLI, "completed", { duration_ms: Math.round(performance.now() - cliStart) })
        } catch (err) {
            context.emitSandboxStatus(SandboxStage.INSTALLING_CLI, "failed", { duration_ms: Math.round(performance.now() - cliStart), detail: err instanceof Error ? err.message : String(err) })
            throw err
        }

        context.emitSandboxStatus(SandboxStage.RUNNING, "started")
        const runStart = performance.now()
        const result = await context.runSandboxCommand(
            "terse run",
            `cd ${context.projectDir} && TERSE_DEBUG=1 uv run --no-sync --python .venv/bin/python terse --debug run ${context.escapeShellArg(context.jobName)} --event-file ${context.eventFilePath}`
        )
        if (result.exitCode === 0) {
            context.emitSandboxStatus(SandboxStage.RUNNING, "completed", { duration_ms: Math.round(performance.now() - runStart) })
        } else {
            const detail = result.stderr?.trim() || `Process exited with code ${result.exitCode}`
            context.emitSandboxStatus(SandboxStage.RUNNING, "failed", { duration_ms: Math.round(performance.now() - runStart), detail: detail.slice(0, 500) })
        }
        return result
    }
}
