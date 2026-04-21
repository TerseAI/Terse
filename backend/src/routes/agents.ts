import AdmZip from "adm-zip"
import { Request, Response } from "express"
import mime from "mime"
import { isValidToolName } from "terse-types"
import { ConfigData, WebMonitorConfig } from "terse-types/Configs"
import { IntegrationType } from "terse-types/Integrations"
import { Agent, AgentDraft, AgentFileContentResponse, AgentNotificationSettings, AgentTrigger, AgentUpdate, AgentsResponse, File, agentCreateSchema, agentUpdateSchema } from "terse-types/types"
import { version as uuidVersion, validate as validateUuid } from "uuid"

import { getMonitor } from "../integrations/WebMonitorIntegration"
import { INTEGRATION_REGISTRY, isSystemIntegration } from "../integrations/abstract/IntegrationRegistry"
import logger from "../logger"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { downloadSdkDeployZip } from "../services/FileStorageService"
import { TRIGGER_REGISTRY } from "../triggers/TriggerRegistry"
import { AgentWithNotificationSettingsRelations, AgentWithPromptRelations, AgentWithRelations, AgentWithTriggerRelations, PrismaTransaction } from "../types/prisma"
import { trackAgentCreated } from "../utility/analytics"
import { parsePageParams } from "../utility/pagination"
import { getInputConfigInclude, getOutputConfigInclude } from "../utility/prismaIncludes"
import { extractErrorMessage } from "../utility/strings"
import { convertConfigTypeToInputConfigType, convertConfigTypeToOutputConfigType, convertPrismaConfigToConfigData, convertPrismaOutputConfigToConfigData } from "../utility/typeConverters"
import { buildWebhookUrl } from "../utility/webhookUrl"

export function isUuidV4(s: string): boolean {
    return validateUuid(s) && uuidVersion(s) === 4
}

export async function createTriggerConfig(tx: PrismaTransaction, triggerId: string, config: AgentTrigger, userId: string): Promise<void> {
    logger.debug("🔵 [TRIGGER CONFIG] config", {
        triggerId,
        config: JSON.stringify(config, null, 2)
    })
    const trigger = TRIGGER_REGISTRY.find(trigger => trigger.configType === config.config.configType)
    if (!trigger) {
        throw new Error(`Trigger not found for integration type: ${config.config.configType}`)
    }
    await trigger.validateConfig(config.config, userId)
    await trigger.addTriggerToAgent(tx, triggerId, config.config)
}

export async function createOutputConfig(tx: PrismaTransaction, outputId: string, config: ConfigData, userId: string): Promise<void> {
    const output = OutputFactory.OUTPUT_REGISTRY.get(convertConfigTypeToOutputConfigType(config.configType))
    if (!output) {
        throw new Error(`Output not found for integration type: ${config.configType}`)
    }
    await output().validateConfig(config, userId)
    await output().addOutputToAgent(tx, outputId, config)
}

export async function validateUserOwnsIntegration(organizationId: string, integrationType: IntegrationType, integrationId: string): Promise<boolean> {
    // System integrations are not owned by a user
    if (isSystemIntegration(integrationType)) {
        return true
    }
    const integration = INTEGRATION_REGISTRY.find(integration => integration.integrationType === integrationType)
    if (!integration) {
        throw new Error(`Integration ${integrationType} not found`)
    }
    const instances = await integration.getInstancesForOrganization(organizationId)
    return instances.some(instance => instance.id === integrationId)
}

async function upsertNotificationSettings(tx: PrismaTransaction, automationId: string, userId: string, settings: AgentNotificationSettings | null): Promise<void> {
    let enabled
    let actionTypes
    if (!settings) {
        const defaultSettings = await db().user_notification_settings.findUnique({
            where: {
                user_id: userId
            }
        })
        if (!defaultSettings) {
            throw new Error(`Unable to find matching user notification setting for ${userId}`)
        }
        enabled = defaultSettings.agent_default_notifications.length > 0
        actionTypes = defaultSettings.agent_default_notifications
    } else {
        enabled = settings.enabled
        actionTypes = settings.actionTypes
    }
    await tx.automation_notification_settings.upsert({
        where: { automation_id: automationId },
        update: {
            enabled: enabled,
            action_types: actionTypes
        },
        create: {
            automation_id: automationId,
            enabled: enabled,
            action_types: actionTypes
        }
    })
}

