import { RunContext, tool } from "@openai/agents"
import { Tool } from "@openai/agents-core"
import { z } from "zod"
import { uuidv4 } from "zod/v4"

import { filterEvent } from "../../agent/AgentRunner/EventFilter"
import { EventProcessor } from "../../agent/AgentRunner/EventProcessor"
import { generateEventSummary } from "../../agent/EventSummaryAgent/EventSummaryAgent"
import { FetchResourcesOptions, FetchResourcesOptionsSchema } from "../../integrations/abstract/FetchResourcesOptions"
import { InputEvent } from "../../integrations/abstract/InputEvent"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { requireHydrator } from "../../rag/HydratorRegistry"
import type { AgentDraft } from "../../routes/agents"
import { applyAgentForUser, isUuidV4, updateAgentForUser } from "../../routes/agents"
import type { ConfigInstance } from "../../shared/Configs"
import { ConfigType } from "../../shared/Configs"
import { FrontendRoutes } from "../../shared/FrontendRoutes"
import { IntegrationType } from "../../shared/Integrations"
import { requireHydratorType } from "../../types/rag"
import { getUserForOrg } from "../../utility/workos"

import ChatInterface from "./ChatInterfaces/ChatInterface"

export type ChatAgentContext = {
    chatInterface: ChatInterface
    userId: string
    organizationId: string
    sessionId: string
}

