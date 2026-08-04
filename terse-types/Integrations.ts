import * as z from "zod"

// IMPORTANT: CHANGE THIS FOR NEW INTEGRATIONS. SHOULD MATCH PRISMA ENUM
export enum IntegrationType {
    GITHUB = "github",
    HEY_REACH = "hey_reach",
    RESEND = "resend",
    APOLLO = "apollo",
    GMAIL = "gmail",
    LINEAR = "linear",
    SLACK = "slack",
    NOTION = "notion",
    TERSE = "terse",
    POSTHOG = "posthog",
    DATADOG = "datadog",
    CRON_JOB = "cron_job",
    LAUNCHDARKLY = "launchdarkly",
    WORKOS = "workos",
    ATTIO = "attio",
    SNOWFLAKE = "snowflake",
    WEBHOOK = "webhook",
    WEBMONITOR = "webmonitor",
    GOOGLE_SEARCH_CONSOLE = "google_search_console",
    META_ADS = "meta_ads",
    HIGGSFIELD = "higgsfield"
}
export const integrationTypeEnum = z.enum(IntegrationType)

export const BUILT_IN_INTEGRATION_TYPES = [IntegrationType.TERSE, IntegrationType.CRON_JOB, IntegrationType.WEBHOOK, IntegrationType.WEBMONITOR] as const
export type BuiltInIntegrationType = (typeof BUILT_IN_INTEGRATION_TYPES)[number]
export type ExternalIntegrationType = Exclude<IntegrationType, BuiltInIntegrationType>

const builtInIntegrationTypes: ReadonlySet<IntegrationType> = new Set(BUILT_IN_INTEGRATION_TYPES)

export function isBuiltInIntegrationType(type: IntegrationType): type is BuiltInIntegrationType {
    return builtInIntegrationTypes.has(type)
}

export function isExternalIntegrationType(type: IntegrationType): type is ExternalIntegrationType {
    return !isBuiltInIntegrationType(type)
}

export const EXTERNAL_INTEGRATION_TYPES: readonly ExternalIntegrationType[] = Object.values(IntegrationType).filter(isExternalIntegrationType)

// MARK: Integration Metadata
export interface IntegrationDetails {
    type: IntegrationType
    name: string
    description: string
    isInput?: boolean
    isOutput?: boolean
}

// Metadata objects - using const objects instead of classes
export const GmailIntegrationMetadata = {
    type: IntegrationType.GMAIL,
    name: "Gmail",
    description: "Monitor incoming emails",
    isInput: true,
    isOutput: false
} as const satisfies IntegrationDetails

export const GoogleSearchConsoleIntegrationMetadata = {
    type: IntegrationType.GOOGLE_SEARCH_CONSOLE,
    name: "Google Search Console",
    description: "Read Search Analytics data and manage connected Sites",
    isInput: false,
    isOutput: true
} as const satisfies IntegrationDetails

export const NotionIntegrationMetadata = {
    type: IntegrationType.NOTION,
    name: "Notion",
    description: "Update living documents",
    isInput: false,
    isOutput: true
} as const satisfies IntegrationDetails

export const LinearIntegrationMetadata = {
    type: IntegrationType.LINEAR,
    name: "Linear",
    description: "Update tasks in Linear",
    isInput: false,
    isOutput: true
} as const satisfies IntegrationDetails

export const SlackIntegrationMetadata = {
    type: IntegrationType.SLACK,
    name: "Slack",
    description: "Send and receive messages in Slack (channels, group DMs, and DMs). Triggers can use user token to read your DMs; skills can send to channels or users with either token.",
    isInput: true,
    isOutput: true
} as const satisfies IntegrationDetails

export const GithubIntegrationMetadata = {
    type: IntegrationType.GITHUB,
    name: "Github",
    description: "Update repositories in Github",
    isInput: true,
    isOutput: true
} as const satisfies IntegrationDetails

export const TerseIntegrationMetadata = {
    type: IntegrationType.TERSE,
    name: "Terse",
    description: "Platform tools",
    isInput: false,
    isOutput: false
} as const satisfies IntegrationDetails

export const PosthogIntegrationMetadata = {
    type: IntegrationType.POSTHOG,
    name: "Posthog",
    description: "Update events in Posthog",
    isInput: false,
    isOutput: true
} as const satisfies IntegrationDetails

export const DatadogIntegrationMetadata = {
    type: IntegrationType.DATADOG,
    name: "Datadog",
    description: "Search logs in Datadog",
    isInput: false,
    isOutput: true
} as const satisfies IntegrationDetails

export const CronJobIntegrationMetadata = {
    type: IntegrationType.CRON_JOB,
    name: "Scheduled Jobs",
    description: "System integration for time-based triggers",
    isInput: true,
    isOutput: false
} as const satisfies IntegrationDetails

