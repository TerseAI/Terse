import type { JournalStore } from "../types/journalStore.js"
import type { RunCompletedEvent } from "../types/runCompletedEvent.js"
import { createRunEventId } from "../types/runEventId.js"
import type { RunStartedEvent } from "../types/runStartedEvent.js"

import { DeterministicIdGenerator } from "./deterministicIdGenerator.js"
import { runWithWorkflowContext } from "./workflowContext.js"

export type RuntimeOptions = {
    readonly journalStore: JournalStore
}

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
    constructor(private readonly options: RuntimeOptions) {}

    async start<Input extends CanonicalInput>({ runId, workflowName, input, workflow }: StartParams<Input>): Promise<void> {
        const existingEvent = await this.options.journalStore.get({
            runId,
            eventId: createRunEventId({ type: "run.started" })
        })

        if (existingEvent) {
            throw new Error(`Run "${runId}" has already exists`)
        }

        const event: RunStartedEvent = {
            eventId: createRunEventId({ type: "run.started" }),
            type: "run.started",
            workflowName,
            startedAt: new Date().toISOString(),
            input
        }

        await this.options.journalStore.append({
            runId,
            event
        })

        await runWithWorkflowContext(
            {
                runId,
                journalStore: this.options.journalStore,
                idGenerator: new DeterministicIdGenerator({
                    seed: runId,
                    timestamp: Date.parse(event.startedAt)
                })
            },
            () => workflow(input)
        )

        const completedEvent: RunCompletedEvent = {
            eventId: createRunEventId({ type: "run.completed" }),
            type: "run.completed",
            completedAt: new Date().toISOString()
        }

        await this.options.journalStore.append({
            runId,
            event: completedEvent
        })
    }

    async resume<Input extends CanonicalInput>({ runId }: ResumeParams<Input>): Promise<void> {
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

        if (completedEvent?.type === "run.completed") return

        throw new Error(`Run "${runId}" is incomplete and cannot be resumed yet`)
    }
}