export function buildChatAgentTools(chatInterface: ChatInterface): Tool<ChatAgentContext>[] {
    return [
        tool({
            name: "applyAgent",
            description:
                "Once you have all the information you need, you can use this tool to persist and apply the automation. You can use this to create and update agents. If you are creating, just leave the id empty.",
            parameters: z.object({
                agent: AgentSchema,
                id: z.string().nullable().describe("The ID of the agent to update. If not provided, a new agent will be created.")
            }),
            execute: async ({ agent, id }, runContext?: RunContext<ChatAgentContext>): Promise<string> => {
                logger.info("Slack chat interface applyAgent", { agent, id })
                const userId = runContext?.context?.userId
                const organizationId = runContext?.context?.organizationId
                if (!userId || !organizationId) {
                    throw new Error("User ID and organization ID are required to apply agent")
                }

                try {
                    const draft = toAgentDraft(agent)
                    const sessionId = runContext?.context?.sessionId
                    const createWithId = !id && chatInterface.name === "Web" && sessionId && isUuidV4(sessionId) ? { createWithId: sessionId } : undefined
                    const result = id ? await updateAgentForUser(userId, organizationId, id, draft) : await applyAgentForUser(userId, organizationId, draft, createWithId)

                    await chatInterface.navigate(FrontendRoutes.AGENTS.DETAIL(result.id))
                    return `Agent applied successfully (${result.id})`
                } catch (error) {
                    logger.error("applyAgent failed", { error, userId, agent })
                    throw error
                }
            }
        }),
        tool({
            name: "promptForIntegration",
            description:
                "IMPORTANT: Only call this once per turn! The UX is very bad if this called multiple times in a single turn. Call it once, wait for the reply then call it again if another integration is needed. Prompt for an integration. You can also call this if the user needs to re-configure an integration. Ex: Add repos to github or more pages to Notion.",
            parameters: z.object({
                integration: z.nativeEnum(IntegrationType).describe("The integration to prompt for")
            }),
            execute: async ({ integration }: { integration: IntegrationType }, runContext?: RunContext<ChatAgentContext>): Promise<string> => {
                return await chatInterface.promptForIntegration(integration)
            }
        }),
        tool({
            name: "fetchResourcesForIntegration",
            description:
                "Call this when you need to see what configs you have access to. It returns display names and canonical IDs you can use for the Agent object in applyAgent. IMPORTANT: Do not add integrations unless the user explicitly asked for them.",
            parameters: z.object({
                integrationType: z.nativeEnum(IntegrationType).describe("The integration type to fetch resources for"),
                query: z.string().nullable().describe("Optional query to filter resources by name/title"),
                options: FetchResourcesOptionsSchema.describe("Optional integration-specific filtering options")
            }),
            execute: async (
                {
                    integrationType,
                    query,
                    options
                }: {
                    integrationType: IntegrationType
                    query: string | null
                    options?: FetchResourcesOptions
                },
                runContext?: RunContext<ChatAgentContext>
            ): Promise<string> => {
                logger.info("Fetching resources for integration type", {
                    integrationType,
                    query,
                    options
                })
                const userId = runContext?.context?.userId
                const organizationId = runContext?.context?.organizationId
                if (!userId || !organizationId) {
                    throw new Error("User ID and organization ID are required to fetch resources")
                }
                return await fetchResourcesForIntegrationType(integrationType, organizationId, query ?? undefined, options)
            }
        }),
        tool({
            name: "getSampleEvents",
            description:
                "Fetch sample events to test your agent. Returns event references (entityType + entityId) and AI-generated summaries. Use executeSampleEvent with the entityType and entityId to run a specific event.",
            parameters: z.object({
                integrationId: z.string().describe("The integration ID to fetch sample events for"),
                integrationType: z.nativeEnum(IntegrationType).describe("The integration type"),
                triggerConfig: AgentTriggerSchema.describe("The trigger config to fetch sample events for"),
                agentId: z.string().nullable().describe("Optional agent ID to preview filter results against"),
                options: z
                    .object({
                        limit: z.number().nullable().describe("Number of sample events to fetch (default 5)")
                    })
                    .nullable()
            }),
            execute: async ({ integrationId, integrationType, triggerConfig, agentId, options }, runContext?: RunContext<ChatAgentContext>): Promise<string> => {
                const userId = runContext?.context?.userId
                const organizationId = runContext?.context?.organizationId
                if (!userId || !organizationId) {
                    throw new Error("User ID and organization ID are required")
                }

                const limit = options?.limit ?? 5
                logger.info("[getSampleEvents] Starting", {
                    integrationId,
                    integrationType,
                    limit,
                    agentId: agentId ?? null
                })

                const manager = INTEGRATION_REGISTRY.find(m => m.integrationType === integrationType)
                if (!manager || !manager.getSampleEvents) {
                    logger.warn("[getSampleEvents] Integration does not support sample events", { integrationType })
                    throw new Error(`Integration ${integrationType} does not support sample events`)
                }

                const configInstance = toConfigInstance(normalizeConfig(triggerConfig.config))
                const inputEvents = await manager.getSampleEvents(integrationId, organizationId, configInstance, { limit })
                logger.info("[getSampleEvents] Fetched raw events from integration", {
                    integrationType,
                    count: inputEvents.length
                })

                let agentPrompt = null
                if (agentId) {
                    const agent = await db().automations.findUnique({
                        where: { id: agentId },
                        include: { prompt: true }
                    })
                    agentPrompt = agent?.prompt
                    logger.info("[getSampleEvents] Filter preview", { agentId, hasPrompt: !!agentPrompt })
                }

                const identifiableEvents = inputEvents.filter(e => e.isIdentifiable())
                const skipped = inputEvents.length - identifiableEvents.length
                if (skipped > 0) {
                    logger.warn("[getSampleEvents] Skipped non-identifiable events", {
                        skipped,
                        samples: inputEvents.filter(e => !e.isIdentifiable()).map(e => e.debugLog())
                    })
                }

                const results = await Promise.all(
                    identifiableEvents.map(async event => {
                        const identifiable = event.getIdentifiableInfo()!
                        const eventData = (event as unknown as { data: unknown }).data

                        const [summaryResult, filterResult] = await Promise.all([
                            generateEventSummary(integrationType, eventData),
                            agentPrompt
                                ? filterEvent(event, agentPrompt, false).catch(err => {
                                      logger.warn("[getSampleEvents] Filter preview failed for event", {
                                          entityId: identifiable.entityId,
                                          error: err instanceof Error ? err.message : String(err)
                                      })
                                      return null
                                  })
                                : Promise.resolve(null)
                        ])

                        const summary = summaryResult.summary
                        const wouldBeFiltered = filterResult ? !filterResult.result.isRelevant : false
                        const filterReason = filterResult?.result.reason ?? (agentPrompt ? "Filter preview failed" : null)
                        const filterConfidence = filterResult?.result.confidence ?? null

                        return {
                            entityType: identifiable.entityType,
                            entityId: identifiable.entityId,
                            summary,
                            integrationType,
                            wouldBeFiltered,
                            filterReason,
                            filterConfidence
                        }
                    })
                )

                logger.info("[getSampleEvents] Completed", {
                    integrationType,
                    eventCount: results.length,
                    entityIds: results.map(r => r.entityId)
                })

                return JSON.stringify({ events: results })
            }
        }),
        tool({
            name: "executeSampleEvent",
            description: "Execute a sample event to test how your agent responds. Use entityType and entityId from getSampleEvents.",
            parameters: z.object({
                entityType: z.string().describe("The entity type from getSampleEvents (e.g., 'slack_message_event', 'github_event')"),
                entityId: z.string().describe("The entity ID from getSampleEvents"),
                agentId: z.string().describe("The agent ID to test the sample event against")
            }),
            execute: async ({ entityType, entityId, agentId }, runContext?: RunContext<ChatAgentContext>): Promise<string> => {
                const userId = runContext?.context?.userId
                const organizationId = runContext?.context?.organizationId
                if (!userId || !organizationId) {
                    throw new Error("User ID and organization ID are required")
                }

                logger.info("[executeSampleEvent] Starting", { entityType, entityId })

                const hydratorType = requireHydratorType(entityType)
                const hydrator = requireHydrator(hydratorType, { userId, organizationId })

                const hydrated = await hydrator.hydrate({
                    entityType: hydratorType,
                    entityId
                })
                const inputEvent = hydrated as InputEvent
                logger.info("[executeSampleEvent] Hydrated event", {
                    entityType,
                    entityId,
                    debugLog: inputEvent.debugLog()
                })

                const user = await getUserForOrg(userId, organizationId)
                if (!user) {
                    logger.error("[executeSampleEvent] User not found", { userId, organizationId })
                    throw new Error("User not found")
                }

                const eventProcessor = new EventProcessor(inputEvent, user)
                const processResults = await eventProcessor.processSingleAgent(agentId)
                logger.info("[executeSampleEvent] EventProcessor finished", {
                    entityType,
                    entityId,
                    resultCount: processResults.length,
                    results: processResults.map(r => ({
                        agentId: r.agentConfig?.id,
                        agentName: r.agentConfig?.name,
                        success: r.success,
                        requiresApproval: r.approvalResult?.status === "awaiting_approval"
                    }))
                })

                const formattedResults = processResults.map(r => ({
                    agentId: r.agentConfig?.id ?? null,
                    agentName: r.agentConfig?.name ?? null,
                    success: r.success,
                    message: r.message,
                    requiresApproval: r.approvalResult?.status === "awaiting_approval"
                }))

                logger.info("[executeSampleEvent] Completed", { entityType, entityId })
                return JSON.stringify({
                    processed: true,
                    entityType,
                    entityId,
                    results: formattedResults
                })
            }
        })
    ]
}

