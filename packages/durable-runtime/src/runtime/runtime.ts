import type { JournalStore } from "../types/journalStore.js"
import type { RunStartedEvent } from "../types/runStartedEvent.js"

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

export class Runtime {
    constructor(private readonly options: RuntimeOptions) {}

    async start<Input extends CanonicalInput>({ runId, workflowName, input, workflow }: StartParams<Input>): Promise<void> {
        const event: RunStartedEvent = {
            type: "run.started",
            workflowName,
            startedAt: new Date().toISOString(),
            input
        }

        await this.options.journalStore.append({
            runId,
            event
        })
        await workflow(input)
    }
}
