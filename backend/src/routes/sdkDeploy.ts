import { Request, Response } from "express"
import { SkillConfigData, TriggerConfigData } from "terse-types/Configs"
import { SdkDeployResponseBody, User, sdkDeployRequestBodySchema } from "terse-types/types"

import { emitSessionEvent } from "../agent/SessionEventBus"
import { isSystemIntegration } from "../integrations/abstract/IntegrationRegistry"
import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { uploadSdkDeployZip } from "../services/FileStorageService"
import { SdkSandboxImageService } from "../services/SdkSandboxImageService"
import { AgentWithTriggerRelations, PrismaTransaction } from "../types/prisma"
import { createProjectScopedToken } from "../utility/apiTokens"
import { getInputConfigInclude } from "../utility/prismaIncludes"
import { extractErrorMessage } from "../utility/strings"
import { convertConfigTypeToInputConfigType, convertConfigTypeToOutputConfigType } from "../utility/typeConverters"
import { UrlValidationError, validateRemoteServerUrl } from "../utility/urlValidation"
import { generateWebhookSecret } from "../utility/webhookSecrets"

import { createTriggerConfig, setupAgentTriggers, tearDownAgentTriggers, validateUserOwnsIntegration } from "./agents"

export async function handleSdkDeploy(req: Request, res: Response) {
    try {
        await handleSdkDeployInternal(req, res)
    } catch (error) {
        logger.error("SDK deploy failed", { error })
        return res.status(500).json({
            success: false,
            error: "Deploy failed",
            details: extractErrorMessage(error)
        })
    }
}

