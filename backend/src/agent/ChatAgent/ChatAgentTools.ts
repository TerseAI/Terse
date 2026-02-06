import { RunContext, tool, webSearchTool } from "@openai/agents"
import { Tool } from "@openai/agents-core"
import { z } from "zod"
import { uuidv4 } from "zod/v4"

import { FetchResourcesOptions, FetchResourcesOptionsSchema } from "../../integrations/abstract/FetchResourcesOptions"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import logger from "../../logger"
import type { AgentDraft } from "../../routes/agents"
import { applyAgentForUser, isUuidV4, updateAgentForUser } from "../../routes/agents"
import type { ConfigInstance } from "../../shared/Configs"
import { ConfigType } from "../../shared/Configs"
import { FrontendRoutes } from "../../shared/FrontendRoutes"
import { IntegrationType } from "../../shared/Integrations"

import ChatInterface from "./ChatInterfaces/ChatInterface"

export type ChatAgentContext = {
    chatInterface: ChatInterface
    userId: string
    organizationId: string
    sessionId: string
}

export function buildChatAgentTools(chatInterface: ChatInterface): Tool<ChatAgentContext>[] {
    return [
        webSearchTool({ searchContextSize: "medium" }) as Tool<ChatAgentContext>,
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
    channelId: NonEmptyString.nullable()
        .describe("Slack channel or DM channel ID. Required if userIds is empty; otherwise optional (DM channel IDs are resolved from userIds)."),
    channelName: NonEmptyString.nullable().describe("The channel display name. From fetchResourcesForIntegration, use resources[].name."),
    userIds: z.array(NonEmptyString).nullable().optional().describe("Slack user IDs to send DMs to; used when destination is direct messages. At least one of channelId or userIds required."),
    userNames: z.array(z.string()).nullable().optional().describe("Display names for the users in userIds.")
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
