import { z } from "zod"

import { ConfigType, configTypeEnum } from "./Configs"

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
