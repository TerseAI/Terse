import { IntegrationType } from "./Integrations"

export enum ConfigType {
    GMAIL = "gmail",
    GMAIL_OUTPUT = "gmail_output",
    GMAIL_DRAFT_OUTPUT = "gmail_draft_output",
    FIGMA = "figma",
    SLACK = "slack",
    SLACK_OUTPUT = "slack_output",
    NOTION = "notion",
    LINEAR_INPUT = "linear_input",
    LINEAR_OUTPUT = "linear_output",
    GITHUB = "github",
    GITHUB_KB = "github_kb",
    JIRA = "jira",
    CONFLUENCE = "confluence",
    POSTHOG = "POSTHOG",
    DATADOG = "DATADOG",
    TIME_TRIGGER = "time_trigger",
    LAUNCHDARKLY = "launchdarkly",
    LINEAR_KB = "linear_kb",
    SLACK_KB = "slack_kb",
    TERSE = "terse",
    WORKOS_INPUT = "workos_input",
    WORKOS_KB = "workos_kb",
    ATTIO_OUTPUT = "attio_output"
}

// MARK: Config Metadata
export interface ConfigDetails {
    configType: ConfigType
    name: string
    description: string
    integrationType: IntegrationType
    isInput: boolean
    isOutput: boolean
    isKnowledgeBase: boolean
}