const NonEmptyString = z.string().min(1)

const BaseConfigSchema = z
    .object({
        integrationId: NonEmptyString.describe(
            'The integration instance ID (CUID format like "cm..."). When using fetchResourcesForIntegration, this is the "integration.id" field - NOT teamId, channelId, workspaceId, or any resource ID. Use "system" only for TIME_TRIGGER configs.'
        ),
        configType: z.nativeEnum(ConfigType).describe("The config type for this input/output/knowledge base."),
        integrationType: z.nativeEnum(IntegrationType).describe("The integration provider type (must match configType).")
    })
    .strict()

const GmailConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GMAIL),
    integrationType: z.literal(IntegrationType.GMAIL)
})

const GmailOutputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GMAIL_OUTPUT),
    integrationType: z.literal(IntegrationType.GMAIL)
})

const FigmaConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.FIGMA),
    integrationType: z.literal(IntegrationType.FIGMA),
    fileKey: NonEmptyString.describe("The Figma file key. From fetchResourcesForIntegration, use the file's key from resources[]."),
    fileName: z.string().nullable().describe("The Figma file display name. From fetchResourcesForIntegration, use the file's name from resources[]."),
    teamId: NonEmptyString.describe("The Figma team ID. From fetchResourcesForIntegration, use the file's teamId from resources[].")
})

const SlackConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK),
    integrationType: z.literal(IntegrationType.SLACK),
    channelId: NonEmptyString.nullable().describe(
        'The Slack channel ID (starts with "C" like "C12345"). From fetchResourcesForIntegration, use "resources[].id". Required unless listenToUserDms is true.'
    ),
    channelName: NonEmptyString.nullable().describe('The channel display name (e.g., "general"). From fetchResourcesForIntegration, use "resources[].name".'),
    listenToUserDms: z.boolean().nullable().describe("Set to true to listen to direct messages. If true, channelId is not required."),
    userIds: z.array(NonEmptyString).nullable()
})

const SlackOutputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK_OUTPUT),
    integrationType: z.literal(IntegrationType.SLACK),
    channelId: NonEmptyString.nullable().describe('The Slack channel ID (starts with "C" like "C12345"). From fetchResourcesForIntegration, use "resources[].id".'),
    channelName: NonEmptyString.nullable().describe('The channel display name (e.g., "general"). From fetchResourcesForIntegration, use "resources[].name".')
})

const NotionDatabaseConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.NOTION_DATABASE),
    integrationType: z.literal(IntegrationType.NOTION),
    databaseId: NonEmptyString.nullable().describe("The Notion database ID. From fetchResourcesForIntegration, use the database's id from resources[]."),
    databaseName: z.string().nullable().describe("The database display name. From fetchResourcesForIntegration, use the database's name from resources[].")
})

const NotionPageConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.NOTION_PAGE),
    integrationType: z.literal(IntegrationType.NOTION),
    pageId: NonEmptyString.nullable().describe("The Notion page ID. From fetchResourcesForIntegration, use the page's id from resources[]."),
    pageName: z.string().nullable().describe("The page display name. From fetchResourcesForIntegration, use the page's name from resources[].")
})

const LinearInputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_INPUT),
    integrationType: z.literal(IntegrationType.LINEAR),
    projectId: NonEmptyString.nullable().describe("The Linear project ID. From fetchResourcesForIntegration, use the project's id from resources[]."),
    projectName: z.string().nullable().describe("The project display name. From fetchResourcesForIntegration, use the project's name from resources[].")
})

const LinearOutputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_OUTPUT),
    integrationType: z.literal(IntegrationType.LINEAR),
    teamId: NonEmptyString.nullable().describe("The Linear team ID. From fetchResourcesForIntegration, use the team's id from resources[]."),
    teamName: z.string().nullable().describe("The team display name. From fetchResourcesForIntegration, use the team's name from resources[].")
})

const GitHubConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GITHUB),
    integrationType: z.literal(IntegrationType.GITHUB),
    repositoryIds: z.array(z.number()).min(1).describe("Array of GitHub repository IDs (numeric). From fetchResourcesForIntegration, use the repo's id from resources[].")
})

const GitHubKnowledgeBaseConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GITHUB_KB).describe("Use ONLY for GitHub repository knowledge bases. Do NOT use for PostHog, LaunchDarkly, or Datadog."),
    integrationType: z.literal(IntegrationType.GITHUB),
    repositoryIds: z.array(z.number()).min(1).describe("Array of GitHub repository IDs (numeric). From fetchResourcesForIntegration, use the repo's id from resources[]."),
    repositoryNames: z.array(NonEmptyString).min(1).describe("Array of repository names matching the repositoryIds. From fetchResourcesForIntegration, use the repo's name from resources[].")
})

const JiraConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.JIRA),
    integrationType: z.literal(IntegrationType.ATLASSIAN),
    projectKey: NonEmptyString.nullable(),
    projectId: NonEmptyString.nullable()
})

const ConfluenceConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.CONFLUENCE),
    integrationType: z.literal(IntegrationType.ATLASSIAN),
    spaceName: NonEmptyString,
    spaceId: NonEmptyString,
    pageId: NonEmptyString,
    pageName: NonEmptyString
})

const PosthogConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.POSTHOG).describe("Use for PostHog analytics knowledge bases. Requires projectId."),
    integrationType: z.literal(IntegrationType.POSTHOG),
    projectId: NonEmptyString.describe("The PostHog project ID. From fetchResourcesForIntegration with integrationType=POSTHOG, use resources[].id."),
    projectName: z.string().nullable().describe("The PostHog project name. From fetchResourcesForIntegration, use resources[].name.")
})

const LaunchDarklyConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LAUNCHDARKLY).describe("Use for LaunchDarkly feature flag knowledge bases. Requires projectKey and environmentKeys."),
    integrationType: z.literal(IntegrationType.LAUNCHDARKLY),
    projectKey: NonEmptyString.describe("The LaunchDarkly project key. From fetchResourcesForIntegration with integrationType=LAUNCHDARKLY."),
    environmentKeys: z.array(NonEmptyString).min(1).describe("Array of LaunchDarkly environment keys to include.")
})

const DatadogConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.DATADOG).describe("Use for Datadog log knowledge bases."),
    integrationType: z.literal(IntegrationType.DATADOG),
    defaultIndexes: z.array(NonEmptyString).default(["main"]).describe('Log indexes to search (e.g. ["main"]). From fetchResourcesForIntegration or use ["main"].')
})

const LinearKnowledgeBaseConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_KB).describe("Use for Linear ticket knowledge bases. Search and read Linear issues."),
    integrationType: z.literal(IntegrationType.LINEAR),
    teamId: z.string().nullable().optional(),
    teamName: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    projectName: z.string().nullable().optional()
})

const SlackKnowledgeBaseConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK_KB).describe("Use for Slack conversation history knowledge bases. Read channel and DM history."),
    integrationType: z.literal(IntegrationType.SLACK),
    channelIds: z
        .array(z.string())
        .nullable()
        .optional()
        .describe("Slack channel IDs to read. From fetchResourcesForIntegration with integrationType=SLACK (channels), use resources[].id. If omitted, reads from all accessible channels."),
    channelNames: z.array(z.string()).nullable().optional().describe("Display names for the channels, matching channelIds order."),
    allowDms: z.boolean().optional().default(false).describe("Whether to allow reading DMs. Only applicable for Slack user integrations (not workspace bot integrations)."),
    userIds: z.array(z.string()).nullable().optional().describe("Specific Slack user IDs to filter DM conversations. If omitted, reads from all accessible DMs."),
    userNames: z.array(z.string()).nullable().optional().describe("Display names for the users, matching userIds order.")
})

const TimeTriggerConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.TIME_TRIGGER),
    integrationType: z.literal(IntegrationType.CRON_JOB),
    integrationId: z.literal("system"),
    cronExpression: z
        .string()
        .describe('ALL TIMES ARE IN UTC. The cron expression to schedule the automation. Must be a valid cron expression. Use this format: "minute hour day-of-month month day-of-week"')
})

function enforceNonSystemIntegrationId(config: { configType: ConfigType; integrationId?: string }, ctx: z.RefinementCtx): void {
    if (config.configType !== ConfigType.TIME_TRIGGER && config.integrationId === "system") {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'integrationId must not be "system" unless configType is TIME_TRIGGER.'
        })
    }
}

const InputConfigSchema = z
    .discriminatedUnion("configType", [GmailConfigSchema, FigmaConfigSchema, SlackConfigSchema, LinearInputConfigSchema, GitHubConfigSchema, JiraConfigSchema, TimeTriggerConfigSchema])
    .superRefine((value, ctx) => {
        enforceNonSystemIntegrationId(value, ctx)
        if (value.configType === ConfigType.SLACK) {
            const hasChannel = typeof value.channelId === "string" && value.channelId.trim().length > 0
            const listensToDms = value.listenToUserDms === true
            if (!hasChannel && !listensToDms) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Slack input requires a channelId or listenToUserDms=true."
                })
            }
        }
    })

const OutputConfigSchema = z
    .discriminatedUnion("configType", [
        SlackOutputConfigSchema,
        NotionDatabaseConfigSchema,
        NotionPageConfigSchema,
        LinearOutputConfigSchema,
        JiraConfigSchema,
        ConfluenceConfigSchema,
        GmailOutputConfigSchema
    ])
    .superRefine((value, ctx) => {
        enforceNonSystemIntegrationId(value, ctx)
    })

