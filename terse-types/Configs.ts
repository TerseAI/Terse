import * as z from "zod"

import { IntegrationType, integrationTypeEnum } from "./Integrations"
import { SlackAttachments, SlackBlocks, SlackChannelType, SlackFiles } from "./SlackTypes"

export enum ConfigType {
    GMAIL = "gmail",
    GMAIL_OUTPUT = "gmail_output",
    GMAIL_DRAFT_OUTPUT = "gmail_draft_output",
    SLACK = "slack",
    SLACK_OUTPUT = "slack_output",
    NOTION = "notion",
    LINEAR_INPUT = "linear_input",
    LINEAR_OUTPUT = "linear_output",
    GITHUB = "github",
    POSTHOG = "POSTHOG",
    DATADOG = "DATADOG",
    TIME_TRIGGER = "time_trigger",
    LAUNCHDARKLY = "launchdarkly",
    TERSE = "terse",
    WORKOS_INPUT = "workos_input",
    WORKOS_OUTPUT = "workos_output",
    ATTIO_OUTPUT = "attio_output",
    SNOWFLAKE_OUTPUT = "snowflake_output",
    WEBHOOK_INPUT = "webhook_input"
}

export const configTypeEnum = z.enum(ConfigType)

// MARK: Config Metadata
export interface ConfigDetails {
    configType: ConfigType
    name: string
    description: string
    integrationType: IntegrationType
    isInput: boolean
    isOutput: boolean
}

// Metadata objects - using const objects instead of classes
export const GmailConfigMetadata = {
    configType: ConfigType.GMAIL,
    name: "Gmail",
    description: "Monitor incoming emails",
    integrationType: IntegrationType.GMAIL,
    isInput: true,
    isOutput: false
} as const satisfies ConfigDetails

export const SlackConfigMetadata = {
    configType: ConfigType.SLACK,
    name: "Slack",
    description: "Monitor messages in Slack channels or DMs",
    integrationType: IntegrationType.SLACK,
    isInput: true,
    isOutput: false
} as const satisfies ConfigDetails