async function handleSdkDeployInternal(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const userId = user.id
    const organizationId = user.organizationId
    const sessionId = typeof req.headers["x-terse-session-id"] === "string" ? req.headers["x-terse-session-id"] : undefined

    const emitStage = (stage: import("terse-types/types").SdkDeployStage) => {
        if (sessionId) emitSessionEvent(sessionId, { type: "deploy_stage", stage })
    }

    const { remoteServerUrl, jobs, sourceZipBase64 } = sdkDeployRequestBodySchema.parse(req.body)

    if (remoteServerUrl) {
        try {
            await validateRemoteServerUrl(remoteServerUrl)
        } catch (error) {
            if (error instanceof UrlValidationError) {
                return res.status(400).json({ success: false, error: error.message })
            }
            throw error
        }
    }

<<<<<<< Updated upstream
    const { remoteServerUrl, jobs, sourceZipBase64, projectId } = sdkDeployRequestBodySchema.parse(req.body)

    const project = await db().projects.findUnique({
        where: {
            id: projectId,
            organization_id: organizationId
        },
        select: {
            name: true,
            signing_secret: true,
            api_tokens: { select: { id: true }, take: 1 }
        }
    })

    if (!project) {
        return res.status(404).json({
            success: false,
            error: "Project not found. The project linked in terse.config.json no longer exists in this organization.",
            errorCode: "PROJECT_NOT_FOUND"
        })
=======
    try {
        const results: SdkDeployResponseBody["results"] = []
        const prisma = db()

        let sourceZipBuffer: Buffer | undefined
        let gcsKey: string | undefined
        let currentSdkSourceImageId: string | undefined
        if (sourceZipBase64) {
            emitStage("UPLOADING_SOURCE")
            sourceZipBuffer = parseSourceZipBuffer(sourceZipBase64)
            gcsKey = await uploadSourceZipToGcs(sourceZipBuffer)

            const preparedImages = await new SdkSandboxImageService().prepareFromSourceZip({
                zipBuffer: sourceZipBuffer,
                gcsKey,
                organizationId,
                onProgress: phase => {
                    emitStage(phase === "dependency_image" ? "BUILDING_DEPENDENCY_IMAGE" : "BUILDING_SOURCE_IMAGE")
                }
            })
            currentSdkSourceImageId = preparedImages.sourceImageId
        }

        emitStage("CONFIGURING_AUTOMATIONS")

        for (const job of jobs) {
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
                ? await updateExistingAutomation(prisma, existing, job.jobName, job.triggers, organizationId, userId, {
                      currentSdkSourceImageId,
                      gcsKey,
                      remoteServerUrl
                  })
                : await createNewAutomation(prisma, job.jobName, job.triggers, organizationId, userId, {
                      currentSdkSourceImageId,
                      gcsKey,
                      remoteServerUrl
                  })

            await setupAgentTriggers(agent)

            const prompt = await prisma.automation_prompts.findUnique({ where: { automation_id: agent.id }, select: { signing_secret: true } })

            results.push({
                jobName: job.jobName,
                automationId: agent.id,
                isUpdate,
                signingSecret: prompt?.signing_secret ?? undefined
            })

            emitCacheInvalidationWithWildcard(organizationId, "agentFiles", agent.id)
            emitCacheInvalidationWithWildcard(organizationId, "agentFileContent", agent.id)

            logger.info(`SDK deploy ${isUpdate ? "updated" : "created"} automation`, {
                automationId: agent.id,
                jobName: job.jobName,
                organizationId,
                triggerCount: job.triggers.length
            })
        }

        const deployedNames = new Set(jobs.map(j => j.jobName))
        const removed = await removeStaleAutomations(prisma, organizationId, deployedNames)

        emitCacheInvalidationWithKey(organizationId, "recentAgents")
        emitCacheInvalidationWithKey(organizationId, "agents")

        const response: SdkDeployResponseBody = { success: true, results, removed }
        return res.status(200).json(response)
    } catch (error) {
        logger.error("SDK deploy failed", { error, userId })
        return res.status(500).json({ success: false, error: "Deploy failed", details: extractErrorMessage(error) })
>>>>>>> Stashed changes
    }

    if (!sourceZipBase64 && !remoteServerUrl) {
        return res.status(400).json({ success: false, error: "sourceZipBase64 or remoteServerUrl is required" })
    } else if (sourceZipBase64 && remoteServerUrl) {
        return res.status(400).json({ success: false, error: "sourceZipBase64 and remoteServerUrl cannot be provided together" })
    }

    if (remoteServerUrl) {
        try {
            await validateRemoteServerUrl(remoteServerUrl)
        } catch (error) {
            if (error instanceof UrlValidationError) {
                return res.status(400).json({ success: false, error: error.message })
            }
            throw error
        }
    }

    const results: SdkDeployResponseBody["results"] = []
    const prisma = db()

    let sourceZipBuffer: Buffer | undefined
    let gcsKey: string | undefined
    let currentSdkSourceImageId: string | undefined
    if (sourceZipBase64) {
        sourceZipBuffer = parseSourceZipBuffer(sourceZipBase64, res)
        gcsKey = await uploadSourceZipToGcs(sourceZipBuffer)

        const preparedImages = await new SdkSandboxImageService().prepareFromSourceZip({
            zipBuffer: sourceZipBuffer,
            gcsKey,
            organizationId
        })
        currentSdkSourceImageId = preparedImages.sourceImageId
    }

    // Self hosted!
    let signingSecretJustGenerated = false
    let newProjectApiKey: string | undefined
    if (remoteServerUrl) {
        await prisma.projects.update({
            where: { id: projectId },
            data: {
                remote_server_url: remoteServerUrl
            }
        })

        // Signing secret and project-scoped API key are returned to the client
        // only on first generation. On subsequent deploys the user must rotate
        // from the dashboard to recover a lost credential.
        if (!project.signing_secret) {
            const signingSecret = generateWebhookSecret()
            await prisma.projects.update({
                where: { id: projectId },
                data: {
                    signing_secret: signingSecret
                }
            })
            project.signing_secret = signingSecret
            signingSecretJustGenerated = true
        }

        if (project.api_tokens.length === 0) {
            const { rawToken } = await createProjectScopedToken({
                projectId,
                projectName: project.name,
                organizationId,
                createdByUserId: userId
            })
            newProjectApiKey = rawToken
        }
    }

    const deploy = await prisma.project_deploys.create({
        data: {
            project_id: projectId,
            sdk_source_image_id: currentSdkSourceImageId,
            deployed_by_user_id: userId,
            status: "IN_PROGRESS"
        }
    })

    for (const job of jobs) {
        const existing: AgentWithTriggerRelations | null = await prisma.automations.findFirst({
            where: {
                name: job.jobName,
                organization_id: organizationId,
                source: "SDK",
                project_id: projectId
            },
            include: { inputs: { include: getInputConfigInclude() } }
        })

        const isUpdate = !!existing
        const agent = isUpdate
            ? await updateExistingAutomation(prisma, existing, job.jobName, job.triggers, organizationId, userId)
            : await createNewAutomation(prisma, job.jobName, job.triggers, organizationId, userId, projectId)

        await setupAgentTriggers(agent)

        results.push({
            jobName: job.jobName,
            automationId: agent.id,
            isUpdate
        })

        emitCacheInvalidationWithWildcard(organizationId, "agentFiles", agent.id)
        emitCacheInvalidationWithWildcard(organizationId, "agentFileContent", agent.id)

        logger.info(`SDK deploy ${isUpdate ? "updated" : "created"} automation`, {
            automationId: agent.id,
            jobName: job.jobName,
            organizationId,
            triggerCount: job.triggers.length
        })
    }

    await prisma.project_deploys.update({
        where: { id: deploy.id },
        data: { status: "SUCCEEDED" }
    })

    // Delete any SDK automations not in this deploy
    const deployedNames = new Set(jobs.map(j => j.jobName))
    const removed = await removeStaleAutomations(prisma, organizationId, deployedNames, projectId)

    emitCacheInvalidationWithKey(organizationId, "recentAgents")
    emitCacheInvalidationWithKey(organizationId, "agents")

    const response: SdkDeployResponseBody = {
        success: true,
        results,
        removed,
        signingSecret: signingSecretJustGenerated ? (project.signing_secret ?? undefined) : undefined,
        projectApiKey: newProjectApiKey
    }

    return res.status(200).json(response)
}

function parseSourceZipBuffer(sourceZipBase64: string): Buffer {
    const zipBuffer = Buffer.from(sourceZipBase64, "base64")
    if (zipBuffer.length === 0) {
        throw new Error("sourceZipBase64 is empty")
    }
    return zipBuffer
}

async function uploadSourceZipToGcs(zipBuffer: Buffer): Promise<string> {
    // Upload zip (content-addressed by SHA-256, deduped across deploys).
    // TODO: On re-deploy with changed code the old blob is orphaned in GCS. Add a
    // cleanup job or reference-counting to reclaim stale zips.
    return uploadSdkDeployZip(zipBuffer)
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

        await createTriggersForAutomation(tx, automationId, triggers, organizationId, userId)

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
    triggers: TriggerConfigData[],
    organizationId: string,
    userId: string,
    projectId: string
): Promise<AgentWithTriggerRelations> {
    return prisma.$transaction(async tx => {
        const newAgent = await tx.automations.create({
            data: {
                user_id: userId,
                organization_id: organizationId,
                name: jobName,
                is_active: true,
                require_approval: false,
                source: "SDK",
                project_id: projectId
            }
        })

        // generateWebhookSecret()

        await tx.automation_prompts.create({
            data: {
                automation_id: newAgent.id,
                content: "[SDK]"
            }
        })

        await createTriggersForAutomation(tx, newAgent.id, triggers, organizationId, userId)

        return tx.automations.findFirstOrThrow({
            where: { id: newAgent.id },
            include: { inputs: { include: getInputConfigInclude() } }
        })
    })
}

async function createTriggersForAutomation(tx: PrismaTransaction, automationId: string, triggers: TriggerConfigData[], organizationId: string, userId: string) {
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

// We may decide to bring this back! Structure still TBD
// async function createOutputsForAutomation(tx: PrismaTransaction, automationId: string, outputs: SkillConfigData[], organizationId: string, userId: string) {
//     for (const output of outputs) {
//         const integrationId = output.integrationId
//         if (!integrationId) {
//             throw new Error(`Integration ID is required for ${output.integrationType}`)
//         }

//         const isOwner = await validateUserOwnsIntegration(organizationId, output.integrationType, integrationId)
//         if (!isOwner) {
//             throw new Error(`Integration ${output.integrationType} not found or not owned by user`)
//         }

//         const newOutput = await tx.automation_outputs.create({
//             data: {
//                 automation_id: automationId,
//                 config_type: convertConfigTypeToOutputConfigType(output.configType),
//                 integration_id: integrationId
//             }
//         })

//         await createOutputConfig(tx, newOutput.id, output, userId)
//     }
// }

async function removeStaleAutomations(prisma: ReturnType<typeof db>, organizationId: string, deployedNames: Set<string>, projectId: string): Promise<{ id: string; name: string }[]> {
    // Lightweight query to identify which automations are stale
    const sdkAutomations = await prisma.automations.findMany({
        where: { organization_id: organizationId, source: "SDK", project_id: projectId },
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