const KnowledgeBaseConfigSchema = z
    .discriminatedUnion("configType", [
        GitHubKnowledgeBaseConfigSchema,
        PosthogConfigSchema,
        LaunchDarklyConfigSchema,
        DatadogConfigSchema,
        LinearKnowledgeBaseConfigSchema,
        SlackKnowledgeBaseConfigSchema
    ])
    .describe("Knowledge base config. Match configType to integration: POSTHOG, LAUNCHDARKLY, DATADOG, github_kb for GitHub repos, linear_kb for Linear tickets, slack_kb for Slack history.")
    .superRefine((value, ctx) => {
        enforceNonSystemIntegrationId(value, ctx)
    })

const AgentTriggerSchema = z
    .object({
        config: InputConfigSchema
    })
    .strict()

const AgentOutputSchema = z
    .object({
        config: OutputConfigSchema
    })
    .strict()

const AgentPromptSchema = z
    .object({
        text: NonEmptyString
    })
    .strict()

const AgentKnowledgeBaseSchema = z
    .object({
        config: KnowledgeBaseConfigSchema
    })
    .strict()

const RunHistoryActionTypeSchema = z.enum(["create", "update", "delete", "read"])

const AgentNotificationSettingsSchema = z
    .object({
        enabled: z.boolean(),
        actionTypes: z.array(RunHistoryActionTypeSchema)
    })
    .strict()

export const AgentSchema = z
    .object({
        name: NonEmptyString,
        isActive: z.boolean(),
        requireApproval: z.boolean(),
        prompt: AgentPromptSchema,
        triggers: z.array(AgentTriggerSchema).min(1),
        outputs: z.array(AgentOutputSchema).min(1),
        knowledgeBases: z.array(AgentKnowledgeBaseSchema).nullable(),
        notificationSettings: AgentNotificationSettingsSchema.nullable(),
        toolApprovals: z.array(z.string()).nullable(),
        updatedAt: z.string().nullable()
    })
    .strict()

type AgentSchemaInput = z.infer<typeof AgentSchema>

function toConfigInstance<T extends Record<string, any>>(config: T): T & ConfigInstance {
    return {
        ...config,
        isComplete: () => true,
        formatForAgent: () => ""
    } as T & ConfigInstance
}

function normalizeConfig<T extends Record<string, any>>(config: T): T {
    if (config.configType === ConfigType.TIME_TRIGGER) {
        return {
            ...config,
            integrationId: "system",
            integrationType: IntegrationType.CRON_JOB,
            configType: ConfigType.TIME_TRIGGER
        } as T
    }
    return config
}

function toAgentDraft(agent: AgentSchemaInput): AgentDraft {
    return {
        ...agent,
        triggers: agent.triggers.map(trigger => ({
            id: uuidv4().toString(),
            ...trigger,
            config: toConfigInstance(normalizeConfig(trigger.config))
        })),
        outputs: agent.outputs.map(output => ({
            id: uuidv4().toString(),
            ...output,
            config: toConfigInstance(normalizeConfig(output.config))
        })),
        knowledgeBases:
            agent.knowledgeBases?.map(kb => ({
                id: uuidv4().toString(),
                ...kb,
                config: toConfigInstance(normalizeConfig(kb.config))
            })) ?? undefined,
        notificationSettings: agent.notificationSettings ?? undefined,
        toolApprovals: agent.toolApprovals ?? undefined,
        updatedAt: agent.updatedAt ?? undefined
    }
}

async function fetchResourcesForIntegrationType(integrationType: IntegrationType, organizationId: string, query?: string, options?: FetchResourcesOptions): Promise<string> {
    const manager = INTEGRATION_REGISTRY.find(m => m.integrationType === integrationType)
    if (!manager) {
        throw new Error(`Unknown integration type: ${integrationType}`)
    }

    if (manager.fetchResourcesForOrganization) {
        const results = await manager.fetchResourcesForOrganization(organizationId, query, options)
        return JSON.stringify({ resources: results })
    }

    return JSON.stringify("This is a system integration. No config is needed.")
}
