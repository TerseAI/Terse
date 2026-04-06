import { Request, Response } from "express"
import { isValidToolName } from "terse-types"
import { ConfigData, ConfigInstance } from "terse-types/Configs"
import { IntegrationType } from "terse-types/Integrations"
import { Agent, AgentNotificationSettings, AgentTrigger, AgentUpdate, AgentsResponse } from "terse-types/types"
import { version as uuidVersion, validate as validateUuid } from "uuid"

import { agentCreateSchema, agentUpdateSchema } from "terse-types/types"
import { INTEGRATION_REGISTRY, isSystemIntegration } from "../integrations/abstract/IntegrationRegistry"
import logger from "../logger"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { TRIGGER_REGISTRY } from "../triggers/TriggerRegistry"
import { AgentWithNotificationSettingsRelations, AgentWithRelations, AgentWithTriggerRelations, PrismaTransaction } from "../types/prisma"
import { trackAgentCreated } from "../utility/analytics"
import { parsePageParams } from "../utility/pagination"
import { getInputConfigInclude, getOutputConfigInclude } from "../utility/prismaIncludes"
import { extractErrorMessage } from "../utility/strings"
import { convertConfigTypeToInputConfigType, convertConfigTypeToOutputConfigType, convertPrismaConfigToConfigData, convertPrismaOutputConfigToConfigData } from "../utility/typeConverters"

export type AgentDraft = Omit<Agent, "id"> & { id?: string }

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

async function upsertNotificationSettings(tx: PrismaTransaction, automationId: string, userId: string, settings: AgentNotificationSettings | undefined): Promise<void> {
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

export async function persistToolApprovals(tx: PrismaTransaction, automationId: string, toolApprovals: string[] | undefined, options?: { replaceExisting?: boolean }): Promise<void> {
    if (toolApprovals === undefined) {
        return
    }

    const uniqueToolApprovals = validateAndDeduplicateToolApprovals(toolApprovals)

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

    // Set up agent triggers (e.g., create webhooks for Figma)
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

            // Tear down old triggers (e.g., delete webhooks for Figma)
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

        await upsertNotificationSettings(tx, agentId, userId, notificationSettings)

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

    // Set up agent triggers (e.g., create webhooks for Figma)
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
            agents: agents.map(agent => transformAgentToFrontendFormat(agent)),
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
        const response = agents.map(agent => {
            const lastEventTimestamp = lastEventMap.get(agent.id)
            return {
                ...transformAgentToFrontendFormat(agent),
                updatedAt: agent.updated_at.toISOString(),
                lastEventProcessedAt: lastEventTimestamp ? lastEventTimestamp.toISOString() : null
            }
        })

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
        const response: Agent = transformAgentToFrontendFormat(agent)

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

        // Tear down agent triggers (e.g., delete webhooks for Figma)
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

// Helper function to transform AgentWithRelations to frontend Agent format
function transformAgentToFrontendFormat(agent: AgentWithRelations & Partial<AgentWithNotificationSettingsRelations>): Agent {
    return {
        id: agent.id,
        name: agent.name,
        isActive: agent.is_active,
        requireApproval: agent.require_approval ?? false,
        prompt: agent.prompt ? { text: agent.prompt.content } : { text: "" },
        triggers: agent.inputs.map(trigger => ({
            id: trigger.id,
            config: convertPrismaConfigToConfigData(trigger)
        })),
        outputs: (agent.outputs ?? []).map(output => ({
            id: output.id,
            config: convertPrismaOutputConfigToConfigData(output)
        })),
        notificationSettings: agent.notification_settings
            ? {
                  enabled: agent.notification_settings.enabled,
                  actionTypes: agent.notification_settings.action_types
              }
            : undefined,
        toolApprovals: agent.tool_approvals.map((ta: any) => ta.tool_name),
        createdByUserId: agent.user_id,
        updatedAt: agent.updated_at.toISOString(),
        source: agent.source
    }
}

export async function setupAgentTriggers(agent: AgentWithTriggerRelations): Promise<void> {
    for (const trigger of agent.inputs) {
        try {
            // Convert prisma config to shared config instance to get integration type
            const configInstance = convertPrismaConfigToConfigData(trigger)
            const integrationType = configInstance.integrationType

            // Find the integration from the registry
            const integration = INTEGRATION_REGISTRY.find(int => int.integrationType === integrationType)

            if (integration) {
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
            // Convert prisma config to shared config instance to get integration type
            const configInstance = convertPrismaConfigToConfigData(trigger)
            const integrationType = configInstance.integrationType

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
