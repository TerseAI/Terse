import { isDeepStrictEqual } from "node:util"
import { z } from "zod"

import { HookRequestEnvelopeSchema } from "../types/hookRequestEnvelope.js"
import type { JournalStore } from "../types/journalStore.js"
import type { RunCompletedEvent } from "../types/runCompletedEvent.js"
import { createRunEventId } from "../types/runEventId.js"
import type { RunMetadata } from "../types/runMetadata.js"
import type { RunStartedEvent } from "../types/runStartedEvent.js"
import type { RuntimeCompletedOutcome, RuntimeOutcome, RuntimeSuspendedOutcome, Suspension } from "../types/runtimeOutcome.js"
import { createWaitEventId } from "../types/waitEventId.js"
import type { WaitRequestedEvent } from "../types/waitRequestedEvent.js"
import type { WaitResolvedEvent } from "../types/waitResolvedEvent.js"

import type { AnyHookDefinition, HookResolutionInput } from "./defineHook.js"
import type { WorkflowDefinition } from "./defineWorkflow.js"
import { DeterministicIdGenerator, createDeterministicRandom } from "./deterministicIdGenerator.js"
import { systemNow, toIsoString } from "./systemClock.js"
import { TimerHook } from "./timerHook.js"
import type { LogicalClock } from "./workflowContext.js"
import { runWithWorkflowContext } from "./workflowContext.js"
import { installWorkflowDate } from "./workflowDate.js"
import { installWorkflowRandom } from "./workflowRandom.js"

export type RuntimeOptions = {
    readonly journalStore: JournalStore
}

export type GetRunParams = {
    readonly runId: string
}

export type GetSuspensionParams = {
    readonly runId: string
}

export type StartParams<InputSchema extends z.ZodType> = {
    readonly runId: string
    readonly workflowName: string
    readonly input: z.input<InputSchema>
    readonly workflow: WorkflowDefinition<InputSchema>
}

export type ResumeParams<InputSchema extends z.ZodType> = {
    readonly runId: string
    readonly workflow: WorkflowDefinition<InputSchema>
    readonly event?: ResumeEvent
}

export type ResumeEvent = {
    readonly type: "wait.resolved"
    readonly waitId: string
    readonly payload: WaitResolvedEvent["payload"]
}

export type ResumeHookParams<InputSchema extends z.ZodType, Hook extends AnyHookDefinition> = {
    readonly runId: string
    readonly workflow: WorkflowDefinition<InputSchema>
    readonly waitId: string
    readonly resolution: HookResolutionInput<Hook>
}

export type ResumeTimerParams<InputSchema extends z.ZodType> = {
    readonly runId: string
    readonly workflow: WorkflowDefinition<InputSchema>
    readonly waitId: string
}

type ExecuteParams<InputSchema extends z.ZodType> = {
    readonly runId: string
    readonly input: z.infer<typeof z.json>
    readonly workflow: WorkflowDefinition<InputSchema>
    readonly startedAt: number
}

export class Runtime {
    constructor(private readonly options: RuntimeOptions) {
        installWorkflowDate()
        installWorkflowRandom()
    }

    async start<InputSchema extends z.ZodType>({ runId, workflowName, input, workflow }: StartParams<InputSchema>): Promise<RuntimeOutcome> {
        workflow.input.parse(input)

        const existingEvent = await this.options.journalStore.get({
            runId,
            eventId: createRunEventId({ type: "run.started" })
        })

        if (existingEvent) {
            throw new Error(`Run "${runId}" already exists`)
        }

        const startedAt = systemNow()
        const event = await this.options.journalStore.append({
            runId,
            event: {
                eventId: createRunEventId({ type: "run.started" }),
                type: "run.started",
                workflowName,
                startedAt: toIsoString(startedAt),
                input
            }
        })

        if (event.type !== "run.started") throw new Error("Journal store returned the wrong event after appending run.started")

        return this.execute({
            runId,
            input: event.input,
            workflow,
            startedAt
        })
    }

