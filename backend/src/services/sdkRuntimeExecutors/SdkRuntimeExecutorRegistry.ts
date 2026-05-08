import { PythonSdkRuntimeExecutor } from "./PythonSdkRuntimeExecutor"
import { TypescriptSdkRuntimeExecutor } from "./TypescriptSdkRuntimeExecutor"
import type { SdkRuntimeExecutor } from "./types"

// Temporarily disable the Python SDK end-to-end. The executor is still
// instantiated and exported so the surrounding code (types, services,
// migrations) keeps compiling, but it is excluded from runtime resolution
// so deploys/runs targeting Python are rejected with a clear error.
const PYTHON_SDK_RUNTIME_ENABLED = false

const PYTHON_DISABLED_MESSAGE = "Python SDK support is currently disabled."

class SdkRuntimeExecutorRegistry {
    constructor(private readonly executors: readonly SdkRuntimeExecutor[]) {}

    resolve(entries: Set<string>): SdkRuntimeExecutor {
        let match: SdkRuntimeExecutor | undefined

        for (const executor of this.executors) {
            if (!executor.matchesArchive(entries)) {
                continue
            }

            if (!PYTHON_SDK_RUNTIME_ENABLED && executor.runtime === "python") {
                throw new Error(`${PYTHON_DISABLED_MESSAGE} The uploaded project looks like a Python project (pyproject.toml).`)
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
        if (!PYTHON_SDK_RUNTIME_ENABLED && runtime === "python") {
            throw new Error(PYTHON_DISABLED_MESSAGE)
        }

        const match = this.executors.find(executor => executor.runtime === runtime)
        if (!match) {
            throw new Error(`Unsupported SDK runtime: ${runtime}`)
        }

        return match
    }
}

export const sdkRuntimeExecutorRegistry = new SdkRuntimeExecutorRegistry([new TypescriptSdkRuntimeExecutor(), new PythonSdkRuntimeExecutor()])
