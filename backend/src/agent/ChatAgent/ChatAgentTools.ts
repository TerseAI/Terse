import { RunContext, tool, webSearchTool } from "@openai/agents"
import { Tool } from "@openai/agents-core"
import { z } from "zod"
import { uuidv4 } from "zod/v4"

import { filterEvent } from "../../agent/AgentRunner/EventFilter"
import { EventProcessor } from "../../agent/AgentRunner/EventProcessor"
import { generateEventSummary } from "../../agent/EventSummaryAgent/EventSummaryAgent"
import { CronJobEvent } from "../../integrations/CronJobIntegration"
import { FetchResourcesOptions, FetchResourcesOptionsSchema } from "../../integrations/abstract/FetchResourcesOptions"
import { InputEvent } from "../../integrations/abstract/InputEvent"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { requireHydrator } from "../../rag/HydratorRegistry"
import type { AgentDraft } from "../../routes/agents"
import { applyAgentForUser, isUuidV4, updateAgentForUser, validateUserOwnsIntegration } from "../../routes/agents"
import type { ConfigInstance } from "../../shared/Configs"
import { ConfigType } from "../../shared/Configs"
import { FROM_SETUP_CHAT_PARAM, FrontendRoutes } from "../../shared/FrontendRoutes"
import { IntegrationType } from "../../shared/Integrations"
import { TrackingParams } from "../../shared/RunHistoryTypes"
import { ToolNameSchema } from "../../tools/ToolNames"
import { getToolsThatRequireApprovals } from "../../tools/availableTools"
import { HydratorType, requireHydratorType } from "../../types/rag"
import {
    BaseConfigSchema,
    ConfluenceConfigSchema,
    DatadogConfigSchema,
    FigmaConfigSchema,
    GitHubConfigSchema,
    GitHubKnowledgeBaseConfigSchema,
    GmailConfigSchema,
    GmailOutputConfigSchema,
    JiraConfigSchema,
    LaunchDarklyConfigSchema,
    LinearInputConfigSchema,
    LinearKnowledgeBaseConfigSchema,
    LinearOutputConfigSchema,
    NonEmptyString,
    NotionConfigSchema,
    PosthogConfigSchema,
    SlackConfigSchema,
    SlackKnowledgeBaseConfigSchema,
    SlackOutputConfigSchema,
    TimeTriggerConfigSchema,
    WorkOSInputConfigSchema,
    enforceNonSystemIntegrationId
} from "../../utility/configSchemas"
import { randomString } from "../../utility/strings"
import { getUserForOrg } from "../../utility/workos"

import type { ChatAgentContext } from "./ChatAgentContext"
import ChatInterface from "./ChatInterfaces/ChatInterface"
import { lookupPlatformCapabilitiesTool } from "./lookupPlatformCapabilities"