export const SlackOutputConfigMetadata = {
    configType: ConfigType.SLACK_OUTPUT,
    name: "Slack",
    description: "Send messages to Slack channels, group DMs, or direct messages",
    integrationType: IntegrationType.SLACK,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const GmailOutputConfigMetadata = {
    configType: ConfigType.GMAIL_OUTPUT,
    name: "Gmail",
    description: "Send emails via Gmail",
    integrationType: IntegrationType.GMAIL,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const GmailDraftOutputConfigMetadata = {
    configType: ConfigType.GMAIL_DRAFT_OUTPUT,
    name: "Gmail Draft",
    description: "Create draft emails in Gmail",
    integrationType: IntegrationType.GMAIL,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const NotionConfigMetadata = {
    configType: ConfigType.NOTION,
    name: "Notion",
    description: "Update and monitor Notion pages and databases",
    integrationType: IntegrationType.NOTION,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const LinearInputConfigMetadata = {
    configType: ConfigType.LINEAR_INPUT,
    name: "Linear",
    description: "Monitor Linear issues",
    integrationType: IntegrationType.LINEAR,
    isInput: true,
    isOutput: false
} as const satisfies ConfigDetails

export const LinearOutputConfigMetadata = {
    configType: ConfigType.LINEAR_OUTPUT,
    name: "Linear",
    description: "Update Linear issues",
    integrationType: IntegrationType.LINEAR,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const GitHubConfigMetadata = {
    configType: ConfigType.GITHUB,
    name: "GitHub",
    description: "Monitor and read Github repositories",
    integrationType: IntegrationType.GITHUB,
    isInput: true,
    isOutput: true
} as const satisfies ConfigDetails

export const PosthogConfigMetadata = {
    configType: ConfigType.POSTHOG,
    name: "Posthog",
    description: "Track user events",
    integrationType: IntegrationType.POSTHOG,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const DatadogConfigMetadata = {
    configType: ConfigType.DATADOG,
    name: "Datadog",
    description: "Search logs in Datadog",
    integrationType: IntegrationType.DATADOG,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const TimeTriggerConfigMetadata = {
    configType: ConfigType.TIME_TRIGGER,
    name: "Time Trigger",
    description: "Run on a schedule (daily, weekly, etc.)",
    integrationType: IntegrationType.CRON_JOB,
    isInput: true,
    isOutput: false
} as const satisfies ConfigDetails

export const LaunchDarklyConfigMetadata = {
    configType: ConfigType.LAUNCHDARKLY,
    name: "LaunchDarkly",
    description: "Query feature flags",
    integrationType: IntegrationType.LAUNCHDARKLY,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const TerseConfigMetadata = {
    configType: ConfigType.TERSE,
    name: "Terse Skills",
    description: "Built-in capabilities like web search (always available to agents)",
    integrationType: IntegrationType.TERSE,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const WorkOSInputConfigMetadata = {
    configType: ConfigType.WORKOS_INPUT,
    name: "WorkOS",
    description: "Trigger on user signup, deletion, or membership changes in your app",
    integrationType: IntegrationType.WORKOS,
    isInput: true,
    isOutput: false
} as const satisfies ConfigDetails

export const WorkOSOutputConfigMetadata = {
    configType: ConfigType.WORKOS_OUTPUT,
    name: "WorkOS",
    description: "Fetch and search users from your WorkOS account",
    integrationType: IntegrationType.WORKOS,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const AttioOutputConfigMetadata = {
    configType: ConfigType.ATTIO_OUTPUT,
    name: "Attio",
    description: "Add and update contacts in Attio",
    integrationType: IntegrationType.ATTIO,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const SnowflakeOutputConfigMetadata = {
    configType: ConfigType.SNOWFLAKE_OUTPUT,
    name: "Snowflake",
    description: "Run read-only queries against Snowflake data warehouses",
    integrationType: IntegrationType.SNOWFLAKE,
    isInput: false,
    isOutput: true
} as const satisfies ConfigDetails

export const WebhookInputConfigMetadata = {
    configType: ConfigType.WEBHOOK_INPUT,
    name: "Webhook",
    description: "Trigger via an external HTTP request to a generated URL",
    integrationType: IntegrationType.WEBHOOK,
    isInput: true,
    isOutput: false
} as const satisfies ConfigDetails

export type ConfigDetailsMap = Record<ConfigType, ConfigDetails>

export const CONFIG_DETAILS: ConfigDetailsMap = {
    [ConfigType.GMAIL]: GmailConfigMetadata,
    [ConfigType.GMAIL_OUTPUT]: GmailOutputConfigMetadata,
    [ConfigType.GMAIL_DRAFT_OUTPUT]: GmailDraftOutputConfigMetadata,
    [ConfigType.SLACK]: SlackConfigMetadata,
    [ConfigType.SLACK_OUTPUT]: SlackOutputConfigMetadata,
    [ConfigType.NOTION]: NotionConfigMetadata,
    [ConfigType.LINEAR_INPUT]: LinearInputConfigMetadata,
    [ConfigType.LINEAR_OUTPUT]: LinearOutputConfigMetadata,
    [ConfigType.GITHUB]: GitHubConfigMetadata,
    [ConfigType.POSTHOG]: PosthogConfigMetadata,
    [ConfigType.DATADOG]: DatadogConfigMetadata,
    [ConfigType.TIME_TRIGGER]: TimeTriggerConfigMetadata,
    [ConfigType.LAUNCHDARKLY]: LaunchDarklyConfigMetadata,
    [ConfigType.TERSE]: TerseConfigMetadata,
    [ConfigType.WORKOS_INPUT]: WorkOSInputConfigMetadata,
    [ConfigType.WORKOS_OUTPUT]: WorkOSOutputConfigMetadata,
    [ConfigType.ATTIO_OUTPUT]: AttioOutputConfigMetadata,
    [ConfigType.SNOWFLAKE_OUTPUT]: SnowflakeOutputConfigMetadata,
    [ConfigType.WEBHOOK_INPUT]: WebhookInputConfigMetadata
} as const satisfies ConfigDetailsMap

// MARK: Event Types — specific events within each integration trigger

export const SlackEventType = {
    MESSAGE: "message",
    APP_MENTION: "app_mention",
    REACTION_ADDED: "reaction_added"
} as const
export const slackEventTypeSchema = z.enum(SlackEventType)
export type SlackEventType = z.infer<typeof slackEventTypeSchema>

export const GitHubEventType = {
    PUSH: "push",
    PR_OPENED: "pull_request.opened",
    PR_MERGED: "pull_request.merged",
    PR_CLOSED: "pull_request.closed",
    PR_SYNCHRONIZE: "pull_request.synchronize"
} as const
export const gitHubEventTypeSchema = z.enum(GitHubEventType)
export type GitHubEventType = z.infer<typeof gitHubEventTypeSchema>

export const LinearEventType = {
    ISSUE_CREATED: "issue.created",
    ISSUE_UPDATED: "issue.updated",
    COMMENT_CREATED: "comment.created"
} as const
export const linearEventTypeSchema = z.enum(LinearEventType)
export type LinearEventType = z.infer<typeof linearEventTypeSchema>

export const GmailEventType = {
    EMAIL_RECEIVED: "email.received"
} as const
export const gmailEventTypeSchema = z.enum(GmailEventType)
export type GmailEventType = z.infer<typeof gmailEventTypeSchema>

export const WorkOSEventType = {
    USER_CREATED: "user.created",
    USER_UPDATED: "user.updated",
    USER_DELETED: "user.deleted",
    ORGANIZATION_CREATED: "organization.created",
    ORGANIZATION_MEMBERSHIP_CREATED: "organization_membership.created",
    ORGANIZATION_MEMBERSHIP_UPDATED: "organization_membership.updated",
    ORGANIZATION_MEMBERSHIP_DELETED: "organization_membership.deleted",
    INVITATION_CREATED: "invitation.created",
    INVITATION_ACCEPTED: "invitation.accepted",
    INVITATION_RESENT: "invitation.resent",
    INVITATION_REVOKED: "invitation.revoked"
} as const
export const workOSEventTypeSchema = z.enum(WorkOSEventType)
export type WorkOSEventType = z.infer<typeof workOSEventTypeSchema>

export const ConfigInstanceSchema = z.object({
    integrationId: z.string(),
    integrationType: integrationTypeEnum,
    configType: configTypeEnum
})
export type ConfigInstanceType = z.infer<typeof ConfigInstanceSchema>
export type ConfigInstance = ConfigInstanceType & ConfigBehavior

export type ConfigBehavior = {
    isComplete(): boolean
    formatForAgent(): string
}

abstract class BaseConfigInstance<TIntegrationType extends IntegrationType, TConfigType extends ConfigType, TIntegrationId extends string = string> implements ConfigInstance, ConfigBehavior {
    constructor(
        public readonly integrationId: TIntegrationId,
        public readonly integrationType: TIntegrationType,
        public readonly configType: TConfigType
    ) {}

    abstract isComplete(): boolean
    abstract formatForAgent(): string
}

export const GmailConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.GMAIL),
    configType: z.literal(ConfigType.GMAIL),
    eventTypes: z.array(gmailEventTypeSchema).nullable()
})
export type GmailConfigData = z.infer<typeof GmailConfigSchema>
export type GmailConfigInstance = GmailConfigData & ConfigBehavior

export class GmailConfig extends BaseConfigInstance<IntegrationType.GMAIL, ConfigType.GMAIL> implements GmailConfigInstance {
    constructor(
        integrationId: string,
        public eventTypes: GmailEventType[] | null = null
    ) {
        super(integrationId, IntegrationType.GMAIL, ConfigType.GMAIL)
    }

    isComplete(): boolean {
        return true
    }

    formatForAgent(): string {
        return `Type: Gmail\nIntegration ID: ${this.integrationId}`
    }
}

export const SlackConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.SLACK),
    configType: z.literal(ConfigType.SLACK),
    channelId: z.string().nullable(),
    channelName: z.string().nullable(),
    listenToUserDms: z.boolean().default(false),
    userIds: z.array(z.string()).nullable(),
    eventTypes: z.array(slackEventTypeSchema).nullable()
})
export type SlackConfigData = z.infer<typeof SlackConfigSchema>
export type SlackConfigInstance = SlackConfigData & ConfigBehavior

export class SlackConfig extends BaseConfigInstance<IntegrationType.SLACK, ConfigType.SLACK> implements SlackConfigInstance {
    constructor(
        integrationId: string,
        public channelId: string | null = null,
        public channelName: string | null = null,
        public listenToUserDms: boolean = false,
        public userIds: string[] | null = null,
        public eventTypes: SlackEventType[] | null = null
    ) {
        super(integrationId, IntegrationType.SLACK, ConfigType.SLACK)
    }

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

export const SlackOutputConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.SLACK),
    configType: z.literal(ConfigType.SLACK_OUTPUT),
    channelId: z.string().nullable(),
    channelName: z.string().nullable(),
    userIds: z.array(z.string()).nullable(),
    userNames: z.array(z.string()).nullable(),
    listenToUserDms: z.boolean().default(false)
})
export type SlackOutputConfigData = z.infer<typeof SlackOutputConfigSchema>
export type SlackOutputConfigInstance = SlackOutputConfigData & ConfigBehavior

export class SlackOutputConfig extends BaseConfigInstance<IntegrationType.SLACK, ConfigType.SLACK_OUTPUT> implements SlackOutputConfigInstance {
    constructor(
        integrationId: string,
        public channelId: string | null = null,
        public channelName: string | null = null,
        public userIds: string[] | null = null,
        public userNames: string[] | null = null,
        public listenToUserDms: boolean = false
    ) {
        super(integrationId, IntegrationType.SLACK, ConfigType.SLACK_OUTPUT)
    }

    isComplete(): boolean {
        // Slack output is complete if a channel is set, DM users are set, or "listen to user DMs" is enabled.
        return !!(this.channelId || (this.userIds?.length ?? 0) > 0 || this.listenToUserDms)
    }

    formatForAgent(): string {
        const parts = [`Type: Slack Output`, `Integration ID: ${this.integrationId}`]
        if (this.channelId) {
            parts.push(`Channel ID: ${this.channelId}`)
        }
        if (this.listenToUserDms) {
            parts.push(`Listen to user DMs: Yes`)
        }
        if (this.userIds?.length) {
            parts.push(`DM user IDs: ${this.userIds.join(", ")}`)
        }
        return parts.join("\n")
    }
}

export const GmailOutputConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.GMAIL),
    configType: z.literal(ConfigType.GMAIL_OUTPUT)
})
export type GmailOutputConfigData = z.infer<typeof GmailOutputConfigSchema>
export type GmailOutputConfigInstance = GmailOutputConfigData & ConfigBehavior

