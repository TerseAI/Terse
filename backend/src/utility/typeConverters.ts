import { InputConfigType, OutputConfigType, IntegrationType as PrismaIntegrationType, RunHistoryStatus as PrismaRunHistoryStatus } from "@prisma/client"
import {
    AttioOutputConfig,
    ConfigData,
    ConfigType,
    ConfluenceConfig,
    DatadogConfig,
    FigmaConfig,
    GitHubConfig,
    GitHubEventType,
    GmailConfig,
    GmailDraftOutputConfig,
    GmailOutputConfig,
    JiraConfig,
    LaunchDarklyConfig,
    LinearInputConfig,
    LinearOutputConfig,
    NotionConfig,
    PosthogConfig,
    SlackConfig,
    SlackOutputConfig,
    SnowflakeOutputConfig,
    TerseConfig,
    TimeTriggerConfig,
    WebhookInputConfig,
    WorkOSEventType,
    WorkOSInputConfig,
    WorkOSOutputConfig
} from "terse-types/Configs"
import { IntegrationType } from "terse-types/Integrations"
import { RunHistoryStatus as SharedRunHistoryStatus } from "terse-types/RunHistoryTypes"

import { AgentOutputWithConfigs, AgentTriggerWithConfigs } from "../types/prisma"

export const convertIntegrationTypeToPrismaIntegrationType = (integrationType: IntegrationType): PrismaIntegrationType => {
    switch (integrationType) {
        case IntegrationType.GITHUB:
            return PrismaIntegrationType.GITHUB
        case IntegrationType.GMAIL:
            return PrismaIntegrationType.GMAIL
        case IntegrationType.LINEAR:
            return PrismaIntegrationType.LINEAR
        case IntegrationType.ATLASSIAN:
            return PrismaIntegrationType.JIRA
        case IntegrationType.SLACK:
            return PrismaIntegrationType.SLACK
        case IntegrationType.NOTION:
            return PrismaIntegrationType.NOTION
        case IntegrationType.FIGMA:
            return PrismaIntegrationType.FIGMA
        case IntegrationType.TERSE:
            return PrismaIntegrationType.TERSE
        case IntegrationType.POSTHOG:
            return PrismaIntegrationType.POSTHOG
        case IntegrationType.CRON_JOB:
            return PrismaIntegrationType.CRON_JOB
        case IntegrationType.LAUNCHDARKLY:
            return PrismaIntegrationType.LAUNCHDARKLY
        case IntegrationType.DATADOG:
            return PrismaIntegrationType.DATADOG
        case IntegrationType.WORKOS:
            return PrismaIntegrationType.WORKOS
        case IntegrationType.ATTIO:
            return PrismaIntegrationType.ATTIO
        case IntegrationType.SNOWFLAKE:
            return PrismaIntegrationType.SNOWFLAKE
        case IntegrationType.WEBHOOK:
            return PrismaIntegrationType.WEBHOOK
        default:
            throw integrationType satisfies never
    }
}

export const convertPrismaIntegrationTypeToIntegrationType = (prismaIntegrationType: PrismaIntegrationType): IntegrationType => {
    switch (prismaIntegrationType) {
        case PrismaIntegrationType.GITHUB:
            return IntegrationType.GITHUB
        case PrismaIntegrationType.GMAIL:
            return IntegrationType.GMAIL
        case PrismaIntegrationType.LINEAR:
            return IntegrationType.LINEAR
        case PrismaIntegrationType.JIRA:
        case PrismaIntegrationType.CONFLUENCE:
            // Both JIRA and CONFLUENCE map to ATLASSIAN in shared enum
            return IntegrationType.ATLASSIAN
        case PrismaIntegrationType.SLACK:
            return IntegrationType.SLACK
        case PrismaIntegrationType.NOTION:
        case PrismaIntegrationType.NOTION_PAGE:
            // Both NOTION and NOTION_PAGE map to NOTION in shared enum
            return IntegrationType.NOTION
        case PrismaIntegrationType.FIGMA:
            return IntegrationType.FIGMA
        case PrismaIntegrationType.TERSE:
            return IntegrationType.TERSE
        case PrismaIntegrationType.POSTHOG:
            return IntegrationType.POSTHOG
        case PrismaIntegrationType.CRON_JOB:
            return IntegrationType.CRON_JOB
        case PrismaIntegrationType.LAUNCHDARKLY:
            return IntegrationType.LAUNCHDARKLY
        case PrismaIntegrationType.DATADOG:
            return IntegrationType.DATADOG
        case PrismaIntegrationType.WORKOS:
            return IntegrationType.WORKOS
        case PrismaIntegrationType.ATTIO:
            return IntegrationType.ATTIO
        case PrismaIntegrationType.SNOWFLAKE:
            return IntegrationType.SNOWFLAKE
        case PrismaIntegrationType.WEBHOOK:
            return IntegrationType.WEBHOOK
        default:
            throw prismaIntegrationType satisfies never
    }
}