export function buildChatAgentTools(chatInterface: ChatInterface): Tool<ChatAgentContext>[] {
    return [
        webSearchTool({ searchContextSize: "medium" }) as Tool<ChatAgentContext>,
        lookupPlatformCapabilitiesTool,
        tool({
            name: "getToolApprovalOptions",
            description:
                "Returns the tools that can require approval for the given outputs (skills) and knowledge bases. Use this when building an agent to discover which tool names are valid for the toolApprovals field. The returned name values are the only valid choices for toolApprovals when calling applyAgent for an agent with those outputs and knowledge bases. skills must be output config types (e.g. slack_output, notion, linear_output); knowledgeBases must be knowledge base config types (e.g. github_kb, POSTHOG, slack_kb).",
            parameters: z.object({
                skills: z
                    .array(z.nativeEnum(ConfigType))
                    .describe("Output config types for the agent's skills. Only config types with isOutput true (e.g. slack_output, notion, gmail_output, linear_output, jira, confluence)."),
                knowledgeBases: z
                    .array(z.nativeEnum(ConfigType))
                    .optional()
                    .default([])
                    .describe("Knowledge base config types (e.g. github_kb, POSTHOG, launchdarkly, linear_kb, slack_kb). Omit or empty if the agent has no knowledge bases.")
            }),
            execute: async ({ skills, knowledgeBases }: { skills: ConfigType[]; knowledgeBases?: ConfigType[] }, _runContext?: RunContext<ChatAgentContext>): Promise<string> => {
                const tools = getToolsThatRequireApprovals(skills, knowledgeBases ?? [])
                return JSON.stringify({ tools })
            }
        }),
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
                const user = runContext?.context.user
                if (!user) {
                    throw new Error("User is required to apply agent")
                }

                try {
                    const draft = toAgentDraft(agent)
                    const sessionId = runContext?.context?.sessionId
                    const createWithId = !id && chatInterface.name === "Web" && sessionId && isUuidV4(sessionId) ? { createWithId: sessionId } : undefined
                    const result = id ? await updateAgentForUser(user.id, user.organizationId, id, draft) : await applyAgentForUser(user.id, user.organizationId, draft, createWithId)

                    const path = FrontendRoutes.AGENTS.DETAIL(result.id)
                    await chatInterface.navigate(`${path}?${FROM_SETUP_CHAT_PARAM}=1`)
                    return `Agent applied successfully (${result.id})`
                } catch (error) {
                    logger.error("applyAgent failed", { error, user, agent })
                    throw error
                }
            }
        }),
        tool({
            name: "promptForIntegration",
            description:
                "Prompt for an integration. This tool shows a prompt (OAuth button or form) and blocks until the user completes the integration or the request times out (about 2 minutes). You can call it again in the same turn if you need multiple integrations; each call will wait for its own completion. You can also call this if the user needs to re-configure an integration. Ex: Add repos to github or more pages to Notion.",
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
                const user = runContext?.context.user
                if (!user) {
                    throw new Error("User is required to fetch resources")
                }
                return await fetchResourcesForIntegrationType(integrationType, user.organizationId, query ?? undefined, options)
            }
        }),
        tool({
            name: "askSurveyQuestion",
            description:
                "Ask the user a single multiple-choice setup question. This tool blocks until the user answers or times out (~2 minutes). The user can choose one of the options or write in their own answer. Returns the selected value(s) or their written text directly. Call once per turn; the tool will not return until the user responds. IMPORTANT: Only provide concrete choice options (e.g. specific channel names, project names). Do NOT add an option that is redundant with the write-in, such as 'Other', 'A different X (tell me the name)', or 'Something else'—the UI already has 'Or write your own answer' for that.",
            parameters: z.object({
                question: z.string().describe("The question text to show the user"),
                options: z
                    .array(z.object({ label: z.string(), value: z.string() }))
                    .describe("Concrete multiple-choice options only (e.g. specific names/ids). Do not include an 'other' or 'different X' option—the write-in field covers that."),
                allowMultiple: z
                    .boolean()
                    .default(false)
                    .describe("Set to true when the user should be able to select more than one option (e.g. 'which channels should receive notifications?'). Defaults to false (single-select).")
            }),
            execute: async (
                { question, options, allowMultiple }: { question: string; options: { label: string; value: string }[]; allowMultiple?: boolean },
                _runContext?: RunContext<ChatAgentContext>
            ): Promise<string> => {
                return await chatInterface.askSurveyQuestion({ question, options, allowMultiple })
            }
        }),
        tool({
            name: "getSampleEvents",
            description:
                "Fetch sample events to test your agent. Returns event references (entityType + entityId) and AI-generated summaries. Use triggerAgentRun with the entityType and entityId to run a specific event. For cron/scheduled agents, trigger immediately with triggerAgentRun and only agentId (no need to call getSampleEvents first).",
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

                const user = runContext?.context.user
                if (!user) {
                    throw new Error("User is required to fetch sample events")
                }

                const ownsIntegration = await validateUserOwnsIntegration(user.organizationId, integrationType, integrationId)
                if (!ownsIntegration) {
                    throw new Error(`Integration ${integrationType} not found or not in your organization`)
                }

                const configInstance = toConfigInstance(normalizeConfig(triggerConfig.config))
                const inputEvents = await manager.getSampleEvents(integrationId, user.organizationId, configInstance, { limit })
                logger.info("[getSampleEvents] Fetched raw events from integration", {
                    integrationType,
                    count: inputEvents.length
                })

                let agentPrompt = null
                if (agentId) {
                    const agent = await db().automations.findUnique({
                        where: { id: agentId },
                        include: { prompt: true, user: true }
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

                const trackingParams: TrackingParams = {
                    runId: randomString(15),
                    agentId: agentId ?? "",
                    user: user
                }

                const results = await Promise.all(
                    identifiableEvents.map(async event => {
                        const identifiable = event.getIdentifiableInfo()!
                        const eventData = (event as unknown as { data: unknown }).data

                        const [summaryResult, filterResult] = await Promise.all([
                            generateEventSummary(integrationType, eventData, user).catch(err => {
                                logger.warn("[getSampleEvents] Summary generation failed for event", {
                                    entityId: identifiable.entityId,
                                    error: err instanceof Error ? err.message : String(err)
                                })
                                return { summary: `${integrationType} event` }
                            }),
                            agentPrompt
                                ? filterEvent(event, agentPrompt, false, trackingParams).catch(err => {
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
            name: "triggerAgentRun",
            description:
                "For cron/time trigger agents: call with only agentId (omit or pass null for entityType and entityId) to trigger the agent immediately. For event-based triggers, use entityType and entityId from getSampleEvents. This returns quickly with runId while the run continues in the background.",
            parameters: z.object({
                entityType: z.nativeEnum(HydratorType).nullable().describe("The entity type from getSampleEvents. Not needed for cron/time trigger agents."),
                entityId: z.string().nullable().describe("The entity ID from getSampleEvents. Not needed for cron/time trigger agents."),
                agentId: z.string().describe("The agent ID to test the sample event against"),
                manualContext: z
                    .string()
                    .nullable()
                    .optional()
                    .describe(
                        "Optional context to pass to the agent run. For cron/time trigger agents, this provides the agent with additional context about why this run was triggered and what to focus on."
                    )
            }),
            execute: async ({ entityType, entityId, agentId, manualContext }, runContext?: RunContext<ChatAgentContext>): Promise<string> => {
                const user = runContext?.context.user
                if (!user) {
                    throw new Error("User is required to trigger agent run")
                }

                let inputEvent: InputEvent
                let resolvedEntityType: string
                let resolvedEntityId: string
                const userEntityId = entityId != null && String(entityId).trim() !== "" ? entityId.trim() : null
                const userEntityType = entityType != null && String(entityType).trim() !== "" ? entityType.trim() : null
                const isEventBasedTrigger = userEntityType !== null && userEntityId !== null

                if (isEventBasedTrigger) {
                    logger.info("[triggerAgentRun] Starting", { entityType, entityId })
                    const hydratorType = requireHydratorType(userEntityType)
                    const hydrator = requireHydrator(hydratorType, { userId: user.id, organizationId: user.organizationId })
                    const hydrated = await hydrator.hydrate({
                        entityType: hydratorType,
                        entityId: userEntityId
                    })
                    inputEvent = hydrated as InputEvent
                    resolvedEntityType = userEntityType
                    resolvedEntityId = userEntityId
                    logger.info("[triggerAgentRun] Hydrated event", {
                        entityType: userEntityType,
                        entityId: userEntityId,
                        debugLog: inputEvent.debugLog()
                    })
                } else {
                    logger.info("[triggerAgentRun] Cron trigger path", { agentId })
                    const agent = await db().automations.findUnique({
                        where: { id: agentId, organization_id: user.organizationId },
                        include: { inputs: { include: { time_trigger_config: true } } }
                    })
                    if (!agent) throw new Error("Agent not found")
                    const timeTriggerInput = agent.inputs.find(i => i.config_type === "TIME_TRIGGER" && i.time_trigger_config)
                    if (!timeTriggerInput) throw new Error("Agent does not have a time trigger input")
                    const cronJobEvent = new CronJobEvent({
                        inputId: timeTriggerInput.id,
                        isManualTrigger: true,
                        manualContext: manualContext ?? undefined
                    })
                    inputEvent = cronJobEvent
                    resolvedEntityType = "cron_trigger"
                    resolvedEntityId = timeTriggerInput.id
                }
                const agentInOrg = await db().automations.findUnique({
                    where: { id: agentId, organization_id: user.organizationId },
                    select: { id: true }
                })
                if (!agentInOrg) {
                    throw new Error("Agent not found or not in your organization")
                }

                const eventProcessor = new EventProcessor(inputEvent, user, { isManuallyTriggered: true })
                const triggeredRun = await eventProcessor.triggerSingleAgent(agentId)

                const runHistoryPath = FrontendRoutes.AGENTS.RUN_HISTORY(triggeredRun.agentId, triggeredRun.runId)
                await chatInterface.buildButton("See progress", runHistoryPath)

                logger.info("[triggerAgentRun] Triggered run", {
                    entityType: resolvedEntityType,
                    entityId: resolvedEntityId,
                    runId: triggeredRun.runId,
                    agentId: triggeredRun.agentId
                })
                return JSON.stringify({
                    processed: true,
                    triggered: true,
                    entityType: resolvedEntityType,
                    entityId: resolvedEntityId,
                    runId: triggeredRun.runId,
                    agentId: triggeredRun.agentId,
                    agentName: triggeredRun.agentName,
                    status: "in_progress",
                    runHistoryPath
                })
            }
        }),
        tool({
            name: "pollTriggeredRunStatus",
            description: "Polls a previously triggered run until it leaves in_progress or until maxWaitMs is reached. Use this after triggerAgentRun to track completion in chat.",
            parameters: z.object({
                runId: z.string().describe("Run ID returned by triggerAgentRun."),
                maxWaitMs: z.number().int().min(0).max(120000).optional().default(30000).describe("Maximum total time to poll before returning."),
                pollIntervalMs: z.number().int().min(250).max(5000).optional().default(1000).describe("Delay between status checks while run is in progress.")
            }),
            execute: async ({ runId, maxWaitMs = 30000, pollIntervalMs = 1000 }, runContext?: RunContext<ChatAgentContext>): Promise<string> => {
                const user = runContext?.context.user
                if (!user) {
                    throw new Error("User is required to poll run status")
                }

                const startTime = Date.now()
                let runRecord = await db().run_history_records.findFirst({
                    where: {
                        id: runId,
                        automation: { organization_id: user.organizationId }
                    },
                    include: {
                        automation: {
                            select: { name: true }
                        }
                    }
                })

                if (!runRecord) {
                    throw new Error(`Run ${runId} not found`)
                }

                while (runRecord.status === "in_progress" && Date.now() - startTime < maxWaitMs) {
                    await sleep(pollIntervalMs)
                    const nextRecord = await db().run_history_records.findFirst({
                        where: {
                            id: runId,
                            automation: { organization_id: user.organizationId }
                        },
                        include: {
                            automation: {
                                select: { name: true }
                            }
                        }
                    })
                    if (!nextRecord) {
                        throw new Error(`Run ${runId} not found`)
                    }
                    runRecord = nextRecord
                }

                const isComplete = runRecord.status !== "in_progress"
                const timedOut = !isComplete
                const runHistoryPath = FrontendRoutes.AGENTS.RUN_HISTORY(runRecord.automation_id, runRecord.id)

                return JSON.stringify({
                    runId: runRecord.id,
                    agentId: runRecord.automation_id,
                    agentName: runRecord.automation.name,
                    status: runRecord.status,
                    filtered: runRecord.filtered,
                    decisionReason: runRecord.decision_reason || null,
                    updatedAt: runRecord.updated_at.toISOString(),
                    isComplete,
                    timedOut,
                    runHistoryPath
                })
            }
        })
    ]
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

const InputConfigSchema = z
    .discriminatedUnion("configType", [
        GmailConfigSchema,
        FigmaConfigSchema,
        SlackConfigSchema,
        LinearInputConfigSchema,
        GitHubConfigSchema,
        JiraConfigSchema,
        TimeTriggerConfigSchema,
        WorkOSInputConfigSchema
    ])
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
    .discriminatedUnion("configType", [SlackOutputConfigSchema, NotionConfigSchema, LinearOutputConfigSchema, JiraConfigSchema, ConfluenceConfigSchema, GmailOutputConfigSchema])
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
        toolApprovals: z.array(ToolNameSchema).nullable(),
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