export class GmailOutputConfig extends BaseConfigInstance<IntegrationType.GMAIL, ConfigType.GMAIL_OUTPUT> implements GmailOutputConfigInstance {
    constructor(integrationId: string) {
        super(integrationId, IntegrationType.GMAIL, ConfigType.GMAIL_OUTPUT)
    }

    isComplete(): boolean {
        // Gmail output only requires integrationId
        return true
    }

    formatForAgent(): string {
        return `Type: Gmail Output\nIntegration ID: ${this.integrationId}`
    }
}

export const GmailDraftOutputConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.GMAIL),
    configType: z.literal(ConfigType.GMAIL_DRAFT_OUTPUT)
})
export type GmailDraftOutputConfigData = z.infer<typeof GmailDraftOutputConfigSchema>
export type GmailDraftOutputConfigInstance = GmailDraftOutputConfigData & ConfigBehavior

export class GmailDraftOutputConfig extends BaseConfigInstance<IntegrationType.GMAIL, ConfigType.GMAIL_DRAFT_OUTPUT> implements GmailDraftOutputConfigInstance {
    constructor(integrationId: string) {
        super(integrationId, IntegrationType.GMAIL, ConfigType.GMAIL_DRAFT_OUTPUT)
    }

    isComplete(): boolean {
        return true
    }

