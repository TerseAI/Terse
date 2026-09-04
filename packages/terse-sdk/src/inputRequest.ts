import { defineHook, waitFor } from "little-durable"
import type {
    SdkInputRequestDelivery,
    SdkInputRequestMedia,
    SdkInputRequestOption,
    SdkInputRequestRegisterBody,
    SdkInputRequestTarget,
    SdkInputResponsePayload,
    SdkInputResponseTransport
} from "terse-types"
import { ApiRoutes, buildRoute, sdkInputRequestRegisterResponseSchema, sdkInputResponsePayloadSchema } from "terse-types"
import { z } from "zod"

import { buildSdkRequestHeaders, resolveTerseBackendUrl } from "./backendRequest.js"
import { runSdkStep } from "./durableExecution.js"
import { DurableOnlyError, isDurableExecution, isLocalTestRun } from "./execution.js"
import { pollUntil } from "./poll.js"
import { resolveRunIdentity } from "./runIdentity/index.js"

declare const process: { env: Record<string, string | undefined> }

export const __inputRequestHook = defineHook({
    name: "terse.input-request",
    request: z.object({ token: z.string().min(1) }).strict(),
    resolution: sdkInputResponsePayloadSchema
})

// Provider-neutral input targets and delivery refs; both unions live in terse-types.
// Adding a provider: extend those unions, add a target constructor here, and register
// an InputRequestProvider in the backend. Everything between is provider-agnostic.
export type InputTarget = SdkInputRequestTarget
export type InputDelivery = SdkInputRequestDelivery
type DeliveryFor<Target extends InputTarget> = Extract<InputDelivery, { provider: Target["provider"] }>

export type SlackInputTarget = Extract<InputTarget, { provider: "slack" }>

// channel takes a Slack channel id; use the generated constants, e.g. SlackChannel.Launches.channelId.
export function slack(target: { channel: string }): SlackInputTarget {
    return { provider: "slack", channelId: target.channel }
}

export type InputOption<Id extends string = string> = {
    id: Id
    label: string
    description?: string
    freeText?: boolean
}

export type InputRespondent = { provider: string; userId: string; displayName?: string }

export type InputResponse<Id extends string, Delivery extends InputDelivery = InputDelivery> = {
    choice: Id
    text?: string
    respondent: InputRespondent
    delivery: Delivery
}

export type WaitForInputParams<Options extends readonly InputOption[], Target extends InputTarget = InputTarget> = {
    via: Target
    prompt: string
    details?: Record<string, string>
    media?: readonly InputMedia[]
    options: Options
}

export type InputMedia = SdkInputRequestMedia

export function waitForInput<const Options extends readonly InputOption[], Target extends InputTarget>(
    params: WaitForInputParams<Options, Target>
): Promise<InputResponse<Options[number]["id"], DeliveryFor<Target>>> {
    if (!isDurableExecution()) {
        throw new DurableOnlyError("waitForInput() is only available in durable jobs. Add `durable: true` to this job.")
    }
    // Local runs send the same real message but poll the API for the response,
    // since the process stays alive instead of suspending.
    if (isLocalTestRun()) {
        return waitForInputViaPoll(params)
    }
    return waitForInputDurable(params)
}

// The hook entity this journals is the wait. The durable runtime returns it as an explicit
// suspension outcome, and the CLI asks the control plane to snapshot and park the sandbox.
async function waitForInputDurable<Options extends readonly InputOption[], Target extends InputTarget>(
    params: WaitForInputParams<Options, Target>
): Promise<InputResponse<Options[number]["id"], DeliveryFor<Target>>> {
    const token = await createInputRequestToken()
    const delivery = await registerInputRequest(token, params, "suspend")
    if (delivery.provider !== params.via.provider) {
        throw new Error(`waitForInput: backend delivered via "${delivery.provider}" but the target was "${params.via.provider}"`)
    }
    const typedDelivery = delivery as DeliveryFor<Target>

    const payload = await waitFor(__inputRequestHook, { token })
    return {
        choice: payload.choice as Options[number]["id"],
        ...(payload.text !== undefined ? { text: payload.text } : {}),
        respondent: payload.respondent,
        delivery: typedDelivery
    }
}

