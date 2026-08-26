import { StepCompletedEvent } from "../types/stepCompletedEvent.js"
import { createStepEventId } from "../types/stepEventId.js"
import { StepFailedEvent } from "../types/stepFailedEvent.js"
import type { StepStartedEvent } from "../types/stepStartedEvent.js"

import { systemNow, toIsoString } from "./systemClock.js"
import { getWorkflowContext, runWithStepContext } from "./workflowContext.js"

// The event input field is the journal's canonical JSON value type.
type CanonicalValue = StepStartedEvent["input"]

export type StepParams<Input extends CanonicalValue, Output extends CanonicalValue> = {
    readonly name: string
    readonly input: Input
    readonly run: (input: Input) => Output | Promise<Output>
}

export async function step<Input extends CanonicalValue, Output extends CanonicalValue>({ name, input, run }: StepParams<Input, Output>): Promise<Output> {
    const context = getWorkflowContext()

    const stepId = context.idGenerator.next({ namespace: "step" })

    const existingCompletedEvent = await context.journalStore.get({
        runId: context.runId,
        eventId: createStepEventId({ type: "step.completed", stepId })
    })

    if (existingCompletedEvent?.type === "step.completed") {
        return existingCompletedEvent.output as Output
    }

    const existingStartedEvent = await context.journalStore.get({
        runId: context.runId,
        eventId: createStepEventId({ type: "step.started", stepId })
    })

    if (!existingStartedEvent) {
        const startedAt = systemNow()
        const event: StepStartedEvent = {
            eventId: createStepEventId({ type: "step.started", stepId }),
            type: "step.started",
            stepId,
            name,
            startedAt: toIsoString(startedAt),
            input
        }

        await context.journalStore.append({
            runId: context.runId,
            event
        })
    }

    let value: Output
    try {
        value = await runWithStepContext(() => run(input))
    } catch (error) {
        const failedAt = systemNow()
        const failedEvent: StepFailedEvent = {
            eventId: createStepEventId({ type: "step.failed", stepId }),
            type: "step.failed",
            stepId,
            name,
            failedAt: toIsoString(failedAt),
            error: error instanceof Error ? { name: error.name, message: error.message } : { name: "Error", message: String(error) }
        }

        await context.journalStore.append({
            runId: context.runId,
            event: failedEvent
        })

        context.logicalClock.advanceTo(failedAt)

        throw error
    }

    const completedAt = systemNow()
    const completedEvent: StepCompletedEvent = {
        eventId: createStepEventId({ type: "step.completed", stepId }),
        type: "step.completed",
        stepId,
        name,
        completedAt: toIsoString(completedAt),
        output: value
    }

    await context.journalStore.append({
        runId: context.runId,
        event: completedEvent
    })

    context.logicalClock.advanceTo(completedAt)

    return value
}
