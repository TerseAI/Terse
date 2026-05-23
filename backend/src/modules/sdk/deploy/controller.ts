import { RunHistoryActionType } from "@prisma/client"
import { Request, Response } from "express"
import { TriggerConfigData } from "terse-types/Configs"
import { SdkDeployResponseBody, SdkDeployStage, User, sdkDeployRequestBodySchema } from "terse-types/types"

import logger from "../../../common/logger"
import { getInputConfigInclude } from "../../../common/prismaIncludes"
import { markDeployFailed, markDeploySucceeded } from "../../../common/projectDeploys"
import { extractErrorMessage } from "../../../common/strings"
import { convertConfigTypeToInputConfigType } from "../../../common/typeConverters"
import { UrlValidationError, validateRemoteServerUrl } from "../../../common/urlValidation"
import { generateWebhookSecret } from "../../../common/webhookSecrets"
import { isSystemIntegration } from "../../../integrations/abstract/IntegrationRegistry"
import { db } from "../../../loaders/prisma"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../../../loaders/socket"
import { emitSessionEvent } from "../../../modules/agents/SessionEventBus"
import { buildTriggerMetadata, createTriggerConfig, setupAgentTriggers, tearDownAgentTriggers, validateUserOwnsIntegration } from "../../../modules/agents/controller"
import { createProjectScopedToken } from "../../../modules/auth/helpers/apiTokens"
import { SdkSandboxImageService } from "../../../services/SdkSandboxImageService"
import { AgentWithTriggerRelations, PrismaTransaction } from "../../../types/prisma"