// Convert IntegrationType to Prisma IntegrationType (for run history)
// Note: ATLASSIAN maps to CONFLUENCE in Prisma for run history
export const convertIntegrationTypeToPrismaIntegrationTypeForRunHistory = (integrationType: IntegrationType): PrismaIntegrationType => {
    switch (integrationType) {
        case IntegrationType.GITHUB:
            return PrismaIntegrationType.GITHUB
        case IntegrationType.GMAIL:
            return PrismaIntegrationType.GMAIL
        case IntegrationType.LINEAR:
            return PrismaIntegrationType.LINEAR
        case IntegrationType.ATLASSIAN:
            // For run history, ATLASSIAN maps to CONFLUENCE by default
            // If we need to distinguish JIRA vs CONFLUENCE, we'd need more context
            return PrismaIntegrationType.CONFLUENCE
        case IntegrationType.SLACK:
            return PrismaIntegrationType.SLACK
        case IntegrationType.NOTION:
            return PrismaIntegrationType.NOTION
        case IntegrationType.FIGMA:
            return PrismaIntegrationType.FIGMA
        case IntegrationType.TERSE:
            return PrismaIntegrationType.TERSE
        case IntegrationType.POSTHOG:
            return PrismaIntegrationType.POSTHOG
        case IntegrationType.CRON_JOB:
            return PrismaIntegrationType.CRON_JOB
        case IntegrationType.LAUNCHDARKLY:
            return PrismaIntegrationType.LAUNCHDARKLY
        case IntegrationType.DATADOG:
            return PrismaIntegrationType.DATADOG
        case IntegrationType.WORKOS:
            return PrismaIntegrationType.WORKOS
        case IntegrationType.ATTIO:
            return PrismaIntegrationType.ATTIO
        case IntegrationType.SNOWFLAKE:
            return PrismaIntegrationType.SNOWFLAKE
        case IntegrationType.WEBHOOK:
            return PrismaIntegrationType.WEBHOOK
        default:
            throw integrationType satisfies never
    }
}

// Convert Prisma IntegrationType to shared IntegrationType (from run history)
export const convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory = (prismaIntegrationType: PrismaIntegrationType): IntegrationType => {
    switch (prismaIntegrationType) {
        case PrismaIntegrationType.GITHUB:
            return IntegrationType.GITHUB
        case PrismaIntegrationType.GMAIL:
            return IntegrationType.GMAIL
        case PrismaIntegrationType.LINEAR:
            return IntegrationType.LINEAR
        case PrismaIntegrationType.CONFLUENCE:
        case PrismaIntegrationType.JIRA:
            // Both map to ATLASSIAN in shared enum
            return IntegrationType.ATLASSIAN
        case PrismaIntegrationType.SLACK:
            return IntegrationType.SLACK
        case PrismaIntegrationType.NOTION:
        case PrismaIntegrationType.NOTION_PAGE:
            // Both map to NOTION in shared enum
            return IntegrationType.NOTION
        case PrismaIntegrationType.FIGMA:
            return IntegrationType.FIGMA
        case PrismaIntegrationType.TERSE:
            return IntegrationType.TERSE
        case PrismaIntegrationType.POSTHOG:
            return IntegrationType.POSTHOG
        case PrismaIntegrationType.CRON_JOB:
            return IntegrationType.CRON_JOB
        case PrismaIntegrationType.LAUNCHDARKLY:
            return IntegrationType.LAUNCHDARKLY
        case PrismaIntegrationType.DATADOG:
            return IntegrationType.DATADOG
        case PrismaIntegrationType.WORKOS:
            return IntegrationType.WORKOS
        case PrismaIntegrationType.ATTIO:
            return IntegrationType.ATTIO
        case PrismaIntegrationType.SNOWFLAKE:
            return IntegrationType.SNOWFLAKE
        case PrismaIntegrationType.WEBHOOK:
            return IntegrationType.WEBHOOK
        default:
            throw prismaIntegrationType satisfies never
    }
}