    formatForAgent(): string {
        return `Type: Gmail Draft Output\nIntegration ID: ${this.integrationId}`
    }
}

export const NotionConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.NOTION),
    configType: z.literal(ConfigType.NOTION),
    databaseIds: z.array(z.string()).default([]),
    databaseNames: z.array(z.string()).default([]),
    pageIds: z.array(z.string()).default([]),
    pageNames: z.array(z.string()).default([])
})
export type NotionConfigData = z.infer<typeof NotionConfigSchema>
export type NotionConfigInstance = NotionConfigData & ConfigBehavior

export class NotionConfig extends BaseConfigInstance<IntegrationType.NOTION, ConfigType.NOTION> implements NotionConfigInstance {
    constructor(
        integrationId: string,
        public databaseIds: string[] = [],
        public databaseNames: string[] = [],
        public pageIds: string[] = [],
        public pageNames: string[] = []
    ) {
        super(integrationId, IntegrationType.NOTION, ConfigType.NOTION)
    }

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

export const LinearInputConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.LINEAR),
    configType: z.literal(ConfigType.LINEAR_INPUT),
    projectId: z.string().nullable(),
    projectName: z.string().nullable(),
    eventTypes: z.array(linearEventTypeSchema).nullable()
})
export type LinearInputConfigData = z.infer<typeof LinearInputConfigSchema>
export type LinearInputConfigInstance = LinearInputConfigData & ConfigBehavior

export class LinearInputConfig extends BaseConfigInstance<IntegrationType.LINEAR, ConfigType.LINEAR_INPUT> implements LinearInputConfigInstance {
    constructor(
        integrationId: string,
        public projectId: string | null = null,
        public projectName: string | null = null,
        public eventTypes: LinearEventType[] | null = null
    ) {
        super(integrationId, IntegrationType.LINEAR, ConfigType.LINEAR_INPUT)
    }

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

export const LinearOutputConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.LINEAR),
    configType: z.literal(ConfigType.LINEAR_OUTPUT),
    teamId: z.string().nullable(),
    teamName: z.string().nullable(),
    projectId: z.string().nullable(),
    projectName: z.string().nullable()
})
export type LinearOutputConfigData = z.infer<typeof LinearOutputConfigSchema>
export type LinearOutputConfigInstance = LinearOutputConfigData & ConfigBehavior

export class LinearOutputConfig extends BaseConfigInstance<IntegrationType.LINEAR, ConfigType.LINEAR_OUTPUT> implements LinearOutputConfigInstance {
    constructor(
        integrationId: string,
        public teamId: string | null = null,
        public teamName: string | null = null,
        public projectId: string | null = null,
        public projectName: string | null = null
    ) {
        super(integrationId, IntegrationType.LINEAR, ConfigType.LINEAR_OUTPUT)
    }

    isComplete(): boolean {
        return !!this.integrationId
    }

    formatForAgent(): string {
        const parts = [`Type: Linear`, `Integration ID: ${this.integrationId}`]
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

export const GitHubConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.GITHUB),
    configType: z.literal(ConfigType.GITHUB),
    repositoryIds: z.array(z.number().int()),
    eventTypes: z.array(gitHubEventTypeSchema).nullable()
})
export type GitHubConfigData = z.infer<typeof GitHubConfigSchema>
export type GitHubConfigInstance = GitHubConfigData & ConfigBehavior

export class GitHubConfig extends BaseConfigInstance<IntegrationType.GITHUB, ConfigType.GITHUB> implements GitHubConfigInstance {
    constructor(
        integrationId: string,
        public repositoryIds: number[],
        public eventTypes: GitHubEventType[] | null = null
    ) {
        super(integrationId, IntegrationType.GITHUB, ConfigType.GITHUB)
    }