export async function handleSdkDeploy(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" })

    const userId = user.id
    const organizationId = user.organizationId
    const prisma = db()

    const { remoteServerUrl, jobs, sourceZipBase64, projectId, cliVersion } = sdkDeployRequestBodySchema.parse(req.body)

    const sessionId = typeof req.headers["x-terse-session-id"] === "string" ? req.headers["x-terse-session-id"] : undefined
    const emitStage = (stage: SdkDeployStage) => {
        if (sessionId) emitSessionEvent(sessionId, { type: "deploy_stage", stage })
    }

    if (remoteServerUrl) {
        try {
            await validateRemoteServerUrl(remoteServerUrl)
        } catch (error) {
            if (error instanceof UrlValidationError) return res.status(400).json({ success: false, error: error.message })
            throw error
        }
    }

    const project = await db().projects.findUnique({
        where: { id: projectId, organization_id: organizationId },
        select: { name: true, signing_secret: true, api_tokens: { select: { id: true }, take: 1 } }
    })

    if (!project) {
        return res.status(404).json({
            success: false,
            error: "Project not found. The project linked in terse.config.json no longer exists in this organization.",
            errorCode: "PROJECT_NOT_FOUND"
        })
    }

    const deploy = await prisma.project_deploys.create({
        data: { project_id: projectId, deployed_by_user_id: userId, status: "IN_PROGRESS" }
    })
    try {
        emitCacheInvalidationWithWildcard(organizationId, "projectDeploys", projectId)

        if (!sourceZipBase64 && !remoteServerUrl) {
            return res.status(400).json({ success: false, error: "sourceZipBase64 or remoteServerUrl is required" })
        } else if (sourceZipBase64 && remoteServerUrl) {
            return res.status(400).json({ success: false, error: "sourceZipBase64 and remoteServerUrl cannot be provided together" })
        }

        const results: SdkDeployResponseBody["results"] = []

        if (sourceZipBase64) {
            const sourceZipBuffer = parseSourceZipBuffer(sourceZipBase64)

            const preparedImages = await new SdkSandboxImageService().prepareFromSourceZip({
                zipBuffer: sourceZipBuffer,
                organizationId,
                cliVersion,
                onProgress: phase => {
                    emitStage(phase === "dependency_image" ? "BUILDING_DEPENDENCY_IMAGE" : "BUILDING_SOURCE_IMAGE")
                }
            })

            await prisma.project_deploys.update({
                where: { id: deploy.id },
                data: { sdk_source_image_id: preparedImages.sourceImageId }
            })
        }

        let signingSecretJustGenerated = false
        let newProjectApiKey: string | undefined
        if (remoteServerUrl) {
            await prisma.projects.update({ where: { id: projectId }, data: { remote_server_url: remoteServerUrl } })

            if (!project.signing_secret) {
                const signingSecret = generateWebhookSecret()
                await prisma.projects.update({ where: { id: projectId }, data: { signing_secret: signingSecret } })
                project.signing_secret = signingSecret
                signingSecretJustGenerated = true
            }

            if (project.api_tokens.length === 0) {
                const { rawToken } = await createProjectScopedToken({ projectId, projectName: project.name, organizationId, createdByUserId: userId })
                newProjectApiKey = rawToken
            }
        }

        emitStage("CONFIGURING_AUTOMATIONS")

        for (const job of jobs) {
            const existing: AgentWithTriggerRelations | null = await prisma.automations.findFirst({
                where: { name: job.jobName, organization_id: organizationId, project_id: projectId },
                include: { inputs: { include: getInputConfigInclude() } }
            })

            const isUpdate = !!existing
            let agent: AgentWithTriggerRelations
            try {
                agent = isUpdate
                    ? await updateExistingAutomation(prisma, existing, job.jobName, job.triggers, organizationId, userId)
                    : await createNewAutomation(prisma, job.jobName, job.triggers, organizationId, userId, projectId)
            } catch (error) {
                logger.error("Failed to create or update automation", { error })
                await markDeployFailed(prisma, deploy.id, error)
                emitCacheInvalidationWithWildcard(organizationId, "projectDeploys", projectId)
                return res.status(500).json({ success: false, error: "Failed to create or update automation" })
            }

            await setupAgentTriggers(agent)

            results.push({ jobName: job.jobName, automationId: agent.id, isUpdate, triggers: buildDeployResultTriggers(agent) })

            logger.info(`SDK deploy ${isUpdate ? "updated" : "created"} automation`, { automationId: agent.id, jobName: job.jobName, organizationId, triggerCount: job.triggers.length })
        }

        const deployedNames = new Set(jobs.map(j => j.jobName))
        const removed = await removeStaleAutomations(prisma, organizationId, deployedNames, projectId)

        const jobsAdded = results.filter(r => !r.isUpdate).length
        await markDeploySucceeded(
            prisma,
            deploy.id,
            jobs.map(j => j.jobName),
            jobsAdded,
            removed.length
        )

        emitCacheInvalidationWithKey(organizationId, "recentAgents")
        emitCacheInvalidationWithKey(organizationId, "agents")
        emitCacheInvalidationWithKey(organizationId, "organization-projects")
        emitCacheInvalidationWithWildcard(organizationId, "projectDeploys", projectId)
        emitCacheInvalidationWithWildcard(organizationId, "project", projectId)

        const response: SdkDeployResponseBody = {
            success: true,
            results,
            removed,
            signingSecret: signingSecretJustGenerated ? (project.signing_secret ?? undefined) : undefined,
            projectApiKey: newProjectApiKey
        }

        return res.status(200).json(response)
    } catch (error) {
        logger.error("SDK deploy failed", { error })
        await markDeployFailed(prisma, deploy.id, error)
        emitCacheInvalidationWithWildcard(organizationId, "projectDeploys", projectId)
        return res.status(500).json({ success: false, error: "Deploy failed", details: extractErrorMessage(error) })
    }
}

function parseSourceZipBuffer(sourceZipBase64: string): Buffer {
    const zipBuffer = Buffer.from(sourceZipBase64, "base64")
    if (zipBuffer.length === 0) throw new Error("sourceZipBase64 is empty")
    return zipBuffer
}

async function updateExistingAutomation(
    prisma: ReturnType<typeof db>,
    existing: AgentWithTriggerRelations,
    jobName: string,
    triggers: TriggerConfigData[],
    organizationId: string,
    userId: string
): Promise<AgentWithTriggerRelations> {
    const automationId = existing.id
    const preservedWebhookTokens = existing.inputs.filter(input => input.webhook_config).map(input => input.webhook_config!.webhook_token)
    await tearDownAgentTriggers(existing)

    return prisma.$transaction(async tx => {
        await tx.automation_inputs.deleteMany({ where: { automation_id: automationId } })
        await tx.automation_outputs.deleteMany({ where: { automation_id: automationId } })
        await tx.automations.update({ where: { id: automationId }, data: { name: jobName, is_active: true } })
        await createTriggersForAutomation(tx, automationId, triggers, organizationId, userId)
        await seedSdkNotificationSettings(tx, automationId)

        if (preservedWebhookTokens.length > 0) {
            const newWebhookConfigs = await tx.automation_webhook_configs.findMany({ where: { automation_input: { automation_id: automationId } } })
            for (let i = 0; i < newWebhookConfigs.length && i < preservedWebhookTokens.length; i++) {
                await tx.automation_webhook_configs.update({ where: { id: newWebhookConfigs[i].id }, data: { webhook_token: preservedWebhookTokens[i] } })
            }
        }

        return tx.automations.findFirstOrThrow({ where: { id: automationId }, include: { inputs: { include: getInputConfigInclude() } } })
    })
}