export const convertPrismaRunHistoryStatusToShared = (status: PrismaRunHistoryStatus): SharedRunHistoryStatus => {
    switch (status) {
        case PrismaRunHistoryStatus.success:
            return SharedRunHistoryStatus.SUCCESS
        case PrismaRunHistoryStatus.failed:
            return SharedRunHistoryStatus.FAILED
        case PrismaRunHistoryStatus.cancelled:
            return SharedRunHistoryStatus.CANCELLED
        case PrismaRunHistoryStatus.skipped:
            return SharedRunHistoryStatus.SKIPPED
        case PrismaRunHistoryStatus.in_progress:
            return SharedRunHistoryStatus.IN_PROGRESS
        case PrismaRunHistoryStatus.awaiting_approval:
            return SharedRunHistoryStatus.AWAITING_APPROVAL
        default:
            throw status satisfies never
    }
}

export const convertPrismaConfigToConfigData = (channelInput: AgentTriggerWithConfigs): ConfigData => {
    const integrationId = channelInput.integration_id

    // Determine which config is present and create the appropriate ConfigData
    if (channelInput.gmail_config) {
        return new GmailConfig(integrationId)
    }

    if (channelInput.figma_config) {
        return new FigmaConfig(integrationId, channelInput.figma_config.file_key, channelInput.figma_config.file_name || "", channelInput.figma_config.team_id || "")
    }

    if (channelInput.slack_config) {
        return new SlackConfig(
            integrationId,
            channelInput.slack_config.channel_id || undefined,
            channelInput.slack_config.channel_name || undefined,
            channelInput.slack_config.listen_to_user_dms || false,
            channelInput.slack_config.user_ids || undefined
        )
    }

    if (channelInput.notion_config) {
        const nc = channelInput.notion_config
        return new NotionConfig(integrationId, nc.database_ids ?? [], nc.database_names ?? [], nc.page_ids ?? [], nc.page_names ?? [])
    }

    if (channelInput.linear_config) {
        return new LinearInputConfig(integrationId, channelInput.linear_config.team_id || undefined, channelInput.linear_config.team_name || undefined)
    }

    if (channelInput.github_config) {
        return new GitHubConfig(integrationId, channelInput.github_config.repository_ids || [], (channelInput.github_config.event_types || []) as GitHubEventType[])
    }

    if (channelInput.jira_config) {
        return new JiraConfig(integrationId, channelInput.jira_config.project_key || undefined, channelInput.jira_config.project_id || undefined)
    }

    if (channelInput.confluence_config) {
        return new ConfluenceConfig(
            integrationId,
            channelInput.confluence_config.space_name || "",
            channelInput.confluence_config.space_id || "",
            channelInput.confluence_config.page_id || "",
            channelInput.confluence_config.page_name || ""
        )
    }

    if (channelInput.time_trigger_config) {
        return new TimeTriggerConfig(channelInput.time_trigger_config.cron_expression || "")
    }

    if (channelInput.workos_config) {
        return new WorkOSInputConfig(integrationId, (channelInput.workos_config.event_types || []) as WorkOSEventType[])
    }

    if (channelInput.webhook_config) {
        return new WebhookInputConfig()
    }

    // Type guard to ensure we implement conversion here
    switch (channelInput.config_type) {
        case InputConfigType.GMAIL:
        case InputConfigType.FIGMA:
        case InputConfigType.SLACK:
        case InputConfigType.NOTION_PAGE:
        case InputConfigType.NOTION_DATABASE:
        case InputConfigType.LINEAR:
        case InputConfigType.GITHUB:
        case InputConfigType.JIRA:
        case InputConfigType.CONFLUENCE:
        case InputConfigType.POSTHOG:
        case InputConfigType.TIME_TRIGGER:
        case InputConfigType.WORKOS_INPUT:
        case InputConfigType.WEBHOOK_INPUT:
            break
        default:
            throw channelInput.config_type satisfies never
    }

    throw new Error(`No config found for channel input ${channelInput.id}`)
}

/**
 * Converts a ChannelOutput with configs to a ConfigData.
 * Similar to convertPrismaConfigToConfigData but for outputs.
 */
