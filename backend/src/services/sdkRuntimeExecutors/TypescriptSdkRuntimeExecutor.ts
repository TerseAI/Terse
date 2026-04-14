import type { SandboxCommandResult, SdkRuntimeExecutor, SdkRuntimeExecutorContext } from "./types"
import { SandboxStage, runSandboxExecStage, runSandboxStage } from "./types"

export class TypescriptSdkRuntimeExecutor implements SdkRuntimeExecutor {
    readonly runtime = "typescript" as const
    readonly sandboxImage = "node:22-slim"

    matchesArchive(entries: Set<string>): boolean {
        return entries.has("package.json")
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        await runSandboxStage(context, SandboxStage.INSTALLING_DEPENDENCIES, () => context.ensureSandboxCommand("npm install", `cd ${context.projectDir} && npm install --omit=dev --no-fund`))

        await runSandboxStage(context, SandboxStage.INSTALLING_CLI, () =>
            context.ensureSandboxCommand("npm install terse-cli", `cd ${context.projectDir} && npm install terse-sdk@latest terse-cli@latest --no-fund`)
        )

        return runSandboxExecStage(context, () =>
            context.runSandboxCommandStreaming("terse run", `cd ${context.projectDir} && npx terse run ${context.escapeShellArg(context.jobName)} --event-file ${context.eventFilePath}`)
        )
    }
}
