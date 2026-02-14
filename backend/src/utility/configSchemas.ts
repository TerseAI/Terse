import { z } from "zod"

import { WORKOS_SUPPORTED_EVENT_NAMES } from "../integrations/WorkOSIntegration"
import { ConfigType } from "../shared/Configs"
import { IntegrationType } from "../shared/Integrations"

/**
 * Removes ConfigInstance runtime-only keys (isComplete, formatForAgent) so Zod .strict() schemas
 * do not reject config objects that are class instances.
 */
export function stripConfigForValidation<T extends object>(config: T): T {
    const { isComplete, formatForAgent, ...rest } = { ...config } as T & {
        isComplete?: unknown
        formatForAgent?: unknown
    }
    return rest as T
}

export const NonEmptyString = z.string().min(1)

export const BaseConfigSchema = z
    .object({
        integrationId: NonEmptyString.describe(
            'The integration instance ID (CUID format like "cm..."). When using fetchResourcesForIntegration, this is the "integration.id" field - NOT teamId, channelId, workspaceId, or any resource ID. Use "system" only for TIME_TRIGGER configs.'
        ),
        configType: z.nativeEnum(ConfigType).describe("The config type for this input/output/knowledge base."),
        integrationType: z.nativeEnum(IntegrationType).describe("The integration provider type (must match configType).")
    })
    .strict()

export const GmailConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GMAIL),
    integrationType: z.literal(IntegrationType.GMAIL)
})

export const GmailOutputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GMAIL_OUTPUT),
    integrationType: z.literal(IntegrationType.GMAIL)
})

export const FigmaConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.FIGMA),
    integrationType: z.literal(IntegrationType.FIGMA),
    fileKey: NonEmptyString.describe("The Figma file key. From fetchResourcesForIntegration, use the file's key from resources[]."),
    fileName: z.string().nullable().describe("The Figma file display name. From fetchResourcesForIntegration, use the file's name from resources[]."),
    teamId: NonEmptyString.describe("The Figma team ID. From fetchResourcesForIntegration, use the file's teamId from resources[].")
})

export const SlackConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK),
    integrationType: z.literal(IntegrationType.SLACK),
    channelId: NonEmptyString.nullable().describe(
        'The Slack channel ID (starts with "C" like "C12345"). From fetchResourcesForIntegration, use "resources[].id". Required unless listenToUserDms is true.'
    ),
    channelName: NonEmptyString.nullable().describe('The channel display name (e.g., "general"). From fetchResourcesForIntegration, use "resources[].name".'),
    listenToUserDms: z.boolean().nullable().describe("Set to true to listen to direct messages. If true, channelId is not required."),
    userIds: z
        .array(NonEmptyString)
        .nullable()
        .describe("Slack user IDs when using listenToUserDms. Get IDs via fetchResourcesForIntegration with integrationType=SLACK and options.slack.objectType='users'.")
})

export const SlackOutputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK_OUTPUT),
    integrationType: z.literal(IntegrationType.SLACK),
    channelId: NonEmptyString.nullable().optional().describe("Slack channel or DM channel ID. Required if userIds is empty; otherwise optional (DM channel IDs are resolved from userIds)."),
    channelName: NonEmptyString.nullable().optional().describe("The channel display name. From fetchResourcesForIntegration, use resources[].name."),
    userIds: z
        .array(NonEmptyString)
        .nullable()
        .optional()
        .describe(
            "Slack user IDs to send DMs to; used when destination is direct messages. Get IDs via fetchResourcesForIntegration with integrationType=SLACK and options.slack.objectType='users'. At least one of channelId or userIds required."
        )
})

export const NotionConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.NOTION),
    integrationType: z.literal(IntegrationType.NOTION),
    databaseIds: z.array(z.string()).optional().default([]).describe("Allowed Notion database IDs. From fetchResourcesForIntegration, use databases' id from resources[]."),
    databaseNames: z.array(z.string()).optional().default([]).describe("Display names for databases, parallel to databaseIds."),
    pageIds: z
        .array(z.string())
        .optional()
        .default([])
        .describe("Allowed Notion page IDs. From fetchResourcesForIntegration, use pages' id from resources[]. At least one of databaseIds or pageIds required."),
    pageNames: z.array(z.string()).optional().default([]).describe("Display names for pages, parallel to pageIds.")
})

export const LinearInputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_INPUT),
    integrationType: z.literal(IntegrationType.LINEAR),
    projectId: NonEmptyString.nullable().describe("The Linear project ID. From fetchResourcesForIntegration, use the project's id from resources[]."),
    projectName: z.string().nullable().describe("The project display name. From fetchResourcesForIntegration, use the project's name from resources[].")
})

export const LinearOutputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_OUTPUT),
    integrationType: z.literal(IntegrationType.LINEAR),
    teamId: NonEmptyString.nullable().describe("The Linear team ID. From fetchResourcesForIntegration, use the team's id from resources[]."),
    teamName: z.string().nullable().describe("The team display name. From fetchResourcesForIntegration, use the team's name from resources[].")
})

