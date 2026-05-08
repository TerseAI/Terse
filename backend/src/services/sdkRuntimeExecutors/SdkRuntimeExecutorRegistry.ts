import { TypescriptSdkRuntimeExecutor } from "./TypescriptSdkRuntimeExecutor"
import type { SdkRuntimeExecutor } from "./types"

class SdkRuntimeExecutorRegistry {
    constructor(private readonly executors: readonly SdkRuntimeExecutor[]) {}

    resolve(entries: Set<string>): SdkRuntimeExecutor {
        let match: SdkRuntimeExecutor | undefined

        for (const executor of this.executors) {
            if (!executor.matchesArchive(entries)) {
                continue
            }

            if (match) {
                throw new Error("Ambiguous SDK runtime")
            }

            match = executor
        }

        if (!match) {
            throw new Error("Could not determine SDK runtime")
        }

        return match
    }

    resolveRuntime(runtime: SdkRuntimeExecutor["runtime"]): SdkRuntimeExecutor {
        const match = this.executors.find(executor => executor.runtime === runtime)
        if (!match) {
            throw new Error(`Unsupported SDK runtime: ${runtime}`)
        }

        return match
    }
}

export const sdkRuntimeExecutorRegistry = new SdkRuntimeExecutorRegistry([new TypescriptSdkRuntimeExecutor()])