export function validateAndDeduplicateToolApprovals(toolApprovals: string[]): string[] {
    // Deduplicate tool approvals to prevent unique constraint violations
    const uniqueToolApprovals = Array.from(new Set(toolApprovals))

    // Validate all tool names
    const invalidToolNames = uniqueToolApprovals.filter(toolName => !isValidToolName(toolName))
    if (invalidToolNames.length > 0) {
        throw new Error(`Invalid tool names: ${invalidToolNames.join(", ")}`)
    }

    return uniqueToolApprovals
}

export async function persistToolApprovals(tx: PrismaTransaction, automationId: string, toolApprovals: string[] | null, options?: { replaceExisting?: boolean }): Promise<void> {
    if (toolApprovals === undefined) {
        return
    }

    const uniqueToolApprovals = validateAndDeduplicateToolApprovals(toolApprovals ?? [])

    if (options?.replaceExisting) {
        await tx.automation_tool_approvals.deleteMany({
            where: { automation_id: automationId }
        })
    }

    if (uniqueToolApprovals.length > 0) {
        await tx.automation_tool_approvals.createMany({
            data: uniqueToolApprovals.map(toolName => ({
                automation_id: automationId,
                tool_name: toolName
            }))
        })
    }
}

export type ApplyAgentOptions = { createWithId?: string }

export async function applyAgentForUser(userId: string, organizationId: string, draft: AgentDraft, options?: ApplyAgentOptions): Promise<{ id: string }> {
    const { name, triggers, outputs, prompt, isActive = true, requireApproval = false, notificationSettings, toolApprovals } = draft

    logger.debug("Outputs from frontend", {
        outputs: JSON.stringify(outputs, null, 2),
        userId
    })
    logger.debug("Triggers from frontend", {
        triggers: JSON.stringify(triggers, null, 2),
        userId
    })
    logger.debug("Notification settings from frontend", {
        notificationSettings: JSON.stringify(notificationSettings, null, 2),
        userId
    })

    // Validate request
    if (!name || !triggers || triggers.length === 0 || !outputs || outputs.length === 0 || !prompt?.text) {
        throw new Error("Invalid request: missing required fields")
    }

    const prisma = db()

    const createWithId = options?.createWithId && isUuidV4(options.createWithId) ? options.createWithId : undefined

    // Create new agent
    const agent = await prisma.$transaction(async tx => {
        // Create agent
        const newAgent = await tx.automations.create({
            data: {
                ...(createWithId && { id: createWithId }),
                user_id: userId,
                organization_id: organizationId,
                name,
                is_active: isActive,
                require_approval: requireApproval
            }
        })

        // Create prompt
        await tx.automation_prompts.create({
            data: {
                automation_id: newAgent.id,
                content: prompt.text
            }
        })

        // Create triggers
        for (const trigger of triggers) {
            const integrationType = trigger.config.integrationType

            // Validate that user owns the integration (system integrations skip validation)
            const integrationId = trigger.config.integrationId
            if (!integrationId && !isSystemIntegration(integrationType)) {
                throw new Error(`Integration ID is required for ${trigger.config.integrationType}`)
            }

            const isOwner = await validateUserOwnsIntegration(organizationId, integrationType, integrationId || "system")
            if (!isOwner) {
                throw new Error(`Integration ${trigger.config.integrationType} not found or not owned by user`)
            }

            const newTrigger = await tx.automation_inputs.create({
                data: {
                    automation_id: newAgent.id,
                    config_type: convertConfigTypeToInputConfigType(trigger.config.configType),
                    // System integrations use 'system' as a sentinel integration ID
                    integration_id: integrationId || "system"
                }
            })

            // Create config record if provided
            await createTriggerConfig(tx, newTrigger.id, trigger, userId)
        }

        // Create outputs
        for (const output of outputs) {
            const outputIntegrationType = output.config.integrationType
            const outputConfigType = output.config.configType

            const outputIntegrationId = output.config.integrationId
            if (!outputIntegrationId) {
                throw new Error(`Integration ID is required for ${output.config.integrationType}`)
            }
            const isOwner = await validateUserOwnsIntegration(organizationId, outputIntegrationType, outputIntegrationId)
            if (!isOwner) {
                throw new Error(`Integration ${output.config.integrationType} not found or not owned by user`)
            }

            logger.debug("Output integration ID", { outputIntegrationId, userId })
            logger.debug("Output integration type", {
                outputIntegrationType,
                userId
            })
            logger.debug("Creating new output", {
                output: JSON.stringify(output, null, 2),
                userId
            })

            const newOutput = await tx.automation_outputs.create({
                data: {
                    automation_id: newAgent.id,
                    config_type: convertConfigTypeToOutputConfigType(outputConfigType),
                    integration_id: outputIntegrationId
                }
            })

            // Create config record if provided
            await createOutputConfig(tx, newOutput.id, output.config, userId)
        }

        await upsertNotificationSettings(tx, newAgent.id, userId, notificationSettings)

        // Create tool approvals if provided
        await persistToolApprovals(tx, newAgent.id, toolApprovals)

        return newAgent
    })

    const agentWithRelations: AgentWithTriggerRelations | null = await prisma.automations.findFirst({
        where: { id: agent.id, organization_id: organizationId },
        include: {
            inputs: {
                include: getInputConfigInclude()
            }
        }
    })

    if (!agentWithRelations) {
        throw new Error(`Agent not found: ${agent.id}`)
    }

    // Set up agent triggers
    await setupAgentTriggers(agentWithRelations)

    // Invalidate recent agents and agent list caches
    emitCacheInvalidationWithKey(organizationId, "recentAgents")
    emitCacheInvalidationWithKey(organizationId, "agents")

    // Track agent created analytics event
    trackAgentCreated(userId, {
        agentId: agent.id,
        agentName: name,
        triggerCount: triggers.length,
        outputCount: outputs.length,
        requiresApproval: requireApproval
    })

    return { id: agent.id }
}

