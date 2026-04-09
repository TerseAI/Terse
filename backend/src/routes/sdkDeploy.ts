import { Request, Response } from "express"
import { ConfigData } from "terse-types/Configs"
import { AgentOutput, AgentTrigger, SdkDeployResponseBody, User, sdkDeployRequestBodySchema } from "terse-types/types"

import { isSystemIntegration } from "../integrations/abstract/IntegrationRegistry"
import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey } from "../realtimeSocket"
import { uploadSdkDeployZip } from "../services/FileStorageService"
import { AgentWithTriggerRelations, PrismaTransaction } from "../types/prisma"
import { getInputConfigInclude } from "../utility/prismaIncludes"
import { extractErrorMessage } from "../utility/strings"
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
        const { jobs, sourceZipBase64, jobUrl } = sdkDeployRequestBodySchema.parse(req.body)

        if (!sourceZipBase64 && !jobUrl) {
            return res.status(400).json({ success: false, error: "sourceZipBase64 or jobUrl is required" })
        } else if (sourceZipBase64 && jobUrl) {
            return res.status(400).json({ success: false, error: "sourceZipBase64 and jobUrl cannot be provided together" })
        }

        const results: SdkDeployResponseBody["results"] = []
        const prisma = db()

        let gcsKey: string | undefined
        if (sourceZipBase64) {
            gcsKey = await uploadSourceZipToGcs(sourceZipBase64, res)
        }

        for (const job of jobs) {
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
                ? await updateExistingAutomation(prisma, existing, job.jobName, job.triggers, outputs, toolApprovals, organizationId, userId, gcsKey, jobUrl)
                : await createNewAutomation(prisma, job.jobName, job.triggers, outputs, toolApprovals, organizationId, userId, gcsKey, jobUrl)

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

        const response: SdkDeployResponseBody = { success: true, results, removed }

        return res.status(200).json(response)
    } catch (error) {
        logger.error("SDK deploy failed", { error, userId })
        return res.status(500).json({
            success: false,
            error: "Deploy failed",
            details: extractErrorMessage(error)
        })
    }
}

async function uploadSourceZipToGcs(sourceZipBase64: string, res: Response): Promise<string> {
    const zipBuffer = Buffer.from(sourceZipBase64, "base64")
    if (zipBuffer.length === 0) {
        res.status(400).json({ success: false, error: "sourceZipBase64 is empty" })
        throw new Error("sourceZipBase64 is empty")
    }

    // Upload zip (content-addressed by SHA-256, deduped across deploys).
    // TODO: On re-deploy with changed code the old blob is orphaned in GCS. Add a
    // cleanup job or reference-counting to reclaim stale zips.
    const gcsKey = await uploadSdkDeployZip(zipBuffer)
    return gcsKey
}

async function updateExistingAutomation(
    prisma: ReturnType<typeof db>,
    existing: AgentWithTriggerRelations,
    jobName: string,
    triggers: ConfigData[],
    outputs: ConfigData[],
    toolApprovals: string[],
    organizationId: string,
    userId: string,
    gcsKey?: string,
    jobUrl?: string
): Promise<AgentWithTriggerRelations> {
    const automationId = existing.id

    // Preserve webhook tokens so URLs stay stable across redeploys
    const preservedWebhookTokens = existing.inputs.filter(input => input.webhook_config).map(input => input.webhook_config!.webhook_token)

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
            update: { content: "[SDK]", source_code_gcs_key: gcsKey, job_url: jobUrl },
            create: {
                automation_id: automationId,
                content: "[SDK]",
                source_code_gcs_key: gcsKey,
                job_url: jobUrl
            }
        })

        await persistToolApprovals(tx, automationId, toolApprovals, { replaceExisting: true })

        await createTriggersForAutomation(tx, automationId, triggers, organizationId, userId)
        await createOutputsForAutomation(tx, automationId, outputs, organizationId, userId)

        // This is a hack to preserve webhook tokens so URLs don't change on redeploy.
        // The right way to do this is to have some stable ids for the triggers so we can upsert. But that's a bigger change.
        // TODO: Figure out a way to upsert here and prevent this workaround.
        if (preservedWebhookTokens.length > 0) {
            const newWebhookConfigs = await tx.automation_webhook_configs.findMany({
                where: { automation_input: { automation_id: automationId } }
            })
            for (let i = 0; i < newWebhookConfigs.length && i < preservedWebhookTokens.length; i++) {
                await tx.automation_webhook_configs.update({
                    where: { id: newWebhookConfigs[i].id },
                    data: { webhook_token: preservedWebhookTokens[i] }
                })
            }
        }

        return tx.automations.findFirstOrThrow({
            where: { id: automationId },
            include: { inputs: { include: getInputConfigInclude() } }
        })
    })
}

async function createNewAutomation(
    prisma: ReturnType<typeof db>,
    jobName: string,
    triggers: ConfigData[],
    outputs: ConfigData[],
    toolApprovals: string[],
    organizationId: string,
    userId: string,
    gcsKey?: string,
    jobUrl?: string
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
                source_code_gcs_key: gcsKey,
                job_url: jobUrl
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

async function createTriggersForAutomation(tx: PrismaTransaction, automationId: string, triggers: ConfigData[], organizationId: string, userId: string) {
    for (const trigger of triggers) {
        const integrationId = trigger.integrationId || "system"

        if (!isSystemIntegration(trigger.integrationType)) {
            const isOwner = await validateUserOwnsIntegration(organizationId, trigger.integrationType, integrationId)
            if (!isOwner) {
                throw new Error(`Integration ${trigger.integrationType} not found or not owned by user`)
            }
        }

        const newTrigger = await tx.automation_inputs.create({
            data: {
                automation_id: automationId,
                config_type: convertConfigTypeToInputConfigType(trigger.configType),
                integration_id: integrationId
            }
        })

        await createTriggerConfig(tx, newTrigger.id, { id: newTrigger.id, config: trigger }, userId)
    }
}

async function createOutputsForAutomation(tx: PrismaTransaction, automationId: string, outputs: ConfigData[], organizationId: string, userId: string) {
    for (const output of outputs) {
        const integrationId = output.integrationId
        if (!integrationId) {
            throw new Error(`Integration ID is required for ${output.integrationType}`)
        }

        const isOwner = await validateUserOwnsIntegration(organizationId, output.integrationType, integrationId)
        if (!isOwner) {
            throw new Error(`Integration ${output.integrationType} not found or not owned by user`)
        }

        const newOutput = await tx.automation_outputs.create({
            data: {
                automation_id: automationId,
                config_type: convertConfigTypeToOutputConfigType(output.configType),
                integration_id: integrationId
            }
        })

        await createOutputConfig(tx, newOutput.id, output, userId)
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