export const convertPrismaOutputConfigToConfigData = (channelOutput: AgentOutputWithConfigs): ConfigData => {
    const integrationId = channelOutput.integration_id

    // Determine which config is present and create the appropriate ConfigData
    if (channelOutput.notion_config) {
        const nc = channelOutput.notion_config
        return new NotionConfig(integrationId, nc.database_ids ?? [], nc.database_names ?? [], nc.page_ids ?? [], nc.page_names ?? [])
    }

    if (channelOutput.confluence_config) {
        return new ConfluenceConfig(
            integrationId,
            channelOutput.confluence_config.space_name || "",
            channelOutput.confluence_config.space_id || "",
            channelOutput.confluence_config.page_id || "",
            channelOutput.confluence_config.page_name || ""
        )
    }

    if (channelOutput.linear_config) {
        return new LinearOutputConfig(
            integrationId,
            channelOutput.linear_config.team_id || undefined,
            channelOutput.linear_config.team_name || undefined,
            channelOutput.linear_config.project_id || undefined,
            channelOutput.linear_config.project_name || undefined
        )
    }

    if (channelOutput.jira_config) {
        return new JiraConfig(integrationId, channelOutput.jira_config.project_key || undefined, channelOutput.jira_config.project_id || undefined)
    }

    if (channelOutput.slack_config) {
        return new SlackOutputConfig(
            integrationId,
            channelOutput.slack_config.channel_id || undefined,
            channelOutput.slack_config.channel_name || undefined,
            channelOutput.slack_config.user_ids ?? [],
            undefined, // userNames not persisted in DB; can be derived in UI
            channelOutput.slack_config.listen_to_user_dms || false
        )
    }

    if (channelOutput.gmail_config) {
        if (channelOutput.config_type === OutputConfigType.GMAIL_DRAFT) {
            return new GmailDraftOutputConfig(integrationId)
        }
        return new GmailOutputConfig(integrationId)
    }

    if (channelOutput.attio_config) {
        return new AttioOutputConfig(integrationId, channelOutput.attio_config.object_slug)
    }

    if (channelOutput.github_config) {
        return new GitHubConfig(integrationId, channelOutput.github_config.repository_ids || [])
    }

    if (channelOutput.posthog_config) {
        return new PosthogConfig(integrationId, channelOutput.posthog_config.project_id, channelOutput.posthog_config.project_name || undefined)
    }

    if (channelOutput.datadog_config) {
        return new DatadogConfig(integrationId, channelOutput.datadog_config.default_indexes || ["main"])
    }

    if (channelOutput.launchdarkly_config) {
        return new LaunchDarklyConfig(integrationId, channelOutput.launchdarkly_config.project_key, channelOutput.launchdarkly_config.environment_keys || [])
    }

    if (channelOutput.config_type === OutputConfigType.WORKOS) {
        return new WorkOSOutputConfig(integrationId)
    }

    if (channelOutput.snowflake_config) {
        return new SnowflakeOutputConfig(integrationId)
    }

    if (channelOutput.config_type === OutputConfigType.SNOWFLAKE) {
        return new SnowflakeOutputConfig(integrationId)
    }

    // Type guard to ensure we implement conversion here
    switch (channelOutput.config_type) {
        case OutputConfigType.NOTION:
        case OutputConfigType.CONFLUENCE:
        case OutputConfigType.LINEAR_TICKET:
        case OutputConfigType.JIRA_TICKET:
        case OutputConfigType.SLACK_CHANNEL:
        case OutputConfigType.GMAIL:
        case OutputConfigType.GITHUB:
        case OutputConfigType.POSTHOG:
        case OutputConfigType.DATADOG:
        case OutputConfigType.LAUNCHDARKLY:
        case OutputConfigType.GMAIL_DRAFT:
        case OutputConfigType.TERSE:
        case OutputConfigType.ATTIO:
            break
        default:
            throw channelOutput.config_type satisfies never
    }

    throw new Error(`No config found for channel output ${channelOutput.id}`)
}

// ConfigType converters

