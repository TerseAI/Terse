import { z } from "zod"

export type DefineWorkflowParams<InputSchema extends z.ZodType> = {
    readonly input: InputSchema
    readonly run: (input: z.output<InputSchema>) => void | Promise<void>
}

export interface WorkflowDefinition<InputSchema extends z.ZodType = z.ZodType> {
    readonly input: InputSchema
    run(input: z.output<InputSchema>): void | Promise<void>
}

export type WorkflowInput<Workflow extends WorkflowDefinition> = z.input<Workflow["input"]>

export function defineWorkflow<InputSchema extends z.ZodType>({ input, run }: DefineWorkflowParams<InputSchema>): WorkflowDefinition<InputSchema> {
    return { input, run }
}