export const WebMonitorIntegrationMetadata = {
    type: IntegrationType.WEBMONITOR,
    name: "Web Monitor",
    description: "Trigger when scheduled web monitoring detects relevant changes",
    isInput: true,
    isOutput: false
} as const satisfies IntegrationDetails

export const LaunchDarklyIntegrationMetadata = {
    type: IntegrationType.LAUNCHDARKLY,
    name: "LaunchDarkly",
    description: "Track feature flags",
    isInput: false,
    isOutput: true
} as const satisfies IntegrationDetails

export const WorkOSIntegrationMetadata = {
    type: IntegrationType.WORKOS,
    name: "WorkOS",
    description: "Trigger on user lifecycle events and fetch/search users from your WorkOS account",
    isInput: true,
    isOutput: true
} as const satisfies IntegrationDetails

export const AttioIntegrationMetadata = {
    type: IntegrationType.ATTIO,
    name: "Attio",
    description: "Trigger on Attio record events and add/update contacts in Attio",
    isInput: true,
    isOutput: true
} as const satisfies IntegrationDetails

export const SnowflakeIntegrationMetadata = {
    type: IntegrationType.SNOWFLAKE,
    name: "Snowflake",
    description: "Run read-only queries against Snowflake data warehouses",
    isInput: false,
    isOutput: true
} as const satisfies IntegrationDetails

export const WebhookIntegrationMetadata = {
    type: IntegrationType.WEBHOOK,
    name: "Webhook",
    description: "Trigger via an external HTTP request to a generated URL",
    isInput: true,
    isOutput: false
} as const satisfies IntegrationDetails

export const HeyReachIntegrationMetadata = {
    type: IntegrationType.HEY_REACH,
    name: "HeyReach",
    description: "Trigger on HeyReach LinkedIn outreach events (replies, connections, campaign completions, etc.)",
    isInput: true,
    isOutput: false
} as const satisfies IntegrationDetails

export const MetaAdsIntegrationMetadata = {
    type: IntegrationType.META_ADS,
    name: "Meta Ads",
    description: "Read Meta ad campaign performance, sync custom audiences, and send offline conversions",
    isInput: false,
    isOutput: true
} as const satisfies IntegrationDetails

export const ResendIntegrationMetadata = {
    type: IntegrationType.RESEND,
    name: "Resend",
    description: "Send transactional email using published Resend templates",
    isInput: false,
    isOutput: true
} as const satisfies IntegrationDetails

export const HiggsfieldIntegrationMetadata = {
    type: IntegrationType.HIGGSFIELD,
    name: "Higgsfield",
    description: "Generate ad creative images from a text prompt using Higgsfield",
    isInput: false,
    isOutput: true
} as const satisfies IntegrationDetails

export const ApolloIntegrationMetadata = {
    type: IntegrationType.APOLLO,
    name: "Apollo",
    description: "Enrich people and companies and search for prospects using Apollo.io",
    isInput: false,
    isOutput: true
} as const satisfies IntegrationDetails

export type IntegrationMetadataMap = Record<IntegrationType, IntegrationDetails> // Allow indexing with any IntegrationType

export const INTEGRATION_METADATA: IntegrationMetadataMap = {
    [IntegrationType.GMAIL]: GmailIntegrationMetadata,
    [IntegrationType.GOOGLE_SEARCH_CONSOLE]: GoogleSearchConsoleIntegrationMetadata,
    [IntegrationType.NOTION]: NotionIntegrationMetadata,
    [IntegrationType.LINEAR]: LinearIntegrationMetadata,
    [IntegrationType.SLACK]: SlackIntegrationMetadata,
    [IntegrationType.GITHUB]: GithubIntegrationMetadata,
    [IntegrationType.TERSE]: TerseIntegrationMetadata,
    [IntegrationType.POSTHOG]: PosthogIntegrationMetadata,
    [IntegrationType.DATADOG]: DatadogIntegrationMetadata,
    [IntegrationType.CRON_JOB]: CronJobIntegrationMetadata,
    [IntegrationType.LAUNCHDARKLY]: LaunchDarklyIntegrationMetadata,
    [IntegrationType.WORKOS]: WorkOSIntegrationMetadata,
    [IntegrationType.ATTIO]: AttioIntegrationMetadata,
    [IntegrationType.SNOWFLAKE]: SnowflakeIntegrationMetadata,
    [IntegrationType.WEBHOOK]: WebhookIntegrationMetadata,
    [IntegrationType.WEBMONITOR]: WebMonitorIntegrationMetadata,
    [IntegrationType.HEY_REACH]: HeyReachIntegrationMetadata,
    [IntegrationType.RESEND]: ResendIntegrationMetadata,
    [IntegrationType.APOLLO]: ApolloIntegrationMetadata,
    [IntegrationType.META_ADS]: MetaAdsIntegrationMetadata,
    [IntegrationType.HIGGSFIELD]: HiggsfieldIntegrationMetadata
} as const satisfies IntegrationMetadataMap