// Local mirror of waitForInputDurable: same real message via the same endpoint, but the
// response comes back by polling instead of a sandbox resume, since this process is alive.
async function waitForInputViaPoll<Options extends readonly InputOption[], Target extends InputTarget>(
    params: WaitForInputParams<Options, Target>
): Promise<InputResponse<Options[number]["id"], DeliveryFor<Target>>> {
    const token = await createInputRequestToken()
    const delivery = await registerInputRequest(token, params, "poll")
    if (delivery.provider !== params.via.provider) {
        throw new Error(`waitForInput: backend delivered via "${delivery.provider}" but the target was "${params.via.provider}"`)
    }
    const typedDelivery = delivery as DeliveryFor<Target>

    const payload = await pollInputResponse(token, describeInputTarget(params.via))
    return {
        choice: payload.choice as Options[number]["id"],
        ...(payload.text !== undefined ? { text: payload.text } : {}),
        respondent: payload.respondent,
        delivery: typedDelivery
    }
}

// Journaled so replays reuse the registered request instead of posting a duplicate message.
async function createInputRequestToken(): Promise<string> {
    return runSdkStep({
        name: "terse.input-request.token",
        input: null,
        run: () => globalThis.crypto.randomUUID()
    })
}

async function registerInputRequest(token: string, params: WaitForInputParams<readonly InputOption[], InputTarget>, transport: SdkInputResponseTransport): Promise<InputDelivery> {
    const response = await deliverInputRequestStep({
        token,
        prompt: params.prompt,
        details: params.details,
        media: params.media?.map(item => ({ kind: item.kind, url: item.url, ...(item.altText !== undefined ? { altText: item.altText } : {}) })),
        options: params.options.map(option => ({
            id: option.id,
            label: option.label,
            ...(option.description !== undefined ? { description: option.description } : {}),
            ...(option.freeText !== undefined ? { freeText: option.freeText } : {})
        })),
        via: params.via,
        transport
    })
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`waitForInput: failed to deliver input request: HTTP ${response.status}: ${response.body}`)
    }
    const parsed = sdkInputRequestRegisterResponseSchema.parse(JSON.parse(response.body))
    if (!parsed.success || !parsed.delivery) {
        throw new Error(`waitForInput: failed to deliver input request: ${parsed.error ?? "registration failed"}`)
    }
    return parsed.delivery
}

// A step so the delivery happens exactly once and the run id resolves: run identity is
// only reachable in step scope, not from the workflow body. HTTP failures come back as
// data (thrown in workflow scope) so a 4xx/5xx doesn't trigger step retries.
async function deliverInputRequestStep(request: {
    token: string
    prompt: string
    details?: Record<string, string>
    media?: SdkInputRequestMedia[]
    options: SdkInputRequestOption[]
    via: InputTarget
    transport: SdkInputResponseTransport
}): Promise<{ status: number; body: string }> {
    const input = {
        token: request.token,
        prompt: request.prompt,
        ...(request.details ? { details: request.details } : {}),
        ...(request.media ? { media: request.media } : {}),
        options: request.options,
        via: request.via,
        transport: request.transport
    }

    return runSdkStep({
        name: "terse.input-request.deliver",
        input,
        run: async stepRequest => {
            const runId = process.env.TERSE_RUN_ID ?? (await resolveRunIdentity()).runId
            if (!runId) {
                throw new Error("waitForInput: could not resolve a run id for this execution.")
            }
            const body: SdkInputRequestRegisterBody = {
                ...stepRequest,
                runId
            }
            const headers = { ...(await buildSdkRequestHeaders()), Accept: "application/json" }
            const response = await fetch(`${resolveTerseBackendUrl()}${ApiRoutes.SDK.INPUT_REQUEST}`, {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            })
            return { status: response.status, body: await response.text() }
        }
    })
}

// A step so the wait happens exactly once; replays return the journaled response.
async function pollInputResponse(token: string, targetDescription: string): Promise<SdkInputResponsePayload> {
    return runSdkStep({
        name: "terse.input-request.poll",
        input: { token, targetDescription },
        run: async input => {
            console.log(`[terse] waitForInput: sent via ${input.targetDescription}; waiting for a response there.`)
            const headers = { ...(await buildSdkRequestHeaders()), Accept: "application/json" }
            const url = `${resolveTerseBackendUrl()}${buildRoute(ApiRoutes.SDK.INPUT_RESPONSE, { token: input.token })}`

            const payload = await pollUntil(
                async () => {
                    const response = await fetch(url, { headers })
                    if (response.status === 204) return undefined
                    if (!response.ok) {
                        throw new Error(`waitForInput: response poll failed: HTTP ${response.status}`)
                    }
                    return sdkInputResponsePayloadSchema.parse(await response.json())
                },
                { intervalMs: 3_000, errorToleranceMs: 10 * 60_000 }
            )
            if (payload === null) {
                throw new Error("waitForInput: polling stopped before a response arrived.")
            }
            return payload
        }
    })
}

function describeInputTarget(target: InputTarget): string {
    switch (target.provider) {
        case "slack":
            return `Slack channel ${target.channelId}`
    }
}
