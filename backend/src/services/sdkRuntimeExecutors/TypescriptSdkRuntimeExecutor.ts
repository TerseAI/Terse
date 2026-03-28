import type { SandboxCommandResult, SdkRuntimeExecutor, SdkRuntimeExecutorContext } from "./types"
import { SandboxStage, runSandboxExecStage, runSandboxStage } from "./types"

export class TypescriptSdkRuntimeExecutor implements SdkRuntimeExecutor {
    readonly runtime = "typescript" as const
    readonly sandboxImage = "node:22-slim"

    matchesArchive(entries: Set<string>): boolean {
        return entries.has("package.json")
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        await runSandboxStage(context, SandboxStage.INSTALLING_DEPENDENCIES, () => context.ensureSandboxCommand("npm install", `cd ${context.projectDir} && npm install --omit=dev`))

        await runSandboxStage(context, SandboxStage.INSTALLING_CLI, () => context.ensureSandboxCommand("npm install terse-cli", `cd ${context.projectDir} && npm install terse-cli@latest`))

        return runSandboxExecStage(context, () =>
            context.runSandboxCommand("terse run", `cd ${context.projectDir} && npx terse run ${context.escapeShellArg(context.jobName)} --event-file ${context.eventFilePath}`)
        )
    }
}
