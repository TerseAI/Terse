// IMPORTANT: CHANGE THIS FOR NEW INTEGRATIONS. SHOULD MATCH PRISMA ENUM
export enum IntegrationType {
    GITHUB = "github",
    GMAIL = "gmail",
    LINEAR = "linear",
    ATLASSIAN = "atlassian",
    SLACK = "slack",
    NOTION = "notion",
    FIGMA = "figma",
    TERSE = "terse",
    POSTHOG = "posthog",
    DATADOG = "datadog",
    CRON_JOB = "cron_job",
    LAUNCHDARKLY = "launchdarkly",
    WORKOS = "workos"
}

// MARK: Integration Metadata
export interface IntegrationDetails {
    type: IntegrationType
    name: string
    description: string
    isInput?: boolean
    isOutput?: boolean
    isKnowledgeBase?: boolean
}

// Metadata objects - using const objects instead of classes
export const GmailIntegrationMetadata = {
    type: IntegrationType.GMAIL,
    name: "Gmail",
    description: "Monitor incoming emails",
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies IntegrationDetails

export const NotionIntegrationMetadata = {
    type: IntegrationType.NOTION,
    name: "Notion",
    description: "Update living documents",
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false
} as const satisfies IntegrationDetails

export const LinearIntegrationMetadata = {
    type: IntegrationType.LINEAR,
    name: "Linear",
    description: "Update tasks in Linear",
    isInput: false,
    isOutput: true,
    isKnowledgeBase: true
} as const satisfies IntegrationDetails

export const SlackIntegrationMetadata = {
    type: IntegrationType.SLACK,
    name: "Slack",
    description:
        "Send and receive messages in Slack (channels, group DMs, and DMs). Triggers and knowledge base can use user token to read your DMs; output can send to channels or users with either token.",
    isInput: true,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies IntegrationDetails

export const FigmaIntegrationMetadata = {
    type: IntegrationType.FIGMA,
    name: "Figma",
    description: "Trigger on Figma file comments (does not support file edits or design changes)",
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies IntegrationDetails

export const AtlassianIntegrationMetadata = {
    type: IntegrationType.ATLASSIAN,
    name: "Atlassian",
    description: "Update documents in Atlassian",
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies IntegrationDetails

export const GithubIntegrationMetadata = {
    type: IntegrationType.GITHUB,
    name: "Github",
    description: "Update repositories in Github",
    isInput: true,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies IntegrationDetails

export const TerseIntegrationMetadata = {
    type: IntegrationType.TERSE,
    name: "Terse",
    description: "Platform tools",
    isInput: false,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies IntegrationDetails

export const PosthogIntegrationMetadata = {
    type: IntegrationType.POSTHOG,
    name: "Posthog",
    description: "Update events in Posthog",
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies IntegrationDetails

export const DatadogIntegrationMetadata = {
    type: IntegrationType.DATADOG,
    name: "Datadog",
    description: "Search logs in Datadog",
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies IntegrationDetails

export const CronJobIntegrationMetadata = {
    type: IntegrationType.CRON_JOB,
    name: "Scheduled Jobs",
    description: "System integration for time-based triggers",
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies IntegrationDetails

export const LaunchDarklyIntegrationMetadata = {
    type: IntegrationType.LAUNCHDARKLY,
    name: "LaunchDarkly",
    description: "Track feature flags",
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies IntegrationDetails

export const WorkOSIntegrationMetadata = {
    type: IntegrationType.WORKOS,
    name: "WorkOS",
    description: "Trigger on user lifecycle events from your WorkOS account",
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies IntegrationDetails

export type IntegrationMetadataMap = Record<IntegrationType, IntegrationDetails> // Allow indexing with any IntegrationType

export const INTEGRATION_METADATA: IntegrationMetadataMap = {
    [IntegrationType.GMAIL]: GmailIntegrationMetadata,
    [IntegrationType.NOTION]: NotionIntegrationMetadata,
    [IntegrationType.LINEAR]: LinearIntegrationMetadata,
    [IntegrationType.ATLASSIAN]: AtlassianIntegrationMetadata,
    [IntegrationType.SLACK]: SlackIntegrationMetadata,
    [IntegrationType.GITHUB]: GithubIntegrationMetadata,
    [IntegrationType.FIGMA]: FigmaIntegrationMetadata,
    [IntegrationType.TERSE]: TerseIntegrationMetadata,
    [IntegrationType.POSTHOG]: PosthogIntegrationMetadata,
    [IntegrationType.DATADOG]: DatadogIntegrationMetadata,
    [IntegrationType.CRON_JOB]: CronJobIntegrationMetadata,
    [IntegrationType.LAUNCHDARKLY]: LaunchDarklyIntegrationMetadata,
    [IntegrationType.WORKOS]: WorkOSIntegrationMetadata
} as const satisfies IntegrationMetadataMap

// MARK: Integration Details
export interface IntegrationInstance {
    id: string
}

export interface SlackInstallationOptions {
    isBotUser: boolean
}

export type NoInstallationOptions = Record<string, never>

export type AdditionalStateParams = Record<string, string>

type EnsureExhaustiveInstallationOptions<T extends Record<IntegrationType, NoInstallationOptions | SlackInstallationOptions>> = T

export type IntegrationInstallationOptions = EnsureExhaustiveInstallationOptions<{
    [IntegrationType.SLACK]: SlackInstallationOptions
    [IntegrationType.GMAIL]: NoInstallationOptions
    [IntegrationType.NOTION]: NoInstallationOptions
    [IntegrationType.LINEAR]: NoInstallationOptions
    [IntegrationType.ATLASSIAN]: NoInstallationOptions
    [IntegrationType.GITHUB]: NoInstallationOptions
    [IntegrationType.FIGMA]: NoInstallationOptions
    [IntegrationType.TERSE]: NoInstallationOptions
    [IntegrationType.POSTHOG]: NoInstallationOptions
    [IntegrationType.DATADOG]: NoInstallationOptions
    [IntegrationType.CRON_JOB]: NoInstallationOptions
    [IntegrationType.LAUNCHDARKLY]: NoInstallationOptions
    [IntegrationType.WORKOS]: NoInstallationOptions
}>

export type InstallationOptionsFor<T extends IntegrationType> = IntegrationInstallationOptions[T]

export interface SlackIntegration extends IntegrationInstance {
    id: string
    teamId?: string
    teamName?: string
    isBotUser?: boolean
}

export interface GmailIntegration extends IntegrationInstance {
    id: string
    email: string // User's Gmail address
    historyId: string // For tracking changes since last sync
    watchExpiration: Date // When the watch needs to be renewed (max 7 days)
}

export interface FigmaIntegration extends IntegrationInstance {
    id: string
    handle: string
    figma_user_id: string
    token_expiry: Date
}

export interface NotionIntegration extends IntegrationInstance {
    id: string
    workspaceId?: string
    workspaceName?: string
}

export interface AtlassianIntegration extends IntegrationInstance {
    id: string
    baseUrl: string
    email: string
    siteName?: string
    projectKey?: string
    projectName?: string
}

export interface GithubIntegration extends IntegrationInstance {
    id: string
    installation_id: number
    account_name?: string | null // GitHub username or organization name where the app was installed
}

export interface LinearIntegration extends IntegrationInstance {
    id: string
    workspaceName: string
}

export interface PosthogIntegration extends IntegrationInstance {
    id: string
    email: string | null
    orgName: string | null
}

export interface LaunchDarklyIntegration extends IntegrationInstance {
    id: string
    email: string | null
    tokenName: string | null
}
export interface DatadogIntegration extends IntegrationInstance {
    id: string
    region: string
}

export interface WorkOSIntegration extends IntegrationInstance {
    id: string
    webhookUrl: string
    environment: "live" | "test" | null
}

export interface IntegrationWithStatus {
    integrationType: IntegrationType
    isActive: boolean
}