export async function updateAgentForUser(userId: string, organizationId: string, agentId: string, update: Partial<AgentUpdate>): Promise<{ id: string }> {
    const { name, triggers, outputs, prompt, isActive, requireApproval, notificationSettings, toolApprovals } = update

    const prisma = db()
    const existingAgent: AgentWithTriggerRelations | null = await prisma.automations.findFirst({
        where: {
            id: agentId,
            organization_id: organizationId
        },
        include: {
            inputs: {
                include: getInputConfigInclude()
            }
        }
    })

    if (!existingAgent) {
        throw new Error("Agent not found")
    }

    // Update agent in transaction
    await prisma.$transaction(async tx => {
        // Update basic fields if provided
        if (name !== undefined || isActive !== undefined || requireApproval !== undefined) {
            const updateResult = await tx.automations.updateMany({
                where: {
                    id: agentId,
                    organization_id: organizationId
                },
                data: {
                    ...(name !== undefined && { name }),
                    ...(isActive !== undefined && { is_active: isActive }),
                    ...(requireApproval !== undefined && {
                        require_approval: requireApproval
                    })
                }
            })
            if (updateResult.count !== 1) {
                throw new Error("Agent not found or access denied")
            }
        }

        // Update prompt if provided
        if (prompt?.text) {
            await tx.automation_prompts.upsert({
                where: { automation_id: agentId },
                update: { content: prompt.text },
                create: {
                    automation_id: agentId,
                    content: prompt.text
                }
            })
        }

        // Update triggers if provided
        if (triggers && triggers.length > 0) {
            // Delete old triggers (configs cascade delete)
            await tx.automation_inputs.deleteMany({
                where: { automation_id: agentId }
            })
            await tearDownAgentTriggers(existingAgent)

            // Create new triggers
            for (const trigger of triggers) {
                const integrationType = trigger.config.integrationType

                // Validate that user owns the integration (system integrations skip validation)
                const integrationId = trigger.config.integrationId
                if (!integrationId && !isSystemIntegration(integrationType)) {
                    throw new Error(`Integration ID is required for ${trigger.config.integrationType}`)
                }

                const isOwner = await validateUserOwnsIntegration(organizationId, integrationType, integrationId || "system")
                if (!isOwner) {
                    throw new Error(`Integration ${trigger.config.integrationType} not found or not owned by user`)
                }

                const newTrigger = await tx.automation_inputs.create({
                    data: {
                        automation_id: agentId,
                        config_type: convertConfigTypeToInputConfigType(trigger.config.configType),
                        // System integrations use 'system' as a sentinel integration ID
                        integration_id: integrationId || "system"
                    }
                })

                // Create config record if provided
                await createTriggerConfig(tx, newTrigger.id, trigger, userId)
            }
        }

        // Update outputs if provided
        if (outputs && outputs.length > 0) {
            // Delete old outputs (configs cascade delete)
            await tx.automation_outputs.deleteMany({
                where: { automation_id: agentId }
            })

            // Create new outputs
            for (const output of outputs) {
                const outputIntegrationType = output.config.integrationType

                const outputConfigType = output.config.configType
                const outputIntegrationId = output.config.integrationId
                if (!outputIntegrationId) {
                    throw new Error(`Integration ID is required for ${output.config.integrationType}`)
                }

                const isOwner = await validateUserOwnsIntegration(organizationId, outputIntegrationType, outputIntegrationId)
                if (!isOwner) {
                    throw new Error(`Integration ${output.config.integrationType} not found or not owned by user`)
                }

                // Create new output
                const newOutput = await tx.automation_outputs.create({
                    data: {
                        automation_id: agentId,
                        config_type: convertConfigTypeToOutputConfigType(outputConfigType),
                        integration_id: outputIntegrationId
                    }
                })

                // Create config record if provided
                await createOutputConfig(tx, newOutput.id, output.config, userId)
            }
        }

        await upsertNotificationSettings(tx, agentId, userId, notificationSettings ?? null)

        // Update tool approvals if provided
        if (toolApprovals !== undefined) {
            await persistToolApprovals(tx, agentId, toolApprovals, { replaceExisting: true })
        }
    })

    const agentWithTriggerRelations: AgentWithTriggerRelations | null = await prisma.automations.findFirst({
        where: { id: agentId, organization_id: organizationId },
        include: {
            inputs: {
                include: getInputConfigInclude()
            }
        }
    })

    if (!agentWithTriggerRelations) {
        throw new Error(`Agent not found: ${agentId}`)
    }
    await setupAgentTriggers(agentWithTriggerRelations)

    // Invalidate recent agents cache
    emitCacheInvalidationWithKey(organizationId, "recentAgents")
    emitCacheInvalidationWithWildcard(organizationId, "agent", agentId)

    return { id: agentId }
}

