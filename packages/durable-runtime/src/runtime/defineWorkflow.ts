import { z } from "zod"

export type DefineWorkflowParams<InputSchema extends z.ZodType> = {
    readonly name: string
    readonly input: InputSchema
    readonly run: (input: z.output<InputSchema>) => void | Promise<void>
}

export interface WorkflowDefinition<InputSchema extends z.ZodType = z.ZodType> {
    readonly name: string
    readonly input: InputSchema
    run(input: z.output<InputSchema>): void | Promise<void>
}

export type WorkflowInput<Workflow extends WorkflowDefinition> = z.input<Workflow["input"]>

export function defineWorkflow<InputSchema extends z.ZodType>({ name, input, run }: DefineWorkflowParams<InputSchema>): WorkflowDefinition<InputSchema> {
    if (name.trim().length === 0) throw new TypeError("Workflow name cannot be empty")
    return { name, input, run }
}