async function createNewAutomation(
    prisma: ReturnType<typeof db>,
    jobName: string,
    triggers: TriggerConfigData[],
    organizationId: string,
    userId: string,
    projectId: string
): Promise<AgentWithTriggerRelations> {
    return prisma.$transaction(async tx => {
        const newAgent = await tx.automations.create({
            data: { user_id: userId, organization_id: organizationId, name: jobName, is_active: true, require_approval: false, project_id: projectId }
        })

        await tx.automation_prompts.create({ data: { automation_id: newAgent.id, content: "[SDK]" } })
        await createTriggersForAutomation(tx, newAgent.id, triggers, organizationId, userId)
        await seedSdkNotificationSettings(tx, newAgent.id)

        return tx.automations.findFirstOrThrow({ where: { id: newAgent.id }, include: { inputs: { include: getInputConfigInclude() } } })
    })
}

const SDK_NOTIFICATION_ACTION_TYPES = [RunHistoryActionType.error, RunHistoryActionType.approve]

async function seedSdkNotificationSettings(tx: PrismaTransaction, automationId: string): Promise<void> {
    await tx.automation_notification_settings.upsert({
        where: { automation_id: automationId },
        update: { enabled: true, action_types: SDK_NOTIFICATION_ACTION_TYPES },
        create: { automation_id: automationId, enabled: true, action_types: SDK_NOTIFICATION_ACTION_TYPES }
    })
}

async function createTriggersForAutomation(tx: PrismaTransaction, automationId: string, triggers: TriggerConfigData[], organizationId: string, userId: string) {
    for (const trigger of triggers) {
        const integrationId = trigger.integrationId || "system"

        if (!isSystemIntegration(trigger.integrationType)) {
            const isOwner = await validateUserOwnsIntegration(organizationId, trigger.integrationType, integrationId)
            if (!isOwner) throw new Error(`Integration ${trigger.integrationType} not found or not owned by user`)
        }

        const newTrigger = await tx.automation_inputs.create({
            data: { automation_id: automationId, config_type: convertConfigTypeToInputConfigType(trigger.configType), integration_id: integrationId }
        })

        await createTriggerConfig(tx, newTrigger.id, { id: newTrigger.id, config: trigger }, userId)
    }
}

async function removeStaleAutomations(prisma: ReturnType<typeof db>, organizationId: string, deployedNames: Set<string>, projectId: string): Promise<{ id: string; name: string }[]> {
    const sdkAutomations = await prisma.automations.findMany({
        where: { organization_id: organizationId, project_id: projectId },
        select: { id: true, name: true }
    })

    const stale = sdkAutomations.filter(a => !deployedNames.has(a.name))
    if (stale.length === 0) return []

    const staleIds = stale.map(a => a.id)
    const staleWithTriggers = await prisma.automations.findMany({
        where: { id: { in: staleIds } },
        include: { inputs: { include: getInputConfigInclude() } }
    })

    for (const automation of staleWithTriggers) {
        await tearDownAgentTriggers(automation)
        logger.info("SDK deploy removed stale automation", { automationId: automation.id, name: automation.name, organizationId })
    }

    await prisma.automations.deleteMany({ where: { id: { in: staleIds }, organization_id: organizationId } })

    emitCacheInvalidationWithKey(organizationId, "recentAgents")
    emitCacheInvalidationWithKey(organizationId, "agents")
    emitCacheInvalidationWithKey(organizationId, "organization-projects")

    return stale.map(a => ({ id: a.id, name: a.name }))
}

function buildDeployResultTriggers(agent: AgentWithTriggerRelations): SdkDeployResponseBody["results"][number]["triggers"] {
    return agent.inputs.map(trigger => ({ id: trigger.id, ...buildTriggerMetadata(trigger) }))
}
