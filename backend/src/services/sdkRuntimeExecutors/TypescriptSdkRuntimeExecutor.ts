import type { SandboxCommandResult, SdkRuntimeExecutor, SdkRuntimeExecutorContext } from "./types"
import { SandboxStage } from "./types"

export class TypescriptSdkRuntimeExecutor implements SdkRuntimeExecutor {
    readonly runtime = "typescript" as const
    readonly sandboxImage = "node:22-slim"

    matchesArchive(entries: Set<string>): boolean {
        return entries.has("package.json")
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        context.emitSandboxStatus(SandboxStage.INSTALLING_DEPENDENCIES, "started")
        const depStart = performance.now()
        try {
            await context.ensureSandboxCommand("npm install", `cd ${context.projectDir} && npm install --omit=dev`)
            context.emitSandboxStatus(SandboxStage.INSTALLING_DEPENDENCIES, "completed", { duration_ms: Math.round(performance.now() - depStart) })
        } catch (err) {
            context.emitSandboxStatus(SandboxStage.INSTALLING_DEPENDENCIES, "failed", { duration_ms: Math.round(performance.now() - depStart), detail: err instanceof Error ? err.message : String(err) })
            throw err
        }

        context.emitSandboxStatus(SandboxStage.INSTALLING_CLI, "started")
        const cliStart = performance.now()
        try {
            await context.ensureSandboxCommand("npm install terse-cli", `cd ${context.projectDir} && npm install terse-cli@latest`)
            context.emitSandboxStatus(SandboxStage.INSTALLING_CLI, "completed", { duration_ms: Math.round(performance.now() - cliStart) })
        } catch (err) {
            context.emitSandboxStatus(SandboxStage.INSTALLING_CLI, "failed", { duration_ms: Math.round(performance.now() - cliStart), detail: err instanceof Error ? err.message : String(err) })
            throw err
        }

        context.emitSandboxStatus(SandboxStage.RUNNING, "started")
        const runStart = performance.now()
        const result = await context.runSandboxCommand("terse run", `cd ${context.projectDir} && npx terse run ${context.escapeShellArg(context.jobName)} --event-file ${context.eventFilePath}`)
        if (result.exitCode === 0) {
            context.emitSandboxStatus(SandboxStage.RUNNING, "completed", { duration_ms: Math.round(performance.now() - runStart) })
        } else {
            const detail = result.stderr?.trim() || `Process exited with code ${result.exitCode}`
            context.emitSandboxStatus(SandboxStage.RUNNING, "failed", { duration_ms: Math.round(performance.now() - runStart), detail: detail.slice(0, 500) })
        }
        return result
    }
}