// GET /agents - List all agents with pagination
export async function getUserAgents(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }
    const organizationId = req.session.user.organizationId

    // Parse pagination parameters (normalize to page/pageSize)
    const { page, pageSize, skip, take } = parsePageParams(req, 10, 100)

    // Optional filter by active status
    const isActive = req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined

    // Optional search by name
    const search = req.query.search as string | undefined

    try {
        const prisma = db()

        const where = {
            organization_id: organizationId,
            ...(isActive !== undefined && { is_active: isActive }),
            ...(search && {
                name: { contains: search, mode: "insensitive" as const }
            })
        }

        // Get total count for pagination

        const [total, agents] = await Promise.all([
            prisma.automations.count({ where }),
            prisma.automations.findMany({
                where,
                include: {
                    prompt: true,
                    inputs: {
                        include: getInputConfigInclude()
                    },
                    outputs: {
                        include: getOutputConfigInclude()
                    },
                    notification_settings: true,
                    tool_approvals: true
                },
                orderBy: { created_at: "desc" },
                skip,
                take
            })
        ])

        // Transform the data to match frontend format
        const response: AgentsResponse = {
            agents: await Promise.all(agents.map(agent => transformAgentToFrontendFormat(agent))),
            pagination: {
                page,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        }

        res.status(200).json(response)
    } catch (error) {
        logger.error("Error fetching agents", { error, organizationId })
        res.status(500).json({ error: "Failed to fetch agents" })
    }
}

// Type for raw SQL last event timestamp result
interface LastEventRow {
    automation_id: string
    last_timestamp: Date
}

