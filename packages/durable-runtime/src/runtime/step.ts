import { StepCompletedEvent } from "../types/stepCompletedEvent.js"
import { createStepEventId } from "../types/stepEventId.js"
import { StepFailedEvent } from "../types/stepFailedEvent.js"
import type { StepStartedEvent } from "../types/stepStartedEvent.js"

import { getWorkflowContext } from "./workflowContext.js"

type CanonicalValue = StepStartedEvent["input"]

export type StepParams<Input extends CanonicalValue, Output extends CanonicalValue> = {
    readonly name: string
    readonly input: Input
    readonly run: (input: Input) => Output | Promise<Output>
}

export async function step<Input extends CanonicalValue, Output extends CanonicalValue>({ name, input, run }: StepParams<Input, Output>): Promise<Output> {
    const context = getWorkflowContext()

    const stepId = context.idGenerator.next({ namespace: "step" })
    const event: StepStartedEvent = {
        eventId: createStepEventId({ type: "step.started", stepId }),
        type: "step.started",
        stepId,
        name,
        startedAt: new Date().toISOString(),
        input
    }

    await context.journalStore.append({
        runId: context.runId,
        event
    })

    let value: Output
    try {
        value = await run(input)
    } catch (error) {
        const failedEvent: StepFailedEvent = {
            eventId: createStepEventId({ type: "step.failed", stepId }),
            type: "step.failed",
            stepId,
            name,
            failedAt: new Date().toISOString(),
            error: error instanceof Error ? { name: error.name, message: error.message } : { name: "Error", message: String(error) }
        }

        await context.journalStore.append({
            runId: context.runId,
            event: failedEvent
        })

        throw error
    }

    const completedEvent: StepCompletedEvent = {
        eventId: createStepEventId({ type: "step.completed", stepId }),
        type: "step.completed",
        stepId,
        name,
        completedAt: new Date().toISOString(),
        output: value
    }

    await context.journalStore.append({
        runId: context.runId,
        event: completedEvent
    })

    return value
}