    isComplete(): boolean {
        return (this.repositoryIds?.length ?? 0) > 0
    }

    formatForAgent(): string {
        const parts = [`Type: GitHub`, `Integration ID: ${this.integrationId}`]
        if (this.repositoryIds.length > 0) {
            parts.push(`Repositories: ${this.repositoryIds.join(", ")}`)
        }
        return parts.join("\n")
    }
}

export const PosthogConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.POSTHOG),
    configType: z.literal(ConfigType.POSTHOG),
    projectId: z.string(),
    projectName: z.string().nullable()
})
export type PosthogConfigData = z.infer<typeof PosthogConfigSchema>
export type PosthogConfigInstance = PosthogConfigData & ConfigBehavior

export class PosthogConfig extends BaseConfigInstance<IntegrationType.POSTHOG, ConfigType.POSTHOG> implements PosthogConfigInstance {
    constructor(
        integrationId: string,
        public projectId: string,
        public projectName: string | null = null
    ) {
        super(integrationId, IntegrationType.POSTHOG, ConfigType.POSTHOG)
    }

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

export const DatadogConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.DATADOG),
    configType: z.literal(ConfigType.DATADOG),
    defaultIndexes: z.array(z.string()).default(["main"])
})
export type DatadogConfigData = z.infer<typeof DatadogConfigSchema>
export type DatadogConfigInstance = DatadogConfigData & ConfigBehavior

export class DatadogConfig extends BaseConfigInstance<IntegrationType.DATADOG, ConfigType.DATADOG> implements DatadogConfigInstance {
    constructor(
        integrationId: string,
        public defaultIndexes: string[] = ["main"]
    ) {
        super(integrationId, IntegrationType.DATADOG, ConfigType.DATADOG)
    }

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

export const TimeTriggerConfigSchema = ConfigInstanceSchema.extend({
    integrationId: z.literal("system"),
    integrationType: z.literal(IntegrationType.CRON_JOB),
    configType: z.literal(ConfigType.TIME_TRIGGER),
    cronExpression: z.string()
})
export type TimeTriggerConfigData = z.infer<typeof TimeTriggerConfigSchema>
export type TimeTriggerConfigInstance = TimeTriggerConfigData & ConfigBehavior

export class TimeTriggerConfig extends BaseConfigInstance<IntegrationType.CRON_JOB, ConfigType.TIME_TRIGGER, "system"> implements TimeTriggerConfigInstance {
    constructor(public cronExpression: string) {
        super("system", IntegrationType.CRON_JOB, ConfigType.TIME_TRIGGER)
    }

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

export const LaunchDarklyConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.LAUNCHDARKLY),
    configType: z.literal(ConfigType.LAUNCHDARKLY),
    projectKey: z.string(),
    environmentKeys: z.array(z.string())
})
export type LaunchDarklyConfigData = z.infer<typeof LaunchDarklyConfigSchema>
export type LaunchDarklyConfigInstance = LaunchDarklyConfigData & ConfigBehavior

export class LaunchDarklyConfig extends BaseConfigInstance<IntegrationType.LAUNCHDARKLY, ConfigType.LAUNCHDARKLY> implements LaunchDarklyConfigInstance {
    constructor(
        integrationId: string,
        public projectKey: string,
        public environmentKeys: string[] // ["production", "staging"]
    ) {
        super(integrationId, IntegrationType.LAUNCHDARKLY, ConfigType.LAUNCHDARKLY)
    }

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

export const TerseConfigSchema = ConfigInstanceSchema.extend({
    integrationId: z.literal("system"),
    integrationType: z.literal(IntegrationType.TERSE),
    configType: z.literal(ConfigType.TERSE)
})
export type TerseConfigData = z.infer<typeof TerseConfigSchema>
export type TerseConfigInstance = TerseConfigData & ConfigBehavior

export class TerseConfig extends BaseConfigInstance<IntegrationType.TERSE, ConfigType.TERSE, "system"> implements TerseConfigInstance {
    constructor() {
        super("system", IntegrationType.TERSE, ConfigType.TERSE)
    }

    isComplete(): boolean {
        return true
    }

    formatForAgent(): string {
        return "Type: Terse Skills"
    }
}

export const WorkOSInputConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.WORKOS),
    configType: z.literal(ConfigType.WORKOS_INPUT),
    eventTypes: z.array(workOSEventTypeSchema).default([])
})
export type WorkOSInputConfigData = z.infer<typeof WorkOSInputConfigSchema>
export type WorkOSInputConfigInstance = WorkOSInputConfigData & ConfigBehavior

export class WorkOSInputConfig extends BaseConfigInstance<IntegrationType.WORKOS, ConfigType.WORKOS_INPUT> implements WorkOSInputConfigInstance {
    constructor(
        integrationId: string,
        public eventTypes: WorkOSEventType[] = []
    ) {
        super(integrationId, IntegrationType.WORKOS, ConfigType.WORKOS_INPUT)
    }