// GET /agents/recent - Get recently modified agents with last event processed time
export async function getRecentAgents(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const organizationId = req.session.user.organizationId
    const limit = parseInt(req.query.limit as string) || 3

    try {
        const prisma = db()

        // Run agents query and last event timestamps query in parallel
        const [agents, lastEventRows] = await Promise.all([
            // Query 1: Get recently modified agents (without run_history_records)
            prisma.automations.findMany({
                where: {
                    organization_id: organizationId
                },
                include: {
                    prompt: true,
                    inputs: {
                        include: getInputConfigInclude()
                    },
                    outputs: {
                        include: getOutputConfigInclude()
                    },
                    tool_approvals: true
                },
                orderBy: { updated_at: "desc" },
                take: limit
            }) as Promise<AgentWithRelations[]>,

            // Query 2: Get last event timestamps using raw SQL with MAX() aggregation
            // This is more efficient than correlated subqueries
            prisma.$queryRaw<LastEventRow[]>`
                SELECT rhr.automation_id, MAX(rhr.timestamp) as last_timestamp
                FROM run_history_records rhr
                INNER JOIN automations a ON rhr.automation_id = a.id
                WHERE a.organization_id = ${organizationId}
                GROUP BY rhr.automation_id
            `
        ])

        // Build a map from automation_id to last timestamp
        const lastEventMap = new Map<string, Date>()
        for (const row of lastEventRows) {
            lastEventMap.set(row.automation_id, row.last_timestamp)
        }

        // Transform the data to match frontend format with timestamps
        const response = await Promise.all(
            agents.map(async agent => {
                const lastEventTimestamp = lastEventMap.get(agent.id)
                return {
                    ...(await transformAgentToFrontendFormat(agent)),
                    updatedAt: agent.updated_at.toISOString(),
                    lastEventProcessedAt: lastEventTimestamp ? lastEventTimestamp.toISOString() : null
                }
            })
        )

        res.status(200).json(response)
    } catch (error) {
        logger.error("Error fetching recent agents", { error, organizationId })
        res.status(500).json({ error: "Failed to fetch recent agents" })
    }
}

// GET /agents/:id - Get single agent by ID
export async function getUserAgent(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const organizationId = req.session.user.organizationId
    const agentId = req.params.id

    try {
        const agent: AgentWithRelations | null = await db().automations.findFirst({
            where: {
                id: agentId,
                organization_id: organizationId
            },
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                outputs: {
                    include: getOutputConfigInclude()
                },
                notification_settings: true,
                tool_approvals: true
            }
        })

        if (!agent) {
            res.status(404).json({ error: "Agent not found" })
            return
        }

        // Transform the data to match frontend format
        const response: Agent = await transformAgentToFrontendFormat(agent)

        res.status(200).json(response)
    } catch (error) {
        logger.error("Error fetching agent", { error, organizationId, agentId })
        res.status(500).json({ error: "Failed to fetch agent" })
    }
}

// POST /agents - Create a new agent
export async function createAgent(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const userId = req.session.user.id
    const organizationId = req.session.user.organizationId
    const { name, triggers, outputs, prompt, isActive, requireApproval, notificationSettings, toolApprovals } = agentCreateSchema.parse({ isActive: true, requireApproval: false, ...req.body })

    try {
        const { id } = await applyAgentForUser(userId, organizationId, {
            id: null,
            name,
            triggers,
            outputs,
            prompt,
            isActive,
            requireApproval,
            notificationSettings,
            createdByUserId: userId,
            toolApprovals
        })

        res.status(201).json({ success: true, id })
    } catch (error) {
        logger.error("Error creating agent", { error, userId })
        const details = extractErrorMessage(error)
        if (details === "Invalid request: missing required fields") {
            res.status(400).json({ error: details })
            return
        }
        res.status(500).json({ error: "Failed to create agent", details })
    }
}

// PATCH /agents/:id - Update an existing agent
export async function updateAgent(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const userId = req.session.user.id
    const organizationId = req.session.user.organizationId
    const agentId = req.params.id
    const update = agentUpdateSchema.parse(req.body)

    try {
        const { id } = await updateAgentForUser(userId, organizationId, agentId, update)
        res.status(200).json({ success: true, id })
    } catch (error) {
        logger.error("Error updating agent", { error, userId, agentId })
        res.status(500).json({
            error: "Failed to update agent",
            details: extractErrorMessage(error)
        })
    }
}

