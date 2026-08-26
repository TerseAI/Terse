import { createWaitEventId } from "../types/waitEventId.js"
import type { WaitRequestedEvent } from "../types/waitRequestedEvent.js"
import { getWorkflowContext } from "./workflowContext.js"

// The event request field is the journal's canonical JSON value type.
type CanonicalRequest = WaitRequestedEvent["request"]

export type WaitForParams<Request extends CanonicalRequest> = {
    readonly request: Request
}

export async function waitFor<Request extends CanonicalRequest>({ request }: WaitForParams<Request>): Promise<never> {
    const context = getWorkflowContext()
    const waitId = context.idGenerator.next({ namespace: "wait" })
    const event: WaitRequestedEvent = {
        eventId: createWaitEventId({ type: "wait.requested", waitId }),
        type: "wait.requested",
        waitId,
        requestedAt: new Date().toISOString(),
        request
    }

    await context.journalStore.append({
        runId: context.runId,
        event
    })

    context.suspend({
        waitId,
        request
    })

    return new Promise<never>(() => undefined)
}
