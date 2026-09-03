import { getExecutionPhase } from "little-durable"

declare const process: { env: Record<string, string | undefined> }

export class DurableOnlyError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "DurableOnlyError"
    }
}

export function isDurableExecution(): boolean {
    return getExecutionPhase() !== undefined
}

// Local test runs (`terse test`) execute in the developer's own process; only cloud
// sandboxes set TERSE_RUN_ID. Primitives that suspend in production branch on this.
export function isLocalTestRun(): boolean {
    return !process.env.TERSE_RUN_ID
}