// DELETE /agents/:id - Delete an agent
export async function deleteAgent(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const userId = req.session.user.id
    const organizationId = req.session.user.organizationId
    const agentId = req.params.id

    try {
        const prisma = db()

        // Check if agent exists and belongs to user
        const existingAgent: AgentWithTriggerRelations | null = await prisma.automations.findFirst({
            where: {
                id: agentId,
                organization_id: organizationId
            },
            include: {
                inputs: {
                    include: getInputConfigInclude()
                }
            }
        })

        if (!existingAgent) {
            res.status(404).json({ error: "Agent not found" })
            return
        }
        await tearDownAgentTriggers(existingAgent)

        // Clean up orphaned records and delete agent in a single transaction
        await prisma.$transaction(async tx => {
            // Delete chat_raw_events for the builder chat session (no FK exists, chat_session_id is polymorphic)
            await tx.chat_raw_events.deleteMany({
                where: { chat_session_id: agentId }
            })

            const deleteResult = await tx.automations.deleteMany({
                where: {
                    id: agentId,
                    organization_id: organizationId
                }
            })
            if (deleteResult.count !== 1) {
                throw new Error("Agent not found during delete")
            }
        })

        // Invalidate recent agents cache
        emitCacheInvalidationWithKey(organizationId, "recentAgents")

        res.status(200).json({ success: true, message: "Agent deleted successfully" })
    } catch (error) {
        logger.error("Error deleting agent", { error, userId, agentId })
        res.status(500).json({
            error: "Failed to delete agent",
            details: extractErrorMessage(error)
        })
    }
}

function buildTriggerMetadata(trigger: AgentWithRelations["inputs"][number]): { metadata?: { webhookUrl: string } } {
    if (trigger.webhook_config) {
        return { metadata: { webhookUrl: buildWebhookUrl(trigger.webhook_config.webhook_token) } }
    }
    return {}
}

async function rehydrateTriggerConfig(trigger: AgentWithRelations["inputs"][number]): Promise<ConfigData> {
    const base = convertPrismaConfigToConfigData(trigger)
    const monitorId = trigger.webmonitor_config?.provider_monitor_id
    if (base.configType !== "webmonitor" || !monitorId) {
        return base
    }
    try {
        const { query, frequency, outputSchema } = await getMonitor(monitorId)
        return new WebMonitorConfig(query, frequency, outputSchema)
    } catch (error) {
        logger.warn("Failed to rehydrate WebMonitor config from Parallel API", { monitorId, error })
        return base
    }
}

// Helper function to transform AgentWithRelations to frontend Agent format
async function transformAgentToFrontendFormat(agent: AgentWithRelations & Partial<AgentWithNotificationSettingsRelations>): Promise<Agent> {
    const triggers = await Promise.all(
        agent.inputs.map(async trigger => ({
            id: trigger.id,
            config: await rehydrateTriggerConfig(trigger),
            ...buildTriggerMetadata(trigger)
        }))
    )
    return {
        id: agent.id,
        name: agent.name,
        isActive: agent.is_active,
        requireApproval: agent.require_approval ?? false,
        prompt: agent.prompt ? { text: agent.prompt.content, remoteServerUrl: agent.prompt.remote_server_url ?? undefined } : { text: "" },
        triggers,
        outputs: (agent.outputs ?? []).map(output => ({
            id: output.id,
            config: convertPrismaOutputConfigToConfigData(output)
        })),
        notificationSettings: agent.notification_settings
            ? {
                  enabled: agent.notification_settings.enabled,
                  actionTypes: agent.notification_settings.action_types
              }
            : null,
        toolApprovals: agent.tool_approvals.map((ta: any) => ta.tool_name),
        createdByUserId: agent.user_id,
        updatedAt: agent.updated_at.toISOString(),
        source: agent.source
    }
}

