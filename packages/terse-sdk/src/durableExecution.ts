import { step as durableStep, getExecutionPhase } from "little-durable"
import type { StepCompletedEvent, StepStartedEvent } from "little-durable"

import { DurableOnlyError } from "./execution.js"

type CanonicalInput = StepStartedEvent["input"]
type CanonicalOutput = StepCompletedEvent["output"]

export type DurableStepParams<Input extends CanonicalInput, Output> = {
    readonly name: string
    readonly input: Input
    readonly run: (input: Input) => Output | Promise<Output>
}

type StoredStepOutput = { readonly type: "value"; readonly value: CanonicalOutput } | { readonly type: "undefined" }

/**
 * Runtime target for the `step(call())` source transform. The envelope lets a
 * normal JavaScript `void` result cross a journal that intentionally stores
 * JSON only; every non-undefined result is still validated by the journal.
 */
export async function __runDurableStep<Input extends CanonicalInput, Output>({ name, input, run }: DurableStepParams<Input, Output>): Promise<Output> {
    assertWorkflowPhase("step()")

    const stored = await durableStep<Input, StoredStepOutput>({
        name,
        input,
        run: async stepInput => {
            const value = await run(stepInput)
            if (value === undefined) return { type: "undefined" }
            return { type: "value", value: value as CanonicalOutput }
        }
    })

    return (stored.type === "undefined" ? undefined : stored.value) as Output
}

export async function runSdkStep<Input extends CanonicalInput, Output>(params: DurableStepParams<Input, Output>): Promise<Output> {
    if (getExecutionPhase() !== "workflow") return params.run(params.input)
    return __runDurableStep(params)
}

function assertWorkflowPhase(name: string): void {
    if (getExecutionPhase() !== "workflow") {
        throw new DurableOnlyError(`${name} is only available in durable jobs. Add \`durable: true\` to this job.`)
    }
}