export const GitHubConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GITHUB),
    integrationType: z.literal(IntegrationType.GITHUB),
    repositoryIds: z.array(z.number()).min(1).describe("Array of GitHub repository IDs (numeric). From fetchResourcesForIntegration, use the repo's id from resources[].")
})

export const GitHubKnowledgeBaseConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GITHUB_KB).describe("Use ONLY for GitHub repository knowledge bases. Do NOT use for PostHog, LaunchDarkly, or Datadog."),
    integrationType: z.literal(IntegrationType.GITHUB),
    repositoryIds: z.array(z.number()).min(1).describe("Array of GitHub repository IDs (numeric). From fetchResourcesForIntegration, use the repo's id from resources[]."),
    repositoryNames: z
        .array(NonEmptyString)
        .min(1)
        .describe("Array of repository names matching the repositoryIds. From fetchResourcesForIntegration, use the repo's name from resources[]. IMPORTANT: Must be owner/repo format.")
})

export const JiraConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.JIRA),
    integrationType: z.literal(IntegrationType.ATLASSIAN),
    projectKey: NonEmptyString.nullable(),
    projectId: NonEmptyString.nullable()
})

export const ConfluenceConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.CONFLUENCE),
    integrationType: z.literal(IntegrationType.ATLASSIAN),
    spaceName: NonEmptyString,
    spaceId: NonEmptyString,
    pageId: NonEmptyString,
    pageName: NonEmptyString
})

export const PosthogConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.POSTHOG).describe("Use for PostHog analytics knowledge bases. Requires projectId."),
    integrationType: z.literal(IntegrationType.POSTHOG),
    projectId: NonEmptyString.describe("The PostHog project ID. From fetchResourcesForIntegration with integrationType=POSTHOG, use resources[].id."),
    projectName: z.string().nullable().describe("The PostHog project name. From fetchResourcesForIntegration, use resources[].name.")
})

export const LaunchDarklyConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LAUNCHDARKLY).describe("Use for LaunchDarkly feature flag knowledge bases. Requires projectKey and environmentKeys."),
    integrationType: z.literal(IntegrationType.LAUNCHDARKLY),
    projectKey: NonEmptyString.describe("The LaunchDarkly project key. From fetchResourcesForIntegration with integrationType=LAUNCHDARKLY."),
    environmentKeys: z.array(NonEmptyString).min(1).describe("Array of LaunchDarkly environment keys to include.")
})

export const DatadogConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.DATADOG).describe("Use for Datadog log knowledge bases."),
    integrationType: z.literal(IntegrationType.DATADOG),
    defaultIndexes: z.array(NonEmptyString).default(["main"]).describe('Log indexes to search (e.g. ["main"]). From fetchResourcesForIntegration or use ["main"].')
})

export const LinearKnowledgeBaseConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_KB).describe("Use for Linear ticket knowledge bases. Search and read Linear issues."),
    integrationType: z.literal(IntegrationType.LINEAR),
    teamId: z.string().nullable().optional(),
    teamName: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    projectName: z.string().nullable().optional()
})

export const SlackKnowledgeBaseConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK_KB).describe("Use for Slack conversation history."),
    integrationType: z.literal(IntegrationType.SLACK),
    channelId: z
        .string()
        .nullable()
        .optional()
        .describe("When not in DMs mode: selected channel ID to read. Obtain from fetchResourcesForIntegration with integrationType=SLACK (channels). Required when allowDms is false."),
    allowDms: z.boolean().optional().default(false).describe("True = Direct messages mode. When true, channelId must be empty; userIds optional (empty = all DMs)."),
    userIds: z
        .array(z.string())
        .nullable()
        .optional()
        .describe("When allowDms is true: optional user IDs to restrict which DMs to read. Obtain from fetchResourcesForIntegration with options.slack.objectType='users'. Leave empty for all DMs."),
    channelName: z.string().nullable().optional().describe("Display name for the channel (UI only, not persisted)."),
    userNames: z.array(z.string()).nullable().optional().describe("Display names for users (UI only, not persisted).")
})

export const WorkOSInputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.WORKOS_INPUT),
    integrationType: z.literal(IntegrationType.WORKOS),
    eventTypes: z.array(z.enum(WORKOS_SUPPORTED_EVENT_NAMES)).min(1).describe("WorkOS event types to trigger on.")
})

export const TimeTriggerConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.TIME_TRIGGER),
    integrationType: z.literal(IntegrationType.CRON_JOB),
    integrationId: z.literal("system"),
    cronExpression: z
        .string()
        .describe('ALL TIMES ARE IN UTC. The cron expression to schedule the automation. Must be a valid cron expression. Use this format: "minute hour day-of-month month day-of-week"')
})

export function enforceNonSystemIntegrationId(config: { configType: ConfigType; integrationId?: string }, ctx: z.RefinementCtx): void {
    if (config.configType !== ConfigType.TIME_TRIGGER && config.integrationId === "system") {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'integrationId must not be "system" unless configType is TIME_TRIGGER.'
        })
    }
}
