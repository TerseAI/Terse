import type { z } from "zod"

export type HookDefinition<RequestSchema extends z.ZodObject, ResolutionSchema extends z.ZodObject> = Readonly<{
    name: string
    request: RequestSchema
    resolution: ResolutionSchema
}>

export type AnyHookDefinition = HookDefinition<z.ZodObject, z.ZodObject>

export type HookRequest<Hook extends AnyHookDefinition> = z.input<Hook["request"]>

export type HookResolution<Hook extends AnyHookDefinition> = z.output<Hook["resolution"]>

export type HookResolutionInput<Hook extends AnyHookDefinition> = z.input<Hook["resolution"]>

export type DefineHookParams<RequestSchema extends z.ZodObject, ResolutionSchema extends z.ZodObject> = HookDefinition<RequestSchema, ResolutionSchema>

export function defineHook<RequestSchema extends z.ZodObject, ResolutionSchema extends z.ZodObject>(
    definition: DefineHookParams<RequestSchema, ResolutionSchema>
): HookDefinition<RequestSchema, ResolutionSchema> {
    if (definition.name.trim().length === 0) throw new TypeError("Hook name cannot be empty")

    return definition
}