// Metadata objects - using const objects instead of classes
export const GmailConfigMetadata = {
    configType: ConfigType.GMAIL,
    name: "Gmail",
    description: "Monitor incoming emails",
    integrationType: IntegrationType.GMAIL,
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const FigmaConfigMetadata = {
    configType: ConfigType.FIGMA,
    name: "Figma",
    description: "Monitor design changes in Figma files",
    integrationType: IntegrationType.FIGMA,
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const SlackConfigMetadata = {
    configType: ConfigType.SLACK,
    name: "Slack",
    description: "Monitor messages in Slack channels or DMs",
    integrationType: IntegrationType.SLACK,
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const SlackOutputConfigMetadata = {
    configType: ConfigType.SLACK_OUTPUT,
    name: "Slack",
    description: "Send messages to Slack channels, group DMs, or direct messages",
    integrationType: IntegrationType.SLACK,
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const GmailOutputConfigMetadata = {
    configType: ConfigType.GMAIL_OUTPUT,
    name: "Gmail",
    description: "Send emails via Gmail",
    integrationType: IntegrationType.GMAIL,
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const GmailDraftOutputConfigMetadata = {
    configType: ConfigType.GMAIL_DRAFT_OUTPUT,
    name: "Gmail Draft",
    description: "Create draft emails in Gmail",
    integrationType: IntegrationType.GMAIL,
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const NotionConfigMetadata = {
    configType: ConfigType.NOTION,
    name: "Notion",
    description: "Update and monitor Notion pages and databases",
    integrationType: IntegrationType.NOTION,
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const LinearInputConfigMetadata = {
    configType: ConfigType.LINEAR_INPUT,
    name: "Linear",
    description: "Monitor Linear issues",
    integrationType: IntegrationType.LINEAR,
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const LinearOutputConfigMetadata = {
    configType: ConfigType.LINEAR_OUTPUT,
    name: "Linear",
    description: "Update Linear issues",
    integrationType: IntegrationType.LINEAR,
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const GitHubConfigMetadata = {
    configType: ConfigType.GITHUB,
    name: "GitHub",
    description: "Monitor GitHub repository events",
    integrationType: IntegrationType.GITHUB,
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const JiraConfigMetadata = {
    configType: ConfigType.JIRA,
    name: "Jira",
    description: "Monitor and update Jira issues",
    integrationType: IntegrationType.ATLASSIAN,
    isInput: true,
    isOutput: true,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const ConfluenceConfigMetadata = {
    configType: ConfigType.CONFLUENCE,
    name: "Confluence",
    description: "Update Confluence pages",
    integrationType: IntegrationType.ATLASSIAN,
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const PosthogConfigMetadata = {
    configType: ConfigType.POSTHOG,
    name: "Posthog",
    description: "Track user events",
    integrationType: IntegrationType.POSTHOG,
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies ConfigDetails

export const DatadogConfigMetadata = {
    configType: ConfigType.DATADOG,
    name: "Datadog",
    description: "Search logs in Datadog",
    integrationType: IntegrationType.DATADOG,
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies ConfigDetails

export const TimeTriggerConfigMetadata = {
    configType: ConfigType.TIME_TRIGGER,
    name: "Time Trigger",
    description: "Run on a schedule (daily, weekly, etc.)",
    integrationType: IntegrationType.CRON_JOB,
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const GitHubKBConfigMetadata = {
    configType: ConfigType.GITHUB_KB,
    name: "GitHub Codebase",
    description: "Search and read code in repositories",
    integrationType: IntegrationType.GITHUB,
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies ConfigDetails

export const LaunchDarklyConfigMetadata = {
    configType: ConfigType.LAUNCHDARKLY,
    name: "LaunchDarkly",
    description: "Query feature flags",
    integrationType: IntegrationType.LAUNCHDARKLY,
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies ConfigDetails

export const LinearKBConfigMetadata = {
    configType: ConfigType.LINEAR_KB,
    name: "Linear",
    description: "Search and read Linear tickets",
    integrationType: IntegrationType.LINEAR,
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies ConfigDetails

export const SlackKBConfigMetadata = {
    configType: ConfigType.SLACK_KB,
    name: "Slack",
    description: "Read Slack conversation history",
    integrationType: IntegrationType.SLACK,
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies ConfigDetails

export const TerseConfigMetadata = {
    configType: ConfigType.TERSE,
    name: "Terse Skills",
    description: "Built-in capabilities like web search (always available to agents)",
    integrationType: IntegrationType.TERSE,
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const WorkOSInputConfigMetadata = {
    configType: ConfigType.WORKOS_INPUT,
    name: "WorkOS",
    description: "Trigger on user signup, deletion, or membership changes in your app",
    integrationType: IntegrationType.WORKOS,
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export const WorkOSKBConfigMetadata = {
    configType: ConfigType.WORKOS_KB,
    name: "WorkOS",
    description: "Fetch and search users from your WorkOS account",
    integrationType: IntegrationType.WORKOS,
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies ConfigDetails

export const AttioOutputConfigMetadata = {
    configType: ConfigType.ATTIO_OUTPUT,
    name: "Attio",
    description: "Add and update contacts in Attio",
    integrationType: IntegrationType.ATTIO,
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false
} as const satisfies ConfigDetails

export type ConfigDetailsMap = Record<ConfigType, ConfigDetails>

export const CONFIG_DETAILS: ConfigDetailsMap = {
    [ConfigType.GMAIL]: GmailConfigMetadata,
    [ConfigType.GMAIL_OUTPUT]: GmailOutputConfigMetadata,
    [ConfigType.GMAIL_DRAFT_OUTPUT]: GmailDraftOutputConfigMetadata,
    [ConfigType.FIGMA]: FigmaConfigMetadata,
    [ConfigType.SLACK]: SlackConfigMetadata,
    [ConfigType.SLACK_OUTPUT]: SlackOutputConfigMetadata,
    [ConfigType.NOTION]: NotionConfigMetadata,
    [ConfigType.LINEAR_INPUT]: LinearInputConfigMetadata,
    [ConfigType.LINEAR_OUTPUT]: LinearOutputConfigMetadata,
    [ConfigType.GITHUB]: GitHubConfigMetadata,
    [ConfigType.GITHUB_KB]: GitHubKBConfigMetadata,
    [ConfigType.JIRA]: JiraConfigMetadata,
    [ConfigType.CONFLUENCE]: ConfluenceConfigMetadata,
    [ConfigType.POSTHOG]: PosthogConfigMetadata,
    [ConfigType.DATADOG]: DatadogConfigMetadata,
    [ConfigType.TIME_TRIGGER]: TimeTriggerConfigMetadata,
    [ConfigType.LAUNCHDARKLY]: LaunchDarklyConfigMetadata,
    [ConfigType.LINEAR_KB]: LinearKBConfigMetadata,
    [ConfigType.SLACK_KB]: SlackKBConfigMetadata,
    [ConfigType.TERSE]: TerseConfigMetadata,
    [ConfigType.WORKOS_INPUT]: WorkOSInputConfigMetadata,
    [ConfigType.WORKOS_KB]: WorkOSKBConfigMetadata,
    [ConfigType.ATTIO_OUTPUT]: AttioOutputConfigMetadata
} as const satisfies ConfigDetailsMap

export interface ConfigInstance {
    integrationId: string
    integrationType: IntegrationType
    configType: ConfigType
    isComplete(): boolean
    formatForAgent(): string
}

export class GmailConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.GMAIL
    configType: ConfigType = ConfigType.GMAIL

    constructor(public integrationId: string) {}

    isComplete(): boolean {
        // Gmail only requires integrationId (base check handled in isInputComplete)
        return true
    }

    formatForAgent(): string {
        return `Type: Gmail\nIntegration ID: ${this.integrationId}`
    }
}

export class FigmaConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.FIGMA
    configType: ConfigType = ConfigType.FIGMA

    constructor(
        public integrationId: string,
        public fileKey: string,
        public fileName: string, // Optional display name
        public teamId: string // Figma team ID (required for webhook creation)
    ) {}

    isComplete(): boolean {
        // Figma requires both fileKey and teamId
        return !!(this.fileKey && this.teamId)
    }

    formatForAgent(): string {
        const parts = [`Type: Figma`, `Integration ID: ${this.integrationId}`]
        if (this.fileName) {
            parts.push(`File: ${this.fileName}`)
        }
        if (this.fileKey) {
            parts.push(`File Key: ${this.fileKey}`)
        }
        return parts.join("\n")
    }
}
// Typed config per integration type
export class SlackConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.SLACK
    configType: ConfigType = ConfigType.SLACK

    constructor(
        public integrationId: string,
        public channelId?: string,
        public channelName?: string,
        public listenToUserDms: boolean = false,
        public userIds?: string[]
    ) {}

    isComplete(): boolean {
        // Slack is complete if either channelId is set OR listenToUserDms is true
        return !!(this.channelId || this.listenToUserDms)
    }

    formatForAgent(): string {
        const parts = [`Type: Slack`, `Integration ID: ${this.integrationId}`]
        if (this.channelName) {
            parts.push(`Channel: ${this.channelName}`)
        } else if (this.channelId) {
            parts.push(`Channel ID: ${this.channelId}`)
        }
        if (this.listenToUserDms) {
            parts.push(`Listening to user DMs: Yes`)
        }

        if (this.userIds) {
            parts.push(`Users: ${this.userIds.join(", ")}`)
        }

        return parts.join("\n")
    }
}

export class SlackOutputConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.SLACK
    configType: ConfigType = ConfigType.SLACK_OUTPUT

    constructor(
        public integrationId: string,
        public channelId?: string,
        public channelName?: string,
        public userIds?: string[],
        public userNames?: string[]
    ) {}

    isComplete(): boolean {
        // Slack output is complete if channelId is set or at least one user (DM destination) is set
        return !!(this.channelId || (this.userIds?.length ?? 0) > 0)
    }

    formatForAgent(): string {
        const parts = [`Type: Slack Output`, `Integration ID: ${this.integrationId}`]
        if (this.channelId) {
            parts.push(`Channel ID: ${this.channelId}`)
        }
        if (this.userIds?.length) {
            parts.push(`DM user IDs: ${this.userIds.join(", ")}`)
        }
        return parts.join("\n")
    }
}

export class GmailOutputConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.GMAIL
    configType: ConfigType = ConfigType.GMAIL_OUTPUT

    constructor(public integrationId: string) {}

    isComplete(): boolean {
        // Gmail output only requires integrationId
        return true
    }

    formatForAgent(): string {
        return `Type: Gmail Output\nIntegration ID: ${this.integrationId}`
    }
}

export class GmailDraftOutputConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.GMAIL
    configType: ConfigType = ConfigType.GMAIL_DRAFT_OUTPUT

    constructor(public integrationId: string) {}

    isComplete(): boolean {
        return true
    }

    formatForAgent(): string {
        return `Type: Gmail Draft Output\nIntegration ID: ${this.integrationId}`
    }
}

export class NotionConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.NOTION
    configType: ConfigType = ConfigType.NOTION

    constructor(
        public integrationId: string,
        public databaseIds: string[] = [],
        public databaseNames: string[] = [],
        public pageIds: string[] = [],
        public pageNames: string[] = []
    ) {}

    isComplete(): boolean {
        return (this.databaseIds?.length ?? 0) > 0 || (this.pageIds?.length ?? 0) > 0
    }

    formatForAgent(): string {
        const parts = [`Type: Notion`, `Integration ID: ${this.integrationId}`]
        const dbIds = this.databaseIds ?? []
        const dbNames = this.databaseNames ?? []
        if (dbIds.length > 0) {
            parts.push(`Databases: ${dbIds.map((id, i) => dbNames[i] || id).join(", ")}`)
        }
        const pageIds = this.pageIds ?? []
        const pageNames = this.pageNames ?? []
        if (pageIds.length > 0) {
            parts.push(`Pages: ${pageIds.map((id, i) => pageNames[i] || id).join(", ")}`)
        }
        return parts.join("\n")
    }
}

export class LinearInputConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.LINEAR
    configType: ConfigType = ConfigType.LINEAR_INPUT

    constructor(
        public integrationId: string,
        public projectId?: string,
        public projectName?: string
    ) {}

    isComplete(): boolean {
        return true
    }

    formatForAgent(): string {
        const parts = [`Type: Linear`, `Integration ID: ${this.integrationId}`]
        if (this.projectName) {
            parts.push(`Project: ${this.projectName}`)
        } else if (this.projectId) {
            parts.push(`Project ID: ${this.projectId}`)
        }
        return parts.join("\n")
    }
}

export class LinearOutputConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.LINEAR
    configType: ConfigType = ConfigType.LINEAR_OUTPUT

    constructor(
        public integrationId: string,
        public teamId?: string,
        public teamName?: string
    ) {}

    isComplete(): boolean {
        return !!this.teamId
    }

    formatForAgent(): string {
        const parts = [`Type: Linear`, `Integration ID: ${this.integrationId}`]
        if (this.teamName) {
            parts.push(`Team: ${this.teamName}`)
        } else if (this.teamId) {
            parts.push(`Team ID: ${this.teamId}`)
        }
        return parts.join("\n")
    }
}

export class GitHubConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.GITHUB
    configType: ConfigType = ConfigType.GITHUB

    constructor(
        public integrationId: string,
        public repositoryIds: number[]
    ) {}

    isComplete(): boolean {
        // GitHub only requires integrationId (base check handled in isInputComplete)
        return true
    }

    formatForAgent(): string {
        const parts = [`Type: GitHub`, `Integration ID: ${this.integrationId}`]
        if (this.repositoryIds.length > 0) {
            parts.push(`Repositories: ${this.repositoryIds.join(", ")}`)
        }
        return parts.join("\n")
    }
}

export class JiraConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.ATLASSIAN
    configType: ConfigType = ConfigType.JIRA

    constructor(
        public integrationId: string,
        public projectKey?: string,
        public projectId?: string
    ) {}

    isComplete(): boolean {
        // Jira only requires integrationId (base check handled in isInputComplete)
        return true
    }

    formatForAgent(): string {
        const parts = [`Type: Jira`, `Integration ID: ${this.integrationId}`]
        if (this.projectKey) {
            parts.push(`Project Key: ${this.projectKey}`)
        } else if (this.projectId) {
            parts.push(`Project ID: ${this.projectId}`)
        }
        return parts.join("\n")
    }
}

export class ConfluenceConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.ATLASSIAN
    configType: ConfigType = ConfigType.CONFLUENCE

    constructor(
        public integrationId: string,
        public spaceName: string,
        public spaceId: string,
        public pageId: string, // Page ID (required for outputs - specific page to write to)
        public pageName: string // Page display name (for UI, optional)
    ) {}

    isComplete(): boolean {
        // Confluence only requires integrationId (base check handled in isInputComplete)
        return true
    }

    formatForAgent(): string {
        const parts = [`Type: Confluence`, `Integration ID: ${this.integrationId}`]
        if (this.spaceName) {
            parts.push(`Space: ${this.spaceName}`)
        }
        if (this.pageName) {
            parts.push(`Page: ${this.pageName}`)
        } else if (this.pageId) {
            parts.push(`Page ID: ${this.pageId}`)
        }
        return parts.join("\n")
    }
}

export class PosthogConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.POSTHOG
    configType: ConfigType = ConfigType.POSTHOG

    constructor(
        public integrationId: string,
        public projectId: string,
        public projectName?: string
    ) {}

    isComplete(): boolean {
        return !!this.projectId
    }

    formatForAgent(): string {
        const parts = [`Type: Posthog`, `Integration ID: ${this.integrationId}`]
        if (this.projectId) {
            parts.push(`Project ID: ${this.projectId}`)
        }
        if (this.projectName) {
            parts.push(`Project: ${this.projectName}`)
        }
        return parts.join("\n")
    }
}

export class DatadogConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.DATADOG
    configType: ConfigType = ConfigType.DATADOG

    constructor(
        public integrationId: string,
        public defaultIndexes: string[] = ["main"]
    ) {}

    isComplete(): boolean {
        return !!this.integrationId
    }

    formatForAgent(): string {
        const parts = [`Type: Datadog`, `Integration ID: ${this.integrationId}`]
        if (this.defaultIndexes && this.defaultIndexes.length > 0) {
            parts.push(`Default indexes: ${this.defaultIndexes.join(", ")}`)
        }
        return parts.join("\n")
    }
}

export class TimeTriggerConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.CRON_JOB
    configType: ConfigType = ConfigType.TIME_TRIGGER
    // System integration - no real integration ID needed
    integrationId: string = "system"

    constructor(public cronExpression: string) {}

    isComplete(): boolean {
        return !!this.cronExpression
    }

    formatForAgent(): string {
        const parts = [`Type: Time Trigger`]
        if (this.cronExpression) {
            parts.push(`Schedule (UTC): ${this.cronExpression}`)
        }
        return parts.join("\n")
    }
}

export class GitHubKBConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.GITHUB
    configType: ConfigType = ConfigType.GITHUB_KB

    constructor(
        public integrationId: string,
        public repositoryIds: number[],
        public repositoryNames: string[] // Full names like "owner/repo"
    ) {}

    isComplete(): boolean {
        return this.repositoryIds.length > 0
    }

    formatForAgent(): string {
        const parts = [`Type: GitHub Codebase`, `Integration ID: ${this.integrationId}`]
        if (this.repositoryNames.length > 0) {
            parts.push(`Repositories: ${this.repositoryNames.join(", ")}`)
        }
        return parts.join("\n")
    }
}

export class LaunchDarklyConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.LAUNCHDARKLY
    configType: ConfigType = ConfigType.LAUNCHDARKLY

    constructor(
        public integrationId: string,
        public projectKey: string,
        public environmentKeys: string[] // ["production", "staging"]
    ) {}

    isComplete(): boolean {
        return !!(this.projectKey && this.environmentKeys.length > 0)
    }

    formatForAgent(): string {
        const parts = [`Type: LaunchDarkly`, `Integration ID: ${this.integrationId}`]
        if (this.projectKey) {
            parts.push(`Project Key: ${this.projectKey}`)
        }
        if (this.environmentKeys.length > 0) {
            parts.push(`Environments: ${this.environmentKeys.join(", ")}`)
        }
        return parts.join("\n")
    }
}

export class LinearKBConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.LINEAR
    configType: ConfigType = ConfigType.LINEAR_KB

    constructor(
        public integrationId: string,
        public teamId?: string,
        public teamName?: string,
        public projectId?: string,
        public projectName?: string
    ) {}

    isComplete(): boolean {
        return !!this.integrationId
    }

    formatForAgent(): string {
        const parts = [`Type: Linear Knowledge Base`, `Integration ID: ${this.integrationId}`]
        if (this.teamName) {
            parts.push(`Team: ${this.teamName}`)
        } else if (this.teamId) {
            parts.push(`Team ID: ${this.teamId}`)
        }
        if (this.projectName) {
            parts.push(`Project: ${this.projectName}`)
        } else if (this.projectId) {
            parts.push(`Project ID: ${this.projectId}`)
        }
        return parts.join("\n")
    }
}

export class SlackKBConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.SLACK
    configType: ConfigType = ConfigType.SLACK_KB

    constructor(
        public integrationId: string,
        public channelId?: string,
        public channelName?: string,
        public allowDms: boolean = false,
        public userIds?: string[],
        public userNames?: string[]
    ) {}

    isComplete(): boolean {
        const hasChannel = !!this.channelId?.trim()
        return !!this.integrationId && (hasChannel || this.allowDms)
    }

    formatForAgent(): string {
        const parts = [`Type: Slack Knowledge Base`, `Integration ID: ${this.integrationId}`]
        if (this.channelId) {
            parts.push(`Channel ID: ${this.channelId}`)
        }
        if (this.allowDms) {
            parts.push("Allow DMs: Yes")
        }
        if (this.userIds?.length) {
            parts.push(`Filter to user IDs: ${this.userIds.join(", ")}`)
        }
        return parts.join("\n")
    }
}

export class TerseConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.TERSE
    configType: ConfigType = ConfigType.TERSE
    integrationId: string = "system"

    constructor() {}

    isComplete(): boolean {
        return true
    }

    formatForAgent(): string {
        return "Type: Terse Skills"
    }
}

export class WorkOSInputConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.WORKOS
    configType: ConfigType = ConfigType.WORKOS_INPUT

    constructor(
        public integrationId: string,
        public eventTypes: string[] = []
    ) {}

    isComplete(): boolean {
        return this.eventTypes.length > 0
    }

    formatForAgent(): string {
        return `Type: WorkOS Events\nListening for: ${this.eventTypes.join(", ")}`
    }
}

export class WorkOSKBConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.WORKOS
    configType: ConfigType = ConfigType.WORKOS_KB

    constructor(public integrationId: string) {}

    isComplete(): boolean {
        return !!this.integrationId
    }

    formatForAgent(): string {
        return `Type: WorkOS Knowledge Base\nIntegration ID: ${this.integrationId}`
    }
}

