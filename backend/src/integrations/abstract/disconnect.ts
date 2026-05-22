import { InputConfigType, OutputConfigType } from "@prisma/client"
import { SkillConfigData } from "terse-types/Configs"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { PrismaTransaction } from "../../types/prisma"

export type MarkDisconnectedParams = {
    organizationId: string
    integrationId: string
    inputConfigTypes: InputConfigType[]
    outputConfigTypes: OutputConfigType[]
}

export type MarkDisconnectedResult = {
    inputsMarked: number
    outputsMarked: number
}

export async function markDependentAutomationsDisconnected(params: MarkDisconnectedParams, tx?: PrismaTransaction): Promise<MarkDisconnectedResult> {
    const { organizationId, integrationId, inputConfigTypes, outputConfigTypes } = params
    const now = new Date()
    const prisma = tx ?? db()

    const [inputsResult, outputsResult] = await Promise.all([
        inputConfigTypes.length === 0
            ? Promise.resolve({ count: 0 })
            : prisma.automation_inputs.updateMany({
                  where: {
                      integration_id: integrationId,
                      config_type: { in: inputConfigTypes },
                      disconnected_at: null,
                      automation: { organization_id: organizationId }
                  },
                  data: { disconnected_at: now }
              }),
        outputConfigTypes.length === 0
            ? Promise.resolve({ count: 0 })
            : prisma.automation_outputs.updateMany({
                  where: {
                      integration_id: integrationId,
                      config_type: { in: outputConfigTypes },
                      disconnected_at: null,
                      automation: { organization_id: organizationId }
                  },
                  data: { disconnected_at: now }
              })
    ])

    const result: MarkDisconnectedResult = { inputsMarked: inputsResult.count, outputsMarked: outputsResult.count }
    if (result.inputsMarked > 0 || result.outputsMarked > 0) {
        logger.info("Marked dependent automation configs as disconnected", { ...result, organizationId, integrationId })
    }
    return result
}

export async function filterDisconnectedSkills(skills: SkillConfigData[], organizationId: string): Promise<{ skills: SkillConfigData[]; dropped: SkillConfigData[] }> {
    if (skills.length === 0) return { skills, dropped: [] }

    const integrationIds = Array.from(new Set(skills.map(s => s.integrationId).filter(id => id !== "system")))
    if (integrationIds.length === 0) return { skills, dropped: [] }

    // For each non-system integrationId in the skill list, find whether at
    // least one undisconnected output still references it for this org. We
    // can't simply look up the integration row by ID because each integration
    // has its own table — but disconnected_at on automation_outputs is the
    // single source of truth for "this skill is now broken".
    const aliveOutputs = await db().automation_outputs.findMany({
        where: {
            integration_id: { in: integrationIds },
            disconnected_at: null,
            automation: { organization_id: organizationId }
        },
        select: { integration_id: true }
    })
    const aliveIntegrationIds = new Set(aliveOutputs.map(o => o.integration_id))

    const kept: SkillConfigData[] = []
    const dropped: SkillConfigData[] = []
    for (const skill of skills) {
        if (skill.integrationId === "system" || aliveIntegrationIds.has(skill.integrationId)) {
            kept.push(skill)
        } else {
            dropped.push(skill)
        }
    }
    return { skills: kept, dropped }
}

export function describeDroppedSkills(dropped: SkillConfigData[]): string {
    if (dropped.length === 0) return ""
    const summary = dropped.map(s => `${s.configType}${s.integrationId !== "system" ? ` (integration ${s.integrationId})` : ""}`).join(", ")
    return `[System note: the following skill(s) are unavailable because their integration was disconnected — do not attempt to use them: ${summary}]`
}