    isComplete(): boolean {
        return this.eventTypes.length > 0
    }

    formatForAgent(): string {
        return `Type: WorkOS Events\nListening for: ${this.eventTypes.join(", ")}`
    }
}

export const WorkOSOutputConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.WORKOS),
    configType: z.literal(ConfigType.WORKOS_OUTPUT)
})
export type WorkOSOutputConfigData = z.infer<typeof WorkOSOutputConfigSchema>
export type WorkOSOutputConfigInstance = WorkOSOutputConfigData & ConfigBehavior

export class WorkOSOutputConfig extends BaseConfigInstance<IntegrationType.WORKOS, ConfigType.WORKOS_OUTPUT> implements WorkOSOutputConfigInstance {
    constructor(integrationId: string) {
        super(integrationId, IntegrationType.WORKOS, ConfigType.WORKOS_OUTPUT)
    }

    isComplete(): boolean {
        return !!this.integrationId
    }

    formatForAgent(): string {
        return `Type: WorkOS Skill\nIntegration ID: ${this.integrationId}`
    }
}

export const AttioOutputConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.ATTIO),
    configType: z.literal(ConfigType.ATTIO_OUTPUT),
    objectSlug: z.string().nullable()
})
export type AttioOutputConfigData = z.infer<typeof AttioOutputConfigSchema>
export type AttioOutputConfigInstance = AttioOutputConfigData & ConfigBehavior

export class AttioOutputConfig extends BaseConfigInstance<IntegrationType.ATTIO, ConfigType.ATTIO_OUTPUT> implements AttioOutputConfigInstance {
    constructor(
        integrationId: string,
        public objectSlug: string | null = null
    ) {
        super(integrationId, IntegrationType.ATTIO, ConfigType.ATTIO_OUTPUT)
    }

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

export const SnowflakeOutputConfigSchema = ConfigInstanceSchema.extend({
    integrationType: z.literal(IntegrationType.SNOWFLAKE),
    configType: z.literal(ConfigType.SNOWFLAKE_OUTPUT)
})
export type SnowflakeOutputConfigData = z.infer<typeof SnowflakeOutputConfigSchema>
export type SnowflakeOutputConfigInstance = SnowflakeOutputConfigData & ConfigBehavior

export class SnowflakeOutputConfig extends BaseConfigInstance<IntegrationType.SNOWFLAKE, ConfigType.SNOWFLAKE_OUTPUT> implements SnowflakeOutputConfigInstance {
    constructor(integrationId: string) {
        super(integrationId, IntegrationType.SNOWFLAKE, ConfigType.SNOWFLAKE_OUTPUT)
    }

    isComplete(): boolean {
        return !!this.integrationId
    }

    formatForAgent(): string {
        const parts = [`Type: Snowflake Output`, `Integration ID: ${this.integrationId}`]
        return parts.join("\n")
    }
}

export const WebhookInputConfigSchema = ConfigInstanceSchema.extend({
    integrationId: z.literal("system"),
    integrationType: z.literal(IntegrationType.WEBHOOK),
    configType: z.literal(ConfigType.WEBHOOK_INPUT)
})
export type WebhookInputConfigData = z.infer<typeof WebhookInputConfigSchema>
export type WebhookInputConfigInstance = WebhookInputConfigData & ConfigBehavior

export class WebhookInputConfig extends BaseConfigInstance<IntegrationType.WEBHOOK, ConfigType.WEBHOOK_INPUT, "system"> implements WebhookInputConfigInstance {
    constructor() {
        super("system", IntegrationType.WEBHOOK, ConfigType.WEBHOOK_INPUT)
    }

    isComplete(): boolean {
        return true
    }