    async getRun({ runId }: GetRunParams): Promise<RunMetadata> {
        const startedEvent = await this.getStartedEvent(runId)
        return {
            runId,
            workflowName: startedEvent.workflowName,
            startedAt: startedEvent.startedAt
        }
    }

    async getSuspension({ runId }: GetSuspensionParams): Promise<Suspension | undefined> {
        await this.getStartedEvent(runId)
        const events = await this.options.journalStore.list({ runId })
        const resolvedWaitIds = new Set(events.filter(event => event.type === "wait.resolved").map(event => event.waitId))

        for (let index = events.length - 1; index >= 0; index--) {
            const event = events[index]
            if (event?.type !== "wait.requested" || resolvedWaitIds.has(event.waitId)) continue
            return {
                waitId: event.waitId,
                request: HookRequestEnvelopeSchema.parse(event.request)
            }
        }

        return undefined
    }

    async resume<InputSchema extends z.ZodType>({ runId, workflow, event }: ResumeParams<InputSchema>): Promise<RuntimeOutcome> {
        const startedEvent = await this.getStartedEvent(runId)

        const completedEvent = await this.options.journalStore.get({
            runId,
            eventId: createRunEventId({ type: "run.completed" })
        })

        if (completedEvent?.type === "run.completed") return { status: "completed" }

        if (event) await this.appendResumeEvent({ runId, event })

        return this.execute({
            runId,
            input: startedEvent.input,
            workflow,
            startedAt: Date.parse(startedEvent.startedAt)
        })
    }

    async resumeHook<Hook extends AnyHookDefinition, InputSchema extends z.ZodType>(hook: Hook, { runId, workflow, waitId, resolution }: ResumeHookParams<InputSchema, Hook>): Promise<RuntimeOutcome> {
        const requestedEvent = await this.options.journalStore.get({
            runId,
            eventId: createWaitEventId({ type: "wait.requested", waitId })
        })

        if (requestedEvent?.type !== "wait.requested") {
            throw new Error(`Wait "${waitId}" does not exist in run "${runId}"`)
        }

        const request = HookRequestEnvelopeSchema.parse(requestedEvent.request)

        if (request.name !== hook.name) {
            throw new Error(`Wait "${waitId}" belongs to hook "${request.name}", not "${hook.name}"`)
        }

        hook.request.parse(request.payload)
        const parsedResolution = hook.resolution.parse(resolution)
        const canonicalResolution = z.json().parse(parsedResolution)

        return this.resume({
            runId,
            workflow,
            event: {
                type: "wait.resolved",
                waitId,
                payload: canonicalResolution
            }
        })
    }

    async resumeTimer<InputSchema extends z.ZodType>({ runId, workflow, waitId }: ResumeTimerParams<InputSchema>): Promise<RuntimeOutcome> {
        const requestedEvent = await this.options.journalStore.get({
            runId,
            eventId: createWaitEventId({ type: "wait.requested", waitId })
        })

        if (requestedEvent?.type !== "wait.requested") {
            throw new Error(`Wait "${waitId}" does not exist in run "${runId}"`)
        }

        const request = HookRequestEnvelopeSchema.parse(requestedEvent.request)

        if (request.name !== TimerHook.name) {
            throw new Error(`Wait "${waitId}" belongs to hook "${request.name}", not "${TimerHook.name}"`)
        }

        const timer = TimerHook.request.parse(request.payload)

        if (systemNow() < Date.parse(timer.wakeAt)) {
            return this.resume({ runId, workflow })
        }

        return this.resumeHook(TimerHook, {
            runId,
            workflow,
            waitId,
            resolution: {}
        })
    }

