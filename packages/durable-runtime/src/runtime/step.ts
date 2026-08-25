import type { StepStartedEvent } from "../types/stepStartedEvent.js"
import { getWorkflowContext } from "./workflowContext.js"

type CanonicalValue = StepStartedEvent["input"]

export type StepParams<Input extends CanonicalValue, Output extends CanonicalValue> = {
    readonly name: string
    readonly input: Input
    readonly run: (input: Input) => Output | Promise<Output>
}

export async function step<Input extends CanonicalValue, Output extends CanonicalValue>({
    name,
    input,
    run
}: StepParams<Input, Output>): Promise<Output> {
    const context = getWorkflowContext()

    const stepId = context.idGenerator.next({ namespace: "step" })
    const event: StepStartedEvent = {
        eventId: `step.started:${stepId}`,
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

    return run(input)
}