export const convertConfigTypeToInputConfigType = (configType: ConfigType): InputConfigType => {
    switch (configType) {
        case ConfigType.GMAIL:
            return InputConfigType.GMAIL
        case ConfigType.FIGMA:
            return InputConfigType.FIGMA
        case ConfigType.SLACK:
            return InputConfigType.SLACK
        case ConfigType.NOTION:
            return InputConfigType.NOTION_DATABASE
        case ConfigType.LINEAR_INPUT:
        case ConfigType.LINEAR_OUTPUT:
            return InputConfigType.LINEAR
        case ConfigType.GITHUB:
            return InputConfigType.GITHUB
        case ConfigType.JIRA:
            return InputConfigType.JIRA
        case ConfigType.CONFLUENCE:
            return InputConfigType.CONFLUENCE
        case ConfigType.POSTHOG:
            return InputConfigType.POSTHOG
        case ConfigType.TIME_TRIGGER:
            return InputConfigType.TIME_TRIGGER
        case ConfigType.WORKOS_INPUT:
            return InputConfigType.WORKOS_INPUT
        case ConfigType.WEBHOOK_INPUT:
            return InputConfigType.WEBHOOK_INPUT
        case ConfigType.SLACK_OUTPUT:
            // SLACK_OUTPUT is an output config type, not an input config type
            throw new Error("SLACK_OUTPUT is an output type, not an input type")
        case ConfigType.GMAIL_OUTPUT:
            // GMAIL_OUTPUT is an output config type, not an input config type
            throw new Error("GMAIL_OUTPUT is an output type, not an input type")
        case ConfigType.GMAIL_DRAFT_OUTPUT:
            throw new Error("GMAIL_DRAFT_OUTPUT is an output type, not an input type")
        case ConfigType.DATADOG:
            throw new Error("DATADOG is not an input config type")
        case ConfigType.LAUNCHDARKLY:
            throw new Error("LAUNCHDARKLY is not an input config type")
        case ConfigType.TERSE:
            throw new Error("TERSE is an output type, not an input type")
        case ConfigType.WORKOS_OUTPUT:
            throw new Error("WORKOS_OUTPUT is an output type, not an input type")
        case ConfigType.ATTIO_OUTPUT:
            throw new Error("ATTIO_OUTPUT is an output type, not an input type")
        case ConfigType.SNOWFLAKE_OUTPUT:
            throw new Error("SNOWFLAKE_OUTPUT is an output type, not an input type")
        default:
            throw configType satisfies never
    }
}

export const convertInputConfigTypeToConfigType = (inputConfigType: InputConfigType): ConfigType => {
    switch (inputConfigType) {
        case InputConfigType.GMAIL:
            return ConfigType.GMAIL
        case InputConfigType.FIGMA:
            return ConfigType.FIGMA
        case InputConfigType.SLACK:
            return ConfigType.SLACK
        case InputConfigType.NOTION_PAGE:
        case InputConfigType.NOTION_DATABASE:
            return ConfigType.NOTION
        case InputConfigType.LINEAR:
            return ConfigType.LINEAR_INPUT
        case InputConfigType.GITHUB:
            return ConfigType.GITHUB
        case InputConfigType.JIRA:
            return ConfigType.JIRA
        case InputConfigType.CONFLUENCE:
            return ConfigType.CONFLUENCE
        case InputConfigType.POSTHOG:
            return ConfigType.POSTHOG
        case InputConfigType.TIME_TRIGGER:
            return ConfigType.TIME_TRIGGER
        case InputConfigType.WORKOS_INPUT:
            return ConfigType.WORKOS_INPUT
        case InputConfigType.WEBHOOK_INPUT:
            return ConfigType.WEBHOOK_INPUT
        default:
            throw inputConfigType satisfies never
    }
}

/**
 * Converts ConfigType to OutputConfigType.
 */
export const convertConfigTypeToOutputConfigType = (configType: ConfigType): OutputConfigType => {
    switch (configType) {
        case ConfigType.GITHUB:
            return OutputConfigType.GITHUB
        case ConfigType.POSTHOG:
            return OutputConfigType.POSTHOG
        case ConfigType.DATADOG:
            return OutputConfigType.DATADOG
        case ConfigType.LAUNCHDARKLY:
            return OutputConfigType.LAUNCHDARKLY
        case ConfigType.NOTION:
            return OutputConfigType.NOTION
        case ConfigType.CONFLUENCE:
            return OutputConfigType.CONFLUENCE
        case ConfigType.LINEAR_OUTPUT:
            return OutputConfigType.LINEAR_TICKET
        case ConfigType.JIRA:
            return OutputConfigType.JIRA_TICKET
        case ConfigType.SLACK_OUTPUT:
            return OutputConfigType.SLACK_CHANNEL
        case ConfigType.GMAIL_OUTPUT:
            return OutputConfigType.GMAIL
        case ConfigType.GMAIL_DRAFT_OUTPUT:
            return OutputConfigType.GMAIL_DRAFT
        case ConfigType.TERSE:
            return OutputConfigType.TERSE
        case ConfigType.ATTIO_OUTPUT:
            return OutputConfigType.ATTIO
        case ConfigType.WORKOS_OUTPUT:
            return OutputConfigType.WORKOS
        case ConfigType.SNOWFLAKE_OUTPUT:
            return OutputConfigType.SNOWFLAKE
        default:
            throw new Error(`ConfigType ${configType} is not a valid output config type.`)
    }
}