export class AttioOutputConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.ATTIO
    configType: ConfigType = ConfigType.ATTIO_OUTPUT

    constructor(
        public integrationId: string,
        public objectSlug?: string
    ) {}

    isComplete(): boolean {
        return !!this.objectSlug
    }

    formatForAgent(): string {
        const parts = [`Type: Attio Output`, `Integration ID: ${this.integrationId}`]
        if (this.objectSlug) {
            parts.push(`Object: ${this.objectSlug}`)
        }
        return parts.join("\n")
    }
}

// To be studied Later!!
type EnsureExhaustiveMetadata<T extends Record<ConfigType, new (...args: any[]) => ConfigInstance>> = T

export type ConfigMetadataMap = EnsureExhaustiveMetadata<{
    [ConfigType.GMAIL]: typeof GmailConfig
    [ConfigType.FIGMA]: typeof FigmaConfig
    [ConfigType.SLACK]: typeof SlackConfig
    [ConfigType.SLACK_OUTPUT]: typeof SlackOutputConfig
    [ConfigType.GMAIL_OUTPUT]: typeof GmailOutputConfig
    [ConfigType.GMAIL_DRAFT_OUTPUT]: typeof GmailDraftOutputConfig
    [ConfigType.NOTION]: typeof NotionConfig
    [ConfigType.LINEAR_INPUT]: typeof LinearInputConfig
    [ConfigType.LINEAR_OUTPUT]: typeof LinearOutputConfig
    [ConfigType.GITHUB]: typeof GitHubConfig
    [ConfigType.GITHUB_KB]: typeof GitHubKBConfig
    [ConfigType.JIRA]: typeof JiraConfig
    [ConfigType.CONFLUENCE]: typeof ConfluenceConfig
    [ConfigType.POSTHOG]: typeof PosthogConfig
    [ConfigType.DATADOG]: typeof DatadogConfig
    [ConfigType.TIME_TRIGGER]: typeof TimeTriggerConfig
    [ConfigType.LAUNCHDARKLY]: typeof LaunchDarklyConfig
    [ConfigType.LINEAR_KB]: typeof LinearKBConfig
    [ConfigType.SLACK_KB]: typeof SlackKBConfig
    [ConfigType.TERSE]: typeof TerseConfig
    [ConfigType.WORKOS_INPUT]: typeof WorkOSInputConfig
    [ConfigType.WORKOS_KB]: typeof WorkOSKBConfig
    [ConfigType.ATTIO_OUTPUT]: typeof AttioOutputConfig
}>