    private async appendResumeEvent({ runId, event }: { readonly runId: string; readonly event: ResumeEvent }): Promise<void> {
        const resolvedEventId = createWaitEventId({ type: "wait.resolved", waitId: event.waitId })
        const existingResolvedEvent = await this.options.journalStore.get({
            runId,
            eventId: resolvedEventId
        })

        if (existingResolvedEvent?.type === "wait.resolved") {
            if (isDeepStrictEqual(existingResolvedEvent.payload, event.payload)) return
            throw new Error(`Wait "${event.waitId}" is already resolved with a different payload`)
        }

        const requestedEvent = await this.options.journalStore.get({
            runId,
            eventId: createWaitEventId({ type: "wait.requested", waitId: event.waitId })
        })

        if (requestedEvent?.type !== "wait.requested") {
            throw new Error(`Wait "${event.waitId}" does not exist in run "${runId}"`)
        }

        const resolvedAt = systemNow()
        const wakeAt = getTimerWakeAt(requestedEvent.request)

        if (wakeAt !== undefined && resolvedAt < wakeAt) return

        const resolvedEvent: WaitResolvedEvent = {
            eventId: resolvedEventId,
            type: "wait.resolved",
            waitId: event.waitId,
            resolvedAt: toIsoString(resolvedAt),
            payload: event.payload
        }

        await this.options.journalStore.append({
            runId,
            event: resolvedEvent
        })
    }

    private async getStartedEvent(runId: string): Promise<RunStartedEvent> {
        const startedEvent = await this.options.journalStore.get({
            runId,
            eventId: createRunEventId({ type: "run.started" })
        })

        if (startedEvent?.type !== "run.started") {
            throw new Error(`Run "${runId}" does not exist`)
        }

        return startedEvent
    }

    private async execute<InputSchema extends z.ZodType>({ runId, input, workflow, startedAt }: ExecuteParams<InputSchema>): Promise<RuntimeOutcome> {
        const suspensionSignal = createSuspensionSignal()
        const logicalClock = createLogicalClock(startedAt)
        const workflowCompletion = Promise.resolve(
            runWithWorkflowContext(
                {
                    runId,
                    journalStore: this.options.journalStore,
                    idGenerator: new DeterministicIdGenerator({
                        seed: runId,
                        timestamp: startedAt
                    }),
                    suspend: suspensionSignal.suspend,
                    logicalClock,
                    random: createDeterministicRandom(`${runId}\0${startedAt}\0workflow`),
                    phase: "workflow"
                },
                () => workflow.run(workflow.input.parse(input))
            )
        ).then(
            (): RuntimeCompletedOutcome => ({
                status: "completed"
            })
        )

        const outcome = await Promise.race([
            workflowCompletion,
            suspensionSignal.promise.then(
                (suspension): RuntimeSuspendedOutcome => ({
                    status: "suspended",
                    suspension
                })
            )
        ])

        if (outcome.status === "suspended") return outcome

        const completedAt = systemNow()
        const completedEvent: RunCompletedEvent = {
            eventId: createRunEventId({ type: "run.completed" }),
            type: "run.completed",
            completedAt: toIsoString(completedAt)
        }

        await this.options.journalStore.append({
            runId,
            event: completedEvent
        })

        return outcome
    }
}

function getTimerWakeAt(request: WaitRequestedEvent["request"]): number | undefined {
    if (typeof request !== "object" || request === null || Array.isArray(request) || request.type !== "timer") return undefined
    if (typeof request.wakeAt !== "string") throw new Error("Timer wait request has an invalid wakeAt")

    const wakeAt = Date.parse(request.wakeAt)
    if (!Number.isFinite(wakeAt)) throw new Error("Timer wait request has an invalid wakeAt")

    return wakeAt
}

function createLogicalClock(initialTimestamp: number): LogicalClock {
    let timestamp = initialTimestamp

    return {
        now: () => timestamp,
        advanceTo: (nextTimestamp: number) => {
            timestamp = Math.max(timestamp, nextTimestamp)
        }
    }
}

type SuspensionSignal = {
    readonly promise: Promise<Suspension>
    readonly suspend: (suspension: Suspension) => void
}

function createSuspensionSignal(): SuspensionSignal {
    let resolveSuspension: (suspension: Suspension) => void = () => undefined
    let suspended = false
    const promise = new Promise<Suspension>(resolve => {
        resolveSuspension = resolve
    })

    return {
        promise,
        suspend: suspension => {
            if (suspended) return
            suspended = true
            resolveSuspension(suspension)
        }
    }
}