export async function setupAgentTriggers(agent: AgentWithTriggerRelations): Promise<void> {
    for (const trigger of agent.inputs) {
        try {
            // Convert prisma config to shared config data to get integration type
            const configData = convertPrismaConfigToConfigData(trigger)
            const integrationType = configData.integrationType

            // Find the integration from the registry
            const integration = INTEGRATION_REGISTRY.find(int => int.integrationType === integrationType)

            if (integration) {
                console.log({ trigger })
                await integration.setupAgentTrigger(trigger.integration_id, trigger)
                logger.info(`✅ Setup completed for ${trigger.config_type} trigger (ID: ${trigger.id})`, {
                    configType: trigger.config_type,
                    triggerId: trigger.id,
                    integrationId: trigger.integration_id
                })
            } else {
                logger.warn(`⚠️  No integration found for ${integrationType} (config: ${trigger.config_type}). Skipping setup.`, {
                    integrationType,
                    configType: trigger.config_type,
                    triggerId: trigger.id
                })
            }
        } catch (error) {
            logger.error(`❌ Error setting up ${trigger.config_type} trigger (ID: ${trigger.id})`, { error, configType: trigger.config_type, triggerId: trigger.id })
        }
    }
}

/**
 * Tears down setup for all triggers in an agent by calling teardownAgentTrigger on each integration.
 * Called before an agent is deleted.
 */
export async function tearDownAgentTriggers(agent: AgentWithTriggerRelations): Promise<void> {
    for (const trigger of agent.inputs) {
        try {
            // Convert prisma config to shared config data to get integration type
            const configData = convertPrismaConfigToConfigData(trigger)
            const integrationType = configData.integrationType

            // Find the integration from the registry
            const integration = INTEGRATION_REGISTRY.find(int => int.integrationType === integrationType)

            if (integration) {
                await integration.teardownAgentTrigger(trigger.integration_id, trigger)
                logger.info(`✅ Teardown completed for ${trigger.config_type} trigger`, {
                    configType: trigger.config_type,
                    triggerId: trigger.id,
                    integrationId: trigger.integration_id
                })
            } else {
                logger.warn(`⚠️  No integration found for ${integrationType} (config: ${trigger.config_type}). Skipping teardown.`, {
                    integrationType,
                    configType: trigger.config_type,
                    triggerId: trigger.id
                })
            }
        } catch (error) {
            logger.error(`❌ Error tearing down ${trigger.config_type}`, {
                error,
                configType: trigger.config_type,
                triggerId: trigger.id
            })
        }
    }
}

export async function getAgentFiles(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const organizationId = req.session.user.organizationId
    const agentId = req.params.agentId

    try {
        const agent: AgentWithPromptRelations | null = await db().automations.findFirst({
            where: {
                id: agentId,
                organization_id: organizationId
            },
            include: {
                prompt: true
            }
        })

        if (!agent) {
            res.status(404).json({ error: "Agent files not found" })
            return
        }

        const files = await getAgentFilesFromGCS(agent)

        res.status(200).json({ id: agent.id, files })
    } catch (error) {
        logger.error("Error fetching agent files", { error, organizationId, agentId })
        res.status(500).json({ error: "Failed to fetch agent files" })
    }
}

export async function getAgentFileContent(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const organizationId = req.session.user.organizationId
    const agentId = req.params.agentId
    const fileId = req.params.fileId

    if (!fileId || typeof fileId !== "string") {
        res.status(400).json({ error: "Invalid file ID" })
        return
    }

    try {
        const agent: AgentWithPromptRelations | null = await db().automations.findFirst({
            where: {
                id: agentId,
                organization_id: organizationId
            },
            include: {
                prompt: true
            }
        })

        if (!agent) {
            res.status(404).json({ error: "Agent not found" })
            return
        }

        const payload = await getAgentFileFromGCS(agent, fileId)
        if (!payload) {
            res.status(404).json({ error: "File not found" })
            return
        }

        res.status(200).json(payload)
    } catch (error) {
        logger.error("Error fetching agent file", { error, organizationId, agentId, fileId })
        res.status(500).json({ error: "Failed to fetch agent file" })
    }
}

type SdkZipTreeNode = { id: string; name: string; children?: SdkZipTreeNode[] }

const MAX_SDK_ZIP_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

async function loadSdkSourceZip(agent: AgentWithPromptRelations): Promise<AdmZip | null> {
    const gcsKey = agent.prompt?.source_code_gcs_key
    if (!gcsKey) {
        return null
    }
    const buffer = await downloadSdkDeployZip(gcsKey)
    if (!buffer) {
        return null
    }
    if (buffer.length > MAX_SDK_ZIP_SIZE_BYTES) {
        logger.error("SDK source ZIP exceeds size limit, refusing to load", { gcsKey, sizeBytes: buffer.length })
        return null
    }
    return new AdmZip(buffer)
}

