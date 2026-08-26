import { createWaitEventId } from "../types/waitEventId.js"
import type { WaitRequestedEvent } from "../types/waitRequestedEvent.js"
import type { WaitResolvedEvent } from "../types/waitResolvedEvent.js"

import { systemNow, toIsoString } from "./systemClock.js"
import { getWorkflowContext } from "./workflowContext.js"

// The event request field is the journal's canonical JSON value type.
type CanonicalRequest = WaitRequestedEvent["request"]
type CanonicalPayload = WaitResolvedEvent["payload"]

export type WaitForParams<Request extends CanonicalRequest, Payload extends CanonicalPayload> = {
    readonly request: Request
}

export async function waitFor<Request extends CanonicalRequest, Payload extends CanonicalPayload = CanonicalPayload>({ request }: WaitForParams<Request, Payload>): Promise<Payload> {
    const context = getWorkflowContext()
    const waitId = context.idGenerator.next({ namespace: "wait" })

    const resolvedEvent = await context.journalStore.get({
        runId: context.runId,
        eventId: createWaitEventId({ type: "wait.resolved", waitId })
    })

    if (resolvedEvent?.type === "wait.resolved") {
        context.logicalClock.advanceTo(Date.parse(resolvedEvent.resolvedAt))
        return resolvedEvent.payload as Payload
    }

    const requestedEvent = await context.journalStore.get({
        runId: context.runId,
        eventId: createWaitEventId({ type: "wait.requested", waitId })
    })
    let persistedRequest: CanonicalRequest

    if (requestedEvent?.type === "wait.requested") {
        persistedRequest = requestedEvent.request
    } else {
        const event: WaitRequestedEvent = {
            eventId: createWaitEventId({ type: "wait.requested", waitId }),
            type: "wait.requested",
            waitId,
            requestedAt: toIsoString(systemNow()),
            request
        }

        await context.journalStore.append({
            runId: context.runId,
            event
        })
        persistedRequest = request
    }

    context.suspend({
        waitId,
        request: persistedRequest
    })

    return new Promise<never>(() => undefined)
}