// MARK: Integration Details
export const IntegrationInstanceSchema = z.object({
    id: z.string()
})
export type IntegrationInstance = z.infer<typeof IntegrationInstanceSchema>

export const NoInstallationOptionsSchema = z.object({}).strict()
export type NoInstallationOptions = z.infer<typeof NoInstallationOptionsSchema>

export const SlackInstallationOptionsSchema = z
    .object({
        isBotUser: z.boolean()
    })
    .strict()
export type SlackInstallationOptions = z.infer<typeof SlackInstallationOptionsSchema>

export type AdditionalStateParams = Record<string, string>

// Exhaustive schema map keyed by IntegrationType — adding a new IntegrationType without
// adding an entry here is a compile error.
export const InstallationOptionsSchemas = {
    [IntegrationType.SLACK]: SlackInstallationOptionsSchema,
    [IntegrationType.GMAIL]: NoInstallationOptionsSchema,
    [IntegrationType.GOOGLE_SEARCH_CONSOLE]: NoInstallationOptionsSchema,
    [IntegrationType.NOTION]: NoInstallationOptionsSchema,
    [IntegrationType.LINEAR]: NoInstallationOptionsSchema,
    [IntegrationType.GITHUB]: NoInstallationOptionsSchema,
    [IntegrationType.TERSE]: NoInstallationOptionsSchema,
    [IntegrationType.POSTHOG]: NoInstallationOptionsSchema,
    [IntegrationType.DATADOG]: NoInstallationOptionsSchema,
    [IntegrationType.CRON_JOB]: NoInstallationOptionsSchema,
    [IntegrationType.LAUNCHDARKLY]: NoInstallationOptionsSchema,
    [IntegrationType.WORKOS]: NoInstallationOptionsSchema,
    [IntegrationType.ATTIO]: NoInstallationOptionsSchema,
    [IntegrationType.SNOWFLAKE]: NoInstallationOptionsSchema,
    [IntegrationType.WEBHOOK]: NoInstallationOptionsSchema,
    [IntegrationType.WEBMONITOR]: NoInstallationOptionsSchema,
    [IntegrationType.HEY_REACH]: NoInstallationOptionsSchema,
    [IntegrationType.RESEND]: NoInstallationOptionsSchema,
    [IntegrationType.APOLLO]: NoInstallationOptionsSchema,
    [IntegrationType.META_ADS]: NoInstallationOptionsSchema,
    [IntegrationType.HIGGSFIELD]: NoInstallationOptionsSchema
} as const satisfies Record<IntegrationType, z.ZodTypeAny>

export type InstallationOptionsFor<T extends IntegrationType> = z.infer<(typeof InstallationOptionsSchemas)[T]>

export const SlackIntegrationSchema = IntegrationInstanceSchema.extend({
    teamId: z.string().optional(),
    teamName: z.string().optional(),
    isBotUser: z.boolean().optional()
})
export type SlackIntegration = z.infer<typeof SlackIntegrationSchema>

export const GmailIntegrationSchema = IntegrationInstanceSchema.extend({
    email: z.email(),
    historyId: z.string().optional(),
    watchExpiration: z.date().optional()
})
export type GmailIntegration = z.infer<typeof GmailIntegrationSchema>

export const GoogleSearchConsoleIntegrationSchema = IntegrationInstanceSchema.extend({
    email: z.email(),
    googleAccountId: z.string()
})
export type GoogleSearchConsoleIntegration = z.infer<typeof GoogleSearchConsoleIntegrationSchema>

export const googleSearchConsolePermissionLevelSchema = z.enum(["siteFullUser", "siteOwner", "siteRestrictedUser", "siteUnverifiedUser"])

export const googleSearchConsoleSiteSchema = z.object({
    siteUrl: z.string(),
    permissionLevel: googleSearchConsolePermissionLevelSchema
})
export type GoogleSearchConsoleSite = z.infer<typeof googleSearchConsoleSiteSchema>

export const googleSearchConsoleSitesResponseSchema = z.object({
    sites: z.array(googleSearchConsoleSiteSchema)
})
export type GoogleSearchConsoleSitesResponse = z.infer<typeof googleSearchConsoleSitesResponseSchema>

export const NotionIntegrationSchema = IntegrationInstanceSchema.extend({
    workspaceId: z.string().optional(),
    workspaceName: z.string().optional()
})
export type NotionIntegration = z.infer<typeof NotionIntegrationSchema>

