import type { JournalStore } from "../types/journalStore.js"
import type { RuntimeCompletedOutcome, RuntimeOutcome, RuntimeSuspendedOutcome, Suspension } from "../types/runtimeOutcome.js"
import type { RunCompletedEvent } from "../types/runCompletedEvent.js"
import { createRunEventId } from "../types/runEventId.js"
import type { RunStartedEvent } from "../types/runStartedEvent.js"

import { systemNow, toIsoString } from "./systemClock.js"
import { DeterministicIdGenerator } from "./deterministicIdGenerator.js"
import { installWorkflowDate } from "./workflowDate.js"
import type { LogicalClock } from "./workflowContext.js"
import { runWithWorkflowContext } from "./workflowContext.js"

export type RuntimeOptions = {
    readonly journalStore: JournalStore
}

// The event input field is the journal's canonical JSON value type.
type CanonicalInput = RunStartedEvent["input"]

export type Workflow<Input extends CanonicalInput> = (input: Input) => void | Promise<void>

export type StartParams<Input extends CanonicalInput> = {
    readonly runId: string
    readonly workflowName: string
    readonly input: Input
    readonly workflow: Workflow<Input>
}

export type ResumeParams<Input extends CanonicalInput> = {
    readonly runId: string
    readonly workflow: Workflow<Input>
}

export class Runtime {
    constructor(private readonly options: RuntimeOptions) {
        installWorkflowDate()
    }

    async start<Input extends CanonicalInput>({ runId, workflowName, input, workflow }: StartParams<Input>): Promise<RuntimeOutcome> {
        const existingEvent = await this.options.journalStore.get({
            runId,
            eventId: createRunEventId({ type: "run.started" })
        })

        if (existingEvent) {
            throw new Error(`Run "${runId}" has already exists`)
        }

        const startedAt = systemNow()
        const event: RunStartedEvent = {
            eventId: createRunEventId({ type: "run.started" }),
            type: "run.started",
            workflowName,
            startedAt: toIsoString(startedAt),
            input
        }

        await this.options.journalStore.append({
            runId,
            event
        })

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
                    phase: "workflow"
                },
                () => workflow(input)
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

    async resume<Input extends CanonicalInput>({ runId }: ResumeParams<Input>): Promise<RuntimeOutcome> {
        const startedEvent = await this.options.journalStore.get({
            runId,
            eventId: createRunEventId({ type: "run.started" })
        })

        if (startedEvent?.type !== "run.started") {
            throw new Error(`Run "${runId}" does not exist`)
        }

        const completedEvent = await this.options.journalStore.get({
            runId,
            eventId: createRunEventId({ type: "run.completed" })
        })

        if (completedEvent?.type === "run.completed") return { status: "completed" }

        throw new Error(`Run "${runId}" is incomplete and cannot be resumed yet`)
    }
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
