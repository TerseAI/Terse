declare const process: { env: Record<string, string | undefined> }

export class DurableOnlyError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "DurableOnlyError"
    }
}

// The durable runtime injects its sleep implementation on globalThis; its presence is
// how we detect that we're running inside a durable job.
export function isDurableExecution(): boolean {
    return Boolean(Reflect.get(globalThis, Symbol.for("WORKFLOW_SLEEP")))
}

// Local test runs (`terse test`) execute in the developer's own process; only cloud
// sandboxes set TERSE_RUN_ID. Primitives that suspend in production branch on this.
export function isLocalTestRun(): boolean {
    return !process.env.TERSE_RUN_ID
}
