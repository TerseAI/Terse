import { z } from "zod"

import { createWaitEventId } from "../types/waitEventId.js"
import type { WaitRequestedEvent } from "../types/waitRequestedEvent.js"
import type { WaitResolvedEvent } from "../types/waitResolvedEvent.js"

import type { AnyHookDefinition, HookRequest, HookResolution } from "./defineHook.js"
import { systemNow, toIsoString } from "./systemClock.js"
import { getWorkflowContext } from "./workflowContext.js"

// The event request field is the journal's canonical JSON value type.
type CanonicalRequest = WaitRequestedEvent["request"]
type CanonicalPayload = WaitResolvedEvent["payload"]

export async function waitFor<Hook extends AnyHookDefinition>(hook: Hook, request: HookRequest<Hook>): Promise<HookResolution<Hook>>
export async function waitFor(hook: AnyHookDefinition, request: unknown): Promise<unknown> {
    const parsedRequest = hook.request.parse(request)
    const canonicalRequest = z.json().parse(parsedRequest)
    const resolution = await waitForRequest({
        request: {
            type: "hook",
            name: hook.name,
            payload: canonicalRequest
        }
    })

    return hook.resolution.parse(resolution)
}

type WaitForRequestParams<Request extends CanonicalRequest> = {
    readonly request: Request
}

async function waitForRequest<Request extends CanonicalRequest, Payload extends CanonicalPayload = CanonicalPayload>({ request }: WaitForRequestParams<Request>): Promise<Payload> {
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
