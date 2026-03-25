import { PythonSdkRuntimeExecutor } from "./PythonSdkRuntimeExecutor"
import { TypescriptSdkRuntimeExecutor } from "./TypescriptSdkRuntimeExecutor"
import type { SdkRuntimeExecutor } from "./types"

export class SdkRuntimeExecutorRegistry {
    constructor(private readonly executors: readonly SdkRuntimeExecutor[]) {}

    resolve(entries: Set<string>): SdkRuntimeExecutor {
        const matches = this.executors.filter(executor => executor.matchesArchive(entries))
        if (matches.length === 1) {
            return matches[0]
        }

        const knownEntries = this.getKnownDetectionEntries()

        if (matches.length > 1) {
            const matchedEntries = Array.from(
                new Set(matches.flatMap(executor => executor.detectionEntries.filter(entry => entries.has(entry))))
            ).sort()

            if (matchedEntries.length === 2) {
                throw new Error(`SDK archive is ambiguous: found both "${matchedEntries[0]}" and "${matchedEntries[1]}" at the project root`)
            }

            throw new Error(
                `SDK archive is ambiguous: found multiple runtime entrypoints at the project root (${matchedEntries.map(entry => `"${entry}"`).join(", ")})`
            )
        }

        if (knownEntries.length === 2) {
            throw new Error(`SDK archive is invalid: expected either "${knownEntries[0]}" or "${knownEntries[1]}" at the project root`)
        }

        throw new Error(
            `SDK archive is invalid: expected one of ${knownEntries.map(entry => `"${entry}"`).join(", ")} at the project root`
        )
    }

    private getKnownDetectionEntries(): string[] {
        return Array.from(new Set(this.executors.flatMap(executor => [...executor.detectionEntries]))).sort()
    }
}

export const sdkRuntimeExecutorRegistry = new SdkRuntimeExecutorRegistry([
    new TypescriptSdkRuntimeExecutor(),
    new PythonSdkRuntimeExecutor()
])
