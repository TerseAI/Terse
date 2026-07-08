import { ApiRoutes, type ToolDefinition, ToolDefinitions, isValidToolName, stripZodJsonSchemaMetadata, toolDefinitionsResponseSchema } from "terse-types"
import { z } from "zod"

import { fetchWithAuth } from "./api.js"
import { CliError } from "./cliError.js"

export async function fetchToolDetails(apiKey: string): Promise<ToolDetails[]> {
    const raw = await fetchWithAuth<unknown>(ApiRoutes.SDK.TOOL_DEFINITIONS, apiKey)
    const parsed = toolDefinitionsResponseSchema.safeParse(raw)
    if (!parsed.success) {
        throw new CliError("tool_definitions_malformed", "The tool definitions returned by the Terse backend did not match the expected shape.", {
            detail: parsed.error.message
        })
    }
    return parsed.data.tools.map(buildToolDetails)
}

function buildToolDetails(def: ToolDefinition): ToolDetails {
    const schemas = isValidToolName(def.name) ? ToolDefinitions[def.name] : null
    return {
        name: def.name,
        displayName: def.displayName,
        description: def.description,
        integration: def.integration,
        isReadOnly: def.isReadOnly,
        supportsApproval: def.supportsApproval,
        inputSchema: schemas ? toJsonSchema(schemas.inputSchema) : null,
        outputSchema: schemas ? toJsonSchema(schemas.outputSchema) : null
    }
}

function toJsonSchema(schema: z.ZodType): unknown {
    const jsonSchema = z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any" })
    delete jsonSchema.$schema
    return stripZodJsonSchemaMetadata(jsonSchema)
}

export interface ToolDetails {
    readonly name: string
    readonly displayName: string
    readonly description: string
    readonly integration: string
    readonly isReadOnly: boolean
    readonly supportsApproval: boolean
    readonly inputSchema: unknown
    readonly outputSchema: unknown
}
