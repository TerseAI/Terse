import fs from "node:fs"
import path from "node:path"

// Event-driven park detection for hook-blocked runs (waitForInput).
//
// The workflow runtime advances a run in passes: each queue message invokes the workflow
// or a step handler, which may schedule follow-up messages. A run has parked exactly when
// a workflow pass completes having scheduled nothing, with no step still executing, while
// an unresolved input hook sits in the journal (the SDK's durable declaration of waiting;
// dispose deletes the entity once answered). All three facts are known synchronously at
// handler completion, so the signal fires from there — no polling.

type Handler = (request: Request) => Promise<Response>

let enqueueCount = 0
let inFlightSteps = 0
let onParked: (() => void) | undefined

// terseWorld calls this for every queue() call, delayed or not.
export function noteEnqueue(): void {
    enqueueCount++
}

export function setParkListener(listener: (() => void) | undefined): void {
    onParked = listener
}

export function trackStepHandler(handler: Handler): Handler {
    return async request => {
        inFlightSteps++
        try {
            return await handler(request)
        } finally {
            inFlightSteps--
        }
    }
}

export function trackWorkflowHandler(handler: Handler, dataDir: string): Handler {
    return async request => {
        const enqueuesBefore = enqueueCount
        try {
            return await handler(request)
        } finally {
            const scheduledNothing = enqueueCount === enqueuesBefore
            if (scheduledNothing && inFlightSteps === 0 && hasUnresolvedHooks(dataDir)) {
                onParked?.()
            }
        }
    }
}

// helpers

function hasUnresolvedHooks(dataDir: string): boolean {
    const hooksDir = path.join(dataDir, "hooks")
    if (!fs.existsSync(hooksDir)) return false
    return fs.readdirSync(hooksDir).some(file => file.endsWith(".json"))
}
