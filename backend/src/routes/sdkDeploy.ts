import { Request, Response } from "express"

import { isSystemIntegration } from "../integrations/abstract/IntegrationRegistry"
import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey } from "../realtimeSocket"
import { uploadSdkDeployZip } from "../services/FileStorageService"
import { SdkDeployRequestBody, SdkDeployTrigger, User } from "../shared/types"
import { getInputConfigInclude } from "../utility/prismaIncludes"
import { convertConfigTypeToInputConfigType } from "../utility/typeConverters"

import { createTriggerConfig, setupAgentTriggers, tearDownAgentTriggers, validateUserOwnsIntegration } from "./agents"

export async function handleSdkDeploy(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const userId = user.id
    const organizationId = user.organizationId

    try {
        const { jobs, sourceZipBase64 } = req.body as SdkDeployRequestBody

        if (!jobs || jobs.length === 0 || !sourceZipBase64) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: jobs and sourceZipBase64 are required"
            })
        }

        const zipBuffer = Buffer.from(sourceZipBase64, "base64")
        if (zipBuffer.length === 0) {
            return res.status(400).json({ success: false, error: "sourceZipBase64 is empty" })
        }

        // Upload zip (content-addressed by SHA-256, deduped across deploys).
        // TODO: On re-deploy with changed code the old blob is orphaned in GCS. Add a
        // cleanup job or reference-counting to reclaim stale zips.
        const gcsKey = await uploadSdkDeployZip(zipBuffer)
        const prisma = db()

        const results: { jobName: string; automationId: string; isUpdate: boolean }[] = []

        for (const job of jobs) {
            if (!job.jobName || !job.triggers || job.triggers.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid job entry: jobName and triggers are required (got "${job.jobName}")`
                })
            }

            const existing = await prisma.automations.findFirst({
                where: {
                    name: job.jobName,
                    organization_id: organizationId,
                    source: "SDK"
                },
                include: { inputs: { include: getInputConfigInclude() } }
            })

            const isUpdate = !!existing
            const automationId = isUpdate
                ? await updateExistingAutomation(prisma, existing, job.jobName, job.triggers, organizationId, userId, gcsKey)
                : await createNewAutomation(prisma, job.jobName, job.triggers, organizationId, userId, gcsKey)

            await finalizeDeployment(prisma, automationId, organizationId)

            results.push({ jobName: job.jobName, automationId, isUpdate })

            logger.info(`SDK deploy ${isUpdate ? "updated" : "created"} automation`, {
                automationId,
                jobName: job.jobName,
                organizationId,
                triggerCount: job.triggers.length
            })
        }

        // Delete any SDK automations not in this deploy
        const deployedNames = new Set(jobs.map(j => j.jobName))
        const removed = await removeStaleAutomations(prisma, organizationId, deployedNames)

        return res.status(200).json({ success: true, results, removed })
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

async function removeStaleAutomations(prisma: ReturnType<typeof db>, organizationId: string, deployedNames: Set<string>): Promise<{ id: string; name: string }[]> {
    const sdkAutomations = await prisma.automations.findMany({
        where: { organization_id: organizationId, source: "SDK" },
        include: { inputs: { include: getInputConfigInclude() } }
    })

    const stale = sdkAutomations.filter(a => !deployedNames.has(a.name))

    for (const automation of stale) {
        await tearDownAgentTriggers(automation)
        await prisma.automations.deleteMany({
            where: { id: automation.id, organization_id: organizationId }
        })
        logger.info("SDK deploy removed stale automation", {
            automationId: automation.id,
            name: automation.name,
            organizationId
        })
    }

    if (stale.length > 0) {
        emitCacheInvalidationWithKey(organizationId, "recentAgents")
        emitCacheInvalidationWithKey(organizationId, "agents")
    }

    return stale.map(a => ({ id: a.id, name: a.name }))
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