    formatForAgent(): string {
        return "Type: Webhook Trigger"
    }
}

export const configDataSchema = z.union([
    GmailConfigSchema,
    SlackConfigSchema,
    SlackOutputConfigSchema,
    GmailOutputConfigSchema,
    GmailDraftOutputConfigSchema,
    NotionConfigSchema,
    LinearInputConfigSchema,
    LinearOutputConfigSchema,
    GitHubConfigSchema,
    PosthogConfigSchema,
    DatadogConfigSchema,
    TimeTriggerConfigSchema,
    LaunchDarklyConfigSchema,
    TerseConfigSchema,
    WorkOSInputConfigSchema,
    WorkOSOutputConfigSchema,
    AttioOutputConfigSchema,
    SnowflakeOutputConfigSchema,
    WebhookInputConfigSchema
])
export type ConfigData = z.infer<typeof configDataSchema>

export function isConfigComplete(config: ConfigData | undefined): boolean {
    if (!config) {
        return false
    }

    switch (config.configType) {
        case ConfigType.GMAIL:
        case ConfigType.GMAIL_OUTPUT:
        case ConfigType.GMAIL_DRAFT_OUTPUT:
        case ConfigType.LINEAR_INPUT:
        case ConfigType.TERSE:
        case ConfigType.WEBHOOK_INPUT:
            return true
        case ConfigType.SLACK:
            return !!(config.channelId || config.listenToUserDms)
        case ConfigType.SLACK_OUTPUT:
            return !!(config.channelId || (config.userIds?.length ?? 0) > 0 || config.listenToUserDms)
        case ConfigType.NOTION:
            return (config.databaseIds?.length ?? 0) > 0 || (config.pageIds?.length ?? 0) > 0
        case ConfigType.LINEAR_OUTPUT:
        case ConfigType.DATADOG:
        case ConfigType.WORKOS_OUTPUT:
        case ConfigType.SNOWFLAKE_OUTPUT:
            return !!config.integrationId
        case ConfigType.GITHUB:
            return (config.repositoryIds?.length ?? 0) > 0
        case ConfigType.POSTHOG:
            return !!config.projectId
        case ConfigType.TIME_TRIGGER:
            return !!config.cronExpression
        case ConfigType.LAUNCHDARKLY:
            return !!(config.projectKey && config.environmentKeys.length > 0)
        case ConfigType.WORKOS_INPUT:
            return config.eventTypes.length > 0
        case ConfigType.ATTIO_OUTPUT:
            return !!config.objectSlug
        default:
            const _exhaustive: never = config
            return _exhaustive
    }
}

export function formatConfigForAgent(config: ConfigData): string {
    switch (config.configType) {
        case ConfigType.GMAIL:
            return `Type: Gmail\nIntegration ID: ${config.integrationId}`
        case ConfigType.SLACK: {
            const parts = [`Type: Slack`, `Integration ID: ${config.integrationId}`]
            if (config.channelName) {
                parts.push(`Channel: ${config.channelName}`)
            } else if (config.channelId) {
                parts.push(`Channel ID: ${config.channelId}`)
            }
            if (config.listenToUserDms) parts.push(`Listening to user DMs: Yes`)
            if (config.userIds) parts.push(`Users: ${config.userIds.join(", ")}`)
            return parts.join("\n")
        }
        case ConfigType.SLACK_OUTPUT: {
            const parts = [`Type: Slack Output`, `Integration ID: ${config.integrationId}`]
            if (config.channelId) parts.push(`Channel ID: ${config.channelId}`)
            if (config.listenToUserDms) parts.push(`Listen to user DMs: Yes`)
            if (config.userIds?.length) parts.push(`DM user IDs: ${config.userIds.join(", ")}`)
            return parts.join("\n")
        }
        case ConfigType.GMAIL_OUTPUT:
            return `Type: Gmail Output\nIntegration ID: ${config.integrationId}`
        case ConfigType.GMAIL_DRAFT_OUTPUT:
            return `Type: Gmail Draft Output\nIntegration ID: ${config.integrationId}`
        case ConfigType.NOTION: {
            const parts = [`Type: Notion`, `Integration ID: ${config.integrationId}`]
            const dbIds = config.databaseIds ?? []
            const dbNames = config.databaseNames ?? []
            if (dbIds.length > 0) {
                parts.push(`Databases: ${dbIds.map((id, i) => dbNames[i] || id).join(", ")}`)
            }
            const pageIds = config.pageIds ?? []
            const pageNames = config.pageNames ?? []
            if (pageIds.length > 0) {
                parts.push(`Pages: ${pageIds.map((id, i) => pageNames[i] || id).join(", ")}`)
            }
            return parts.join("\n")
        }
        case ConfigType.LINEAR_INPUT: {
            const parts = [`Type: Linear`, `Integration ID: ${config.integrationId}`]
            if (config.projectName) {
                parts.push(`Project: ${config.projectName}`)
            } else if (config.projectId) {
                parts.push(`Project ID: ${config.projectId}`)
            }
            return parts.join("\n")
        }
        case ConfigType.LINEAR_OUTPUT: {
            const parts = [`Type: Linear`, `Integration ID: ${config.integrationId}`]
            if (config.teamName) {
                parts.push(`Team: ${config.teamName}`)
            } else if (config.teamId) {
                parts.push(`Team ID: ${config.teamId}`)
            }
            if (config.projectName) {
                parts.push(`Project: ${config.projectName}`)
            } else if (config.projectId) {
                parts.push(`Project ID: ${config.projectId}`)
            }
            return parts.join("\n")
        }
        case ConfigType.GITHUB: {
            const parts = [`Type: GitHub`, `Integration ID: ${config.integrationId}`]
            if (config.repositoryIds.length > 0) parts.push(`Repositories: ${config.repositoryIds.join(", ")}`)
            return parts.join("\n")
        }
        case ConfigType.POSTHOG: {
            const parts = [`Type: Posthog`, `Integration ID: ${config.integrationId}`]
            if (config.projectId) parts.push(`Project ID: ${config.projectId}`)
            if (config.projectName) parts.push(`Project: ${config.projectName}`)
            return parts.join("\n")
        }
        case ConfigType.DATADOG: {
            const parts = [`Type: Datadog`, `Integration ID: ${config.integrationId}`]
            if (config.defaultIndexes?.length) parts.push(`Default indexes: ${config.defaultIndexes.join(", ")}`)
            return parts.join("\n")
        }
        case ConfigType.TIME_TRIGGER: {
            const parts = [`Type: Time Trigger`]
            if (config.cronExpression) parts.push(`Schedule (UTC): ${config.cronExpression}`)
            return parts.join("\n")
        }
        case ConfigType.LAUNCHDARKLY: {
            const parts = [`Type: LaunchDarkly`, `Integration ID: ${config.integrationId}`]
            if (config.projectKey) parts.push(`Project Key: ${config.projectKey}`)
            if (config.environmentKeys.length > 0) parts.push(`Environments: ${config.environmentKeys.join(", ")}`)
            return parts.join("\n")
        }
        case ConfigType.TERSE:
            return "Type: Terse Skills"
        case ConfigType.WORKOS_INPUT:
            return `Type: WorkOS Events\nListening for: ${config.eventTypes.join(", ")}`
        case ConfigType.WORKOS_OUTPUT:
            return `Type: WorkOS Skill\nIntegration ID: ${config.integrationId}`
        case ConfigType.ATTIO_OUTPUT: {
            const parts = [`Type: Attio Output`, `Integration ID: ${config.integrationId}`]
            if (config.objectSlug) parts.push(`Object: ${config.objectSlug}`)
            return parts.join("\n")
        }
        case ConfigType.SNOWFLAKE_OUTPUT:
            return `Type: Snowflake Output\nIntegration ID: ${config.integrationId}`
        case ConfigType.WEBHOOK_INPUT:
            return "Type: Webhook Trigger"
        default: {
            const _exhaustive: never = config
            return _exhaustive
        }
    }
}

// To be studied Later!!
type EnsureExhaustiveMetadata<T extends Record<ConfigType, new (...args: any[]) => ConfigInstance>> = T

export type ConfigMetadataMap = EnsureExhaustiveMetadata<{
    [ConfigType.GMAIL]: typeof GmailConfig
    [ConfigType.SLACK]: typeof SlackConfig
    [ConfigType.SLACK_OUTPUT]: typeof SlackOutputConfig
    [ConfigType.GMAIL_OUTPUT]: typeof GmailOutputConfig
    [ConfigType.GMAIL_DRAFT_OUTPUT]: typeof GmailDraftOutputConfig
    [ConfigType.NOTION]: typeof NotionConfig
    [ConfigType.LINEAR_INPUT]: typeof LinearInputConfig
    [ConfigType.LINEAR_OUTPUT]: typeof LinearOutputConfig
    [ConfigType.GITHUB]: typeof GitHubConfig
    [ConfigType.POSTHOG]: typeof PosthogConfig
    [ConfigType.DATADOG]: typeof DatadogConfig
    [ConfigType.TIME_TRIGGER]: typeof TimeTriggerConfig
    [ConfigType.LAUNCHDARKLY]: typeof LaunchDarklyConfig
    [ConfigType.TERSE]: typeof TerseConfig
    [ConfigType.WORKOS_INPUT]: typeof WorkOSInputConfig
    [ConfigType.WORKOS_OUTPUT]: typeof WorkOSOutputConfig
    [ConfigType.ATTIO_OUTPUT]: typeof AttioOutputConfig
    [ConfigType.SNOWFLAKE_OUTPUT]: typeof SnowflakeOutputConfig
    [ConfigType.WEBHOOK_INPUT]: typeof WebhookInputConfig
}>

export const CONFIG_METADATA: ConfigMetadataMap = {
    [ConfigType.GMAIL]: GmailConfig,
    [ConfigType.GMAIL_OUTPUT]: GmailOutputConfig,
    [ConfigType.GMAIL_DRAFT_OUTPUT]: GmailDraftOutputConfig,
    [ConfigType.SLACK]: SlackConfig,
    [ConfigType.SLACK_OUTPUT]: SlackOutputConfig,
    [ConfigType.NOTION]: NotionConfig,
    [ConfigType.LINEAR_INPUT]: LinearInputConfig,
    [ConfigType.LINEAR_OUTPUT]: LinearOutputConfig,
    [ConfigType.GITHUB]: GitHubConfig,
    [ConfigType.POSTHOG]: PosthogConfig,
    [ConfigType.DATADOG]: DatadogConfig,
    [ConfigType.TIME_TRIGGER]: TimeTriggerConfig,
    [ConfigType.LAUNCHDARKLY]: LaunchDarklyConfig,
    [ConfigType.TERSE]: TerseConfig,
    [ConfigType.WORKOS_INPUT]: WorkOSInputConfig,
    [ConfigType.WORKOS_OUTPUT]: WorkOSOutputConfig,
    [ConfigType.ATTIO_OUTPUT]: AttioOutputConfig,
    [ConfigType.SNOWFLAKE_OUTPUT]: SnowflakeOutputConfig,
    [ConfigType.WEBHOOK_INPUT]: WebhookInputConfig
} as const satisfies ConfigMetadataMap