export const CONFIG_METADATA: ConfigMetadataMap = {
    [ConfigType.GMAIL]: GmailConfig,
    [ConfigType.GMAIL_OUTPUT]: GmailOutputConfig,
    [ConfigType.GMAIL_DRAFT_OUTPUT]: GmailDraftOutputConfig,
    [ConfigType.FIGMA]: FigmaConfig,
    [ConfigType.SLACK]: SlackConfig,
    [ConfigType.SLACK_OUTPUT]: SlackOutputConfig,
    [ConfigType.NOTION]: NotionConfig,
    [ConfigType.LINEAR_INPUT]: LinearInputConfig,
    [ConfigType.LINEAR_OUTPUT]: LinearOutputConfig,
    [ConfigType.GITHUB]: GitHubConfig,
    [ConfigType.GITHUB_KB]: GitHubKBConfig,
    [ConfigType.JIRA]: JiraConfig,
    [ConfigType.CONFLUENCE]: ConfluenceConfig,
    [ConfigType.POSTHOG]: PosthogConfig,
    [ConfigType.DATADOG]: DatadogConfig,
    [ConfigType.TIME_TRIGGER]: TimeTriggerConfig,
    [ConfigType.LAUNCHDARKLY]: LaunchDarklyConfig,
    [ConfigType.LINEAR_KB]: LinearKBConfig,
    [ConfigType.SLACK_KB]: SlackKBConfig,
    [ConfigType.TERSE]: TerseConfig,
    [ConfigType.WORKOS_INPUT]: WorkOSInputConfig,
    [ConfigType.WORKOS_KB]: WorkOSKBConfig,
    [ConfigType.ATTIO_OUTPUT]: AttioOutputConfig
} as const satisfies ConfigMetadataMap
