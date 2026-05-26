import { z } from "zod"

import { ConfigType, configTypeEnum } from "./Configs"

export const toolDefinitionSchema = z.object({
    name: z.string(),
    displayName: z.string(),
    description: z.string(),
    integration: z.string(),
    isReadOnly: z.boolean(),
    supportsApproval: z.boolean()
})

export type ToolDefinition = z.infer<typeof toolDefinitionSchema>

export const toolDefinitionsResponseSchema = z.object({
    tools: z.array(toolDefinitionSchema)
})

export type ToolDefinitionsResponse = z.infer<typeof toolDefinitionsResponseSchema>

export type TerseToolSource = "skill"

export interface TerseTool {
    name: string
    displayName: string
    description: string
    isReadOnly: boolean
    integration: string
    source: TerseToolSource
    configType: ConfigType
}

export interface GetToolsThatRequireApprovalsRequest {
    skills: ConfigType[]
}

export const getToolsThatRequireApprovalsRequestSchema = z.object({
    skills: z.array(configTypeEnum)
})

export interface GetToolsThatRequireApprovalsResponse {
    tools: TerseTool[]
}
