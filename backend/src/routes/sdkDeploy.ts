import { Request, Response } from "express"

import { isSystemIntegration } from "../integrations/abstract/IntegrationRegistry"
import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey } from "../realtimeSocket"
import { uploadSdkDeployZip } from "../services/FileStorageService"
import { AgentOutput, AgentTrigger, SdkDeployRequestBody, User } from "../shared/types"
import { AgentWithTriggerRelations, PrismaTransaction } from "../types/prisma"
import { getInputConfigInclude } from "../utility/prismaIncludes"
import { convertConfigTypeToInputConfigType, convertConfigTypeToOutputConfigType } from "../utility/typeConverters"

import { createOutputConfig, createTriggerConfig, persistToolApprovals, setupAgentTriggers, tearDownAgentTriggers, validateUserOwnsIntegration } from "./agents"

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

            const outputs = job.outputs ?? []
            const toolApprovals = job.toolApprovals ?? []

            const existing: AgentWithTriggerRelations | null = await prisma.automations.findFirst({
                where: {
                    name: job.jobName,
                    organization_id: organizationId,
                    source: "SDK"
                },
                include: { inputs: { include: getInputConfigInclude() } }
            })

            const isUpdate = !!existing
            const agent = isUpdate
                ? await updateExistingAutomation(prisma, existing, job.jobName, job.triggers, outputs, toolApprovals, organizationId, userId, gcsKey)
                : await createNewAutomation(prisma, job.jobName, job.triggers, outputs, toolApprovals, organizationId, userId, gcsKey)

            await setupAgentTriggers(agent)

            results.push({ jobName: job.jobName, automationId: agent.id, isUpdate })

            logger.info(`SDK deploy ${isUpdate ? "updated" : "created"} automation`, {
                automationId: agent.id,
                jobName: job.jobName,
                organizationId,
                triggerCount: job.triggers.length
            })
        }

        // Delete any SDK automations not in this deploy
        const deployedNames = new Set(jobs.map(j => j.jobName))
        const removed = await removeStaleAutomations(prisma, organizationId, deployedNames)

        emitCacheInvalidationWithKey(organizationId, "recentAgents")
        emitCacheInvalidationWithKey(organizationId, "agents")

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
    existing: AgentWithTriggerRelations,
    jobName: string,
    triggers: AgentTrigger[],
    outputs: AgentOutput[],
    toolApprovals: string[],
    organizationId: string,
    userId: string,
    gcsKey: string
): Promise<AgentWithTriggerRelations> {
    const automationId = existing.id

    await tearDownAgentTriggers(existing)

    return prisma.$transaction(async tx => {
        await tx.automation_inputs.deleteMany({
            where: { automation_id: automationId }
        })

        await tx.automation_outputs.deleteMany({
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

        await persistToolApprovals(tx, automationId, toolApprovals, { replaceExisting: true })

        await createTriggersForAutomation(tx, automationId, triggers, organizationId, userId)
        await createOutputsForAutomation(tx, automationId, outputs, organizationId, userId)

        return tx.automations.findFirstOrThrow({
            where: { id: automationId },
            include: { inputs: { include: getInputConfigInclude() } }
        })
    })
}

async function createNewAutomation(
    prisma: ReturnType<typeof db>,
    jobName: string,
    triggers: AgentTrigger[],
    outputs: AgentOutput[],
    toolApprovals: string[],
    organizationId: string,
    userId: string,
    gcsKey: string
): Promise<AgentWithTriggerRelations> {
    return prisma.$transaction(async tx => {
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

        await persistToolApprovals(tx, newAgent.id, toolApprovals)

        await createTriggersForAutomation(tx, newAgent.id, triggers, organizationId, userId)
        await createOutputsForAutomation(tx, newAgent.id, outputs, organizationId, userId)

        return tx.automations.findFirstOrThrow({
            where: { id: newAgent.id },
            include: { inputs: { include: getInputConfigInclude() } }
        })
    })
}

async function createTriggersForAutomation(tx: PrismaTransaction, automationId: string, triggers: AgentTrigger[], organizationId: string, userId: string) {
    for (const trigger of triggers) {
        const integrationId = trigger.config.integrationId || "system"

        if (!isSystemIntegration(trigger.config.integrationType)) {
            const isOwner = await validateUserOwnsIntegration(organizationId, trigger.config.integrationType, integrationId)
            if (!isOwner) {
                throw new Error(`Integration ${trigger.config.integrationType} not found or not owned by user`)
            }
        }

        const newTrigger = await tx.automation_inputs.create({
            data: {
                automation_id: automationId,
                config_type: convertConfigTypeToInputConfigType(trigger.config.configType),
                integration_id: integrationId
            }
        })

        await createTriggerConfig(tx, newTrigger.id, { ...trigger, id: newTrigger.id }, userId)
    }
}

async function createOutputsForAutomation(tx: PrismaTransaction, automationId: string, outputs: AgentOutput[], organizationId: string, userId: string) {
    for (const output of outputs) {
        const integrationId = output.config.integrationId
        if (!integrationId) {
            throw new Error(`Integration ID is required for ${output.config.integrationType}`)
        }

        const isOwner = await validateUserOwnsIntegration(organizationId, output.config.integrationType, integrationId)
        if (!isOwner) {
            throw new Error(`Integration ${output.config.integrationType} not found or not owned by user`)
        }

        const newOutput = await tx.automation_outputs.create({
            data: {
                automation_id: automationId,
                config_type: convertConfigTypeToOutputConfigType(output.config.configType),
                integration_id: integrationId
            }
        })

        await createOutputConfig(tx, newOutput.id, output.config, userId)
    }
}

async function removeStaleAutomations(prisma: ReturnType<typeof db>, organizationId: string, deployedNames: Set<string>): Promise<{ id: string; name: string }[]> {
    // Lightweight query to identify which automations are stale
    const sdkAutomations = await prisma.automations.findMany({
        where: { organization_id: organizationId, source: "SDK" },
        select: { id: true, name: true }
    })

    const stale = sdkAutomations.filter(a => !deployedNames.has(a.name))
    if (stale.length === 0) return []

    // Only fetch full relations for the stale ones that need trigger teardown
    const staleIds = stale.map(a => a.id)
    const staleWithTriggers = await prisma.automations.findMany({
        where: { id: { in: staleIds } },
        include: { inputs: { include: getInputConfigInclude() } }
    })

    for (const automation of staleWithTriggers) {
        await tearDownAgentTriggers(automation)
        logger.info("SDK deploy removed stale automation", {
            automationId: automation.id,
            name: automation.name,
            organizationId
        })
    }

    await prisma.automations.deleteMany({
        where: { id: { in: staleIds }, organization_id: organizationId }
    })

    emitCacheInvalidationWithKey(organizationId, "recentAgents")
    emitCacheInvalidationWithKey(organizationId, "agents")

    return stale.map(a => ({ id: a.id, name: a.name }))
}
