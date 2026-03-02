import { Request, Response } from "express"

import { isSystemIntegration } from "../integrations/abstract/IntegrationRegistry"
import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey } from "../realtimeSocket"
import { uploadSdkDeployZip } from "../services/FileStorageService"
import { User } from "../shared/types"
import { getInputConfigInclude } from "../utility/prismaIncludes"
import { convertConfigTypeToInputConfigType } from "../utility/typeConverters"

import { createTriggerConfig, setupAgentTriggers, tearDownAgentTriggers, validateUserOwnsIntegration } from "./agents"

interface SdkDeployTrigger {
    configType: string
    integrationType: string
    integrationId: string
    config: Record<string, unknown>
}

interface SdkDeployRequest {
    jobName: string
    triggers: SdkDeployTrigger[]
    webhookURL: string
    sourceZipBase64: string
}

export async function handleSdkDeploy(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const userId = user.id
    const organizationId = user.organizationId

    try {
        const { jobName, triggers, webhookURL, sourceZipBase64 } = req.body as SdkDeployRequest

        // Validate required fields
        if (!jobName || !triggers || triggers.length === 0 || !sourceZipBase64) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: jobName, triggers, and sourceZipBase64 are required"
            })
        }

        // Decode and validate the zip
        const zipBuffer = Buffer.from(sourceZipBase64, "base64")
        if (zipBuffer.length === 0) {
            return res.status(400).json({ success: false, error: "sourceZipBase64 is empty" })
        }

        // Upload zip first (content-addressed by SHA-256, deduped across jobs in the same package).
        // TODO: On re-deploy with changed code the old blob is orphaned in GCS. Add a
        // cleanup job or reference-counting to reclaim stale zips.
        const gcsKey = await uploadSdkDeployZip(zipBuffer)

        const prisma = db()

        // Check for existing SDK automation with same name in this org (upsert)
        const existing = await prisma.automations.findFirst({
            where: {
                name: jobName,
                organization_id: organizationId,
                source: "SDK"
            },
            include: {
                inputs: {
                    include: getInputConfigInclude()
                }
            }
        })

        const isUpdate = !!existing
        const automationId = isUpdate
            ? await updateExistingAutomation(prisma, existing, jobName, triggers, organizationId, userId, gcsKey)
            : await createNewAutomation(prisma, jobName, triggers, organizationId, userId, gcsKey)

        await finalizeDeployment(prisma, automationId, organizationId)

        logger.info(`SDK deploy ${isUpdate ? "updated" : "created"} automation`, {
            automationId,
            jobName,
            organizationId,
            triggerCount: triggers.length
        })

        return res.status(200).json({
            success: true,
            automationId,
            isUpdate
        })
    } catch (error) {
        logger.error("SDK deploy failed", { error, userId })
        return res.status(500).json({
            success: false,
            error: "Deploy failed",
            details: (error as Error).message
        })
    }
}

async function updateExistingAutomation(
    prisma: ReturnType<typeof db>,
    existing: any,
    jobName: string,
    triggers: SdkDeployTrigger[],
    organizationId: string,
    userId: string,
    gcsKey: string
): Promise<string> {
    const automationId = existing.id

    await prisma.$transaction(async tx => {
        await tearDownAgentTriggers(existing)

        await tx.automation_inputs.deleteMany({
            where: { automation_id: automationId }
        })

        await tx.automations.update({
            where: { id: automationId },
            data: {
                name: jobName,
                is_active: true
            }
        })

        await tx.automation_prompts.upsert({
            where: { automation_id: automationId },
            update: { content: "[SDK]", source_code_gcs_key: gcsKey },
            create: {
                automation_id: automationId,
                content: "[SDK]",
                source_code_gcs_key: gcsKey
            }
        })

        await createTriggersForAutomation(tx, automationId, triggers, organizationId, userId)
    })

    return automationId
}

async function createNewAutomation(prisma: ReturnType<typeof db>, jobName: string, triggers: SdkDeployTrigger[], organizationId: string, userId: string, gcsKey: string): Promise<string> {
    const result = await prisma.$transaction(async tx => {
        const newAgent = await tx.automations.create({
            data: {
                user_id: userId,
                organization_id: organizationId,
                name: jobName,
                is_active: true,
                require_approval: false,
                source: "SDK"
            }
        })

        await tx.automation_prompts.create({
            data: {
                automation_id: newAgent.id,
                content: "[SDK]",
                source_code_gcs_key: gcsKey
            }
        })

        await createTriggersForAutomation(tx, newAgent.id, triggers, organizationId, userId)

        return newAgent
    })

    return result.id
}

async function createTriggersForAutomation(tx: any, automationId: string, triggers: SdkDeployTrigger[], organizationId: string, userId: string) {
    for (const trigger of triggers) {
        const integrationId = trigger.integrationId || "system"

        if (!isSystemIntegration(trigger.integrationType as any)) {
            const isOwner = await validateUserOwnsIntegration(organizationId, trigger.integrationType as any, integrationId)
            if (!isOwner) {
                throw new Error(`Integration ${trigger.integrationType} not found or not owned by user`)
            }
        }

        const newTrigger = await tx.automation_inputs.create({
            data: {
                automation_id: automationId,
                config_type: convertConfigTypeToInputConfigType(trigger.configType as any),
                integration_id: integrationId
            }
        })

        const agentTrigger = {
            id: newTrigger.id,
            config: {
                ...trigger.config,
                configType: trigger.configType,
                integrationType: trigger.integrationType,
                integrationId: trigger.integrationId
            }
        }

        await createTriggerConfig(tx, newTrigger.id, agentTrigger as any, userId)
    }
}

async function finalizeDeployment(prisma: ReturnType<typeof db>, automationId: string, organizationId: string) {
    const agentWithRelations = await prisma.automations.findFirst({
        where: { id: automationId, organization_id: organizationId },
        include: {
            inputs: {
                include: getInputConfigInclude()
            }
        }
    })

    if (agentWithRelations) {
        await setupAgentTriggers(agentWithRelations)
    }

    emitCacheInvalidationWithKey(organizationId, "recentAgents")
    emitCacheInvalidationWithKey(organizationId, "agents")
}