export const GithubIntegrationSchema = IntegrationInstanceSchema.extend({
    installation_id: z.number().int(),
    account_name: z.string().optional()
})
export type GithubIntegration = z.infer<typeof GithubIntegrationSchema>

export const LinearIntegrationSchema = IntegrationInstanceSchema.extend({
    workspaceName: z.string()
})
export type LinearIntegration = z.infer<typeof LinearIntegrationSchema>

export const PosthogIntegrationSchema = IntegrationInstanceSchema.extend({
    email: z.email().optional(),
    orgName: z.string().optional()
})
export type PosthogIntegration = z.infer<typeof PosthogIntegrationSchema>

export const HeyReachIntegrationSchema = IntegrationInstanceSchema
export type HeyReachIntegration = z.infer<typeof HeyReachIntegrationSchema>

export const ResendIntegrationSchema = IntegrationInstanceSchema
export type ResendIntegration = z.infer<typeof ResendIntegrationSchema>

export const HiggsfieldIntegrationSchema = IntegrationInstanceSchema
export type HiggsfieldIntegration = z.infer<typeof HiggsfieldIntegrationSchema>

export const ApolloIntegrationSchema = IntegrationInstanceSchema
export type ApolloIntegration = z.infer<typeof ApolloIntegrationSchema>

export const ResendTemplateVariableSchema = z.object({
    key: z.string(),
    type: z.enum(["string", "number"]),
    fallbackValue: z.union([z.string(), z.number()]).nullable()
})
export type ResendTemplateVariable = z.infer<typeof ResendTemplateVariableSchema>

export const ResendTemplateSchema = z.object({
    id: z.string(),
    alias: z.string().nullable(),
    name: z.string(),
    status: z.string(),
    variables: z.array(ResendTemplateVariableSchema)
})
export type ResendTemplate = z.infer<typeof ResendTemplateSchema>

export const LaunchDarklyIntegrationSchema = IntegrationInstanceSchema.extend({
    email: z.email().optional(),
    tokenName: z.string().optional()
})
export type LaunchDarklyIntegration = z.infer<typeof LaunchDarklyIntegrationSchema>

export const DatadogIntegrationSchema = IntegrationInstanceSchema.extend({
    region: z.string()
})
export type DatadogIntegration = z.infer<typeof DatadogIntegrationSchema>

export const WorkOSIntegrationSchema = IntegrationInstanceSchema.extend({
    webhookUrl: z.string(),
    environment: z.enum(["live", "test"])
})
export type WorkOSIntegration = z.infer<typeof WorkOSIntegrationSchema>

export const AttioIntegrationSchema = IntegrationInstanceSchema.extend({
    workspaceName: z.string().optional()
})
export type AttioIntegration = z.infer<typeof AttioIntegrationSchema>

export const SnowflakeIntegrationSchema = IntegrationInstanceSchema.extend({
    accountIdentifier: z.string(),
    username: z.string(),
    warehouse: z.string(),
    databaseName: z.string().optional(),
    schemaName: z.string().optional()
})
export type SnowflakeIntegration = z.infer<typeof SnowflakeIntegrationSchema>

export const MetaAdsIntegrationSchema = IntegrationInstanceSchema.extend({
    accountName: z.string().optional()
})
export type MetaAdsIntegration = z.infer<typeof MetaAdsIntegrationSchema>

export const MetaAdsAdAccountSchema = z.object({
    id: z.string(),
    accountId: z.string(),
    name: z.string(),
    currency: z.string().optional(),
    accountStatus: z.number().optional()
})
export type MetaAdsAdAccount = z.infer<typeof MetaAdsAdAccountSchema>

export const CliIntegrationDisplayStateSchema = z.discriminatedUnion("status", [
    z.object({
        status: z.literal("not_connected")
    }),
    z.object({
        status: z.literal("connected"),
        connectionLabel: z.string(),
        connectionName: z.string(),
        integrationId: z.string()
    })
])
export type CliIntegrationDisplayState = z.infer<typeof CliIntegrationDisplayStateSchema>

export const IntegrationWithStatusSchema = z.object({
    integrationType: integrationTypeEnum,
    isActive: z.boolean(),
    cliDisplayState: CliIntegrationDisplayStateSchema
})
export type IntegrationWithStatus = z.infer<typeof IntegrationWithStatusSchema>

export const IntegrationConnectionSchema = z.object({
    id: z.string(),
    name: z.string()
})
export type IntegrationConnection = z.infer<typeof IntegrationConnectionSchema>

export const IntegrationConnectionsResponseSchema = z.object({
    connections: z.array(IntegrationConnectionSchema)
})
export type IntegrationConnectionsResponse = z.infer<typeof IntegrationConnectionsResponseSchema>