function normalizeZipEntryName(entryName: string): string {
    return entryName.replace(/\\/g, "/").replace(/^\/+/, "")
}

function shouldSkipZipListingPath(path: string): boolean {
    if (!path) return true
    if (path === ".DS_Store" || path.endsWith("/.DS_Store")) return true
    if (path.startsWith("__MACOSX/") || path === "__MACOSX") return true
    return false
}

function isSafeArchiveMemberPath(path: string): boolean {
    if (!path || path.startsWith("/") || path.includes("\0")) {
        return false
    }
    const segments = path.split("/")
    return !segments.some(s => s === ".." || s === ".")
}

function insertPathIntoSdkTree(root: SdkZipTreeNode[], relativePath: string): void {
    const parts = relativePath.split("/").filter(Boolean)
    if (parts.length === 0) return

    let level = root
    for (let depth = 0; depth < parts.length; depth++) {
        const name = parts[depth]
        const id = parts.slice(0, depth + 1).join("/")
        const isFile = depth === parts.length - 1

        let node = level.find(n => n.name === name)
        if (!node) {
            node = isFile ? { id, name } : { id, name, children: [] }
            level.push(node)
        } else if (!isFile && node.children === undefined) {
            node.children = []
        }

        if (!isFile) {
            if (!node.children) {
                node.children = []
            }
            level = node.children
        }
    }
}

function sortSdkFileTreeNodes(nodes: SdkZipTreeNode[]): File[] {
    const sorted = [...nodes].sort((a, b) => {
        const aDir = a.children !== undefined
        const bDir = b.children !== undefined
        if (aDir !== bDir) {
            return aDir ? -1 : 1
        }
        return a.name.localeCompare(b.name)
    })
    return sorted.map(n => ({
        id: n.id,
        name: n.name,
        ...(n.children?.length ? { children: sortSdkFileTreeNodes(n.children) } : {})
    }))
}

function listSdkZipPathsRecursive(zip: AdmZip): File[] {
    const root: SdkZipTreeNode[] = []
    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) {
            continue
        }
        const path = normalizeZipEntryName(entry.entryName)
        if (shouldSkipZipListingPath(path)) {
            continue
        }
        insertPathIntoSdkTree(root, path)
    }
    return sortSdkFileTreeNodes(root)
}

/**
 * MIME from path using the `mime` package. TypeScript sources (`.ts`, `.mts`, `.cts`, `.tsx`) are handled
 * explicitly because `mime` maps `.ts`/`.mts` to `video/mp2t` (MPEG-TS) and has no entry for `.tsx`.
 */
function mimeTypeForSdkPath(path: string): string {
    const lower = path.toLowerCase()
    if (lower.endsWith(".tsx") || lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts")) {
        return "text/typescript"
    }

    const fromMime = mime.getType(path)
    if (fromMime) {
        return fromMime
    }

    const base = (path.split("/").pop() ?? path).toLowerCase()
    if (base === "dockerfile" || base === "makefile" || base === "containerfile") {
        return "text/plain"
    }
    return "application/octet-stream"
}

async function getAgentFilesFromGCS(agent: AgentWithPromptRelations): Promise<File[]> {
    const zip = await loadSdkSourceZip(agent)
    if (!zip) {
        return []
    }
    return listSdkZipPathsRecursive(zip)
}

async function getAgentFileFromGCS(agent: AgentWithPromptRelations, fileId: string): Promise<AgentFileContentResponse | null> {
    let decodedPath = fileId
    try {
        decodedPath = decodeURIComponent(fileId)
    } catch {
        return null
    }

    if (!isSafeArchiveMemberPath(decodedPath)) {
        return null
    }

    const zip = await loadSdkSourceZip(agent)
    if (!zip) {
        return null
    }

    const entry = zip.getEntries().find(e => !e.isDirectory && normalizeZipEntryName(e.entryName) === decodedPath)

    if (!entry) {
        return null
    }

    const raw = entry.getData()
    const fileName = decodedPath.split("/").pop() ?? decodedPath
    const mimeType = mimeTypeForSdkPath(decodedPath)

    return {
        path: decodedPath,
        fileName,
        contentBase64: raw.toString("base64"),
        mimeType
    }
}
