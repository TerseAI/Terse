import { InputConfigType, KnowledgeBaseConfigType, OutputConfigType, IntegrationType as PrismaIntegrationType } from "@prisma/client"

import {
    AttioOutputConfig,
    ConfigInstance,
    ConfigType,
    ConfluenceConfig,
    DatadogConfig,
    FigmaConfig,
    GitHubConfig,
    GitHubKBConfig,
    GmailConfig,
    GmailOutputConfig,
    JiraConfig,
    LaunchDarklyConfig,
    LinearInputConfig,
    LinearKBConfig,
    LinearOutputConfig,
    NotionConfig,
    PosthogConfig,
    SlackConfig,
    SlackKBConfig,
    SlackOutputConfig,
    TimeTriggerConfig,
    WorkOSInputConfig
} from "../shared/Configs"
import { IntegrationType } from "../shared/Integrations"
import { AgentKnowledgeBaseWithConfigs, AgentOutputWithConfigs, AgentTriggerWithConfigs } from "../types/prisma"

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
        default:
            throw prismaIntegrationType satisfies never
    }
}

export const convertPrismaConfigToConfigInstance = (channelInput: AgentTriggerWithConfigs): ConfigInstance => {
    const integrationId = channelInput.integration_id

    // Determine which config is present and create the appropriate ConfigInstance
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
        return new GitHubConfig(integrationId, channelInput.github_config.repository_ids || [])
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
        return new WorkOSInputConfig(integrationId, channelInput.workos_config.event_types || [])
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
            break
        default:
            throw channelInput.config_type satisfies never
    }

    throw new Error(`No config found for channel input ${channelInput.id}`)
}

/**
 * Converts a ChannelOutput with configs to a ConfigInstance.
 * Similar to convertPrismaConfigToConfigInstance but for outputs.
 */
export const convertPrismaOutputConfigToConfigInstance = (channelOutput: AgentOutputWithConfigs): ConfigInstance => {
    const integrationId = channelOutput.integration_id

    // Determine which config is present and create the appropriate ConfigInstance
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
        return new LinearOutputConfig(integrationId, channelOutput.linear_config.team_id || undefined, channelOutput.linear_config.team_name || undefined)
    }

    if (channelOutput.jira_config) {
        return new JiraConfig(integrationId, channelOutput.jira_config.project_key || undefined, channelOutput.jira_config.project_id || undefined)
    }

    if (channelOutput.slack_config) {
        return new SlackOutputConfig(
            integrationId,
            channelOutput.slack_config.channel_id || undefined,
            channelOutput.slack_config.channel_name || undefined,
            channelOutput.slack_config.user_ids?.length ? channelOutput.slack_config.user_ids : undefined,
            undefined // userNames not persisted in DB; can be derived in UI
        )
    }

    if (channelOutput.gmail_config) {
        return new GmailOutputConfig(integrationId)
    }

    if (channelOutput.attio_config) {
        return new AttioOutputConfig(integrationId, channelOutput.attio_config.object_slug)
    }

    // Type guard to ensure we implement conversion here
    switch (channelOutput.config_type) {
        case OutputConfigType.NOTION:
        case OutputConfigType.CONFLUENCE:
        case OutputConfigType.LINEAR_TICKET:
        case OutputConfigType.JIRA_TICKET:
        case OutputConfigType.SLACK_CHANNEL:
        case OutputConfigType.GMAIL:
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
        case ConfigType.GITHUB_KB:
            // GitHub KB is a knowledge base config type, not an input config type
            throw new Error("GITHUB_KB is a knowledge base type, not an input type")
        case ConfigType.LAUNCHDARKLY:
            // LaunchDarkly is a knowledge base config type, not an input config type
            throw new Error("LAUNCHDARKLY is a knowledge base type, not an input type")
        case ConfigType.SLACK_OUTPUT:
            // SLACK_OUTPUT is an output config type, not an input config type
            throw new Error("SLACK_OUTPUT is an output type, not an input type")
        case ConfigType.GMAIL_OUTPUT:
            // GMAIL_OUTPUT is an output config type, not an input config type
            throw new Error("GMAIL_OUTPUT is an output type, not an input type")
        case ConfigType.DATADOG:
            throw new Error("DATADOG is not an input config type")
        case ConfigType.LINEAR_KB:
            throw new Error("LINEAR_KB is a knowledge base type, not an input type")
        case ConfigType.SLACK_KB:
            throw new Error("SLACK_KB is a knowledge base type, not an input type")
        case ConfigType.TERSE:
            throw new Error("TERSE is an output type, not an input type")
        case ConfigType.ATTIO_OUTPUT:
            throw new Error("ATTIO_OUTPUT is an output type, not an input type")
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
        default:
            throw inputConfigType satisfies never
    }
}

/**
 * Converts ConfigType to OutputConfigType.
 */
export const convertConfigTypeToOutputConfigType = (configType: ConfigType): OutputConfigType => {
    switch (configType) {
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
        case ConfigType.TERSE:
            return OutputConfigType.TERSE
        case ConfigType.ATTIO_OUTPUT:
            return OutputConfigType.ATTIO
        default:
            throw new Error(`ConfigType ${configType} is not a valid output config type. Supported: NOTION, CONFLUENCE, LINEAR, JIRA, SLACK_OUTPUT, GMAIL_OUTPUT, TERSE, ATTIO.`)
    }
}

/**
 * Converts OutputConfigType to ConfigType (for outputs that have a ConfigType in CONFIG_DETAILS).
 */
export const convertOutputConfigTypeToConfigType = (outputConfigType: OutputConfigType): ConfigType => {
    switch (outputConfigType) {
        case OutputConfigType.NOTION:
            return ConfigType.NOTION
        case OutputConfigType.CONFLUENCE:
            return ConfigType.CONFLUENCE
        case OutputConfigType.LINEAR_TICKET:
            return ConfigType.LINEAR_OUTPUT
        case OutputConfigType.JIRA_TICKET:
            return ConfigType.JIRA
        case OutputConfigType.SLACK_CHANNEL:
            return ConfigType.SLACK_OUTPUT
        case OutputConfigType.GMAIL:
            return ConfigType.GMAIL_OUTPUT
        case OutputConfigType.TERSE:
            return ConfigType.TERSE
        case OutputConfigType.ATTIO:
            return ConfigType.ATTIO_OUTPUT
        default:
            throw outputConfigType satisfies never
    }
}

/**
 * Converts OutputConfigType to IntegrationType.
 * Maps output configuration types to their corresponding integration types.
 */
export const convertOutputConfigTypeToIntegrationType = (outputConfigType: OutputConfigType): IntegrationType => {
    switch (outputConfigType) {
        case OutputConfigType.NOTION:
            return IntegrationType.NOTION
        case OutputConfigType.CONFLUENCE:
            return IntegrationType.ATLASSIAN
        case OutputConfigType.LINEAR_TICKET:
            return IntegrationType.LINEAR
        case OutputConfigType.JIRA_TICKET:
            return IntegrationType.ATLASSIAN
        case OutputConfigType.SLACK_CHANNEL:
            return IntegrationType.SLACK
        case OutputConfigType.GMAIL:
            return IntegrationType.GMAIL
        case OutputConfigType.TERSE:
            return IntegrationType.TERSE
        case OutputConfigType.ATTIO:
            return IntegrationType.ATTIO
        default:
            throw outputConfigType satisfies never
    }
}

export const convertConfigTypeToKnowledgeBaseConfigType = (configType: ConfigType): KnowledgeBaseConfigType => {
    switch (configType) {
        case ConfigType.POSTHOG:
            return KnowledgeBaseConfigType.POSTHOG
        case ConfigType.GITHUB_KB:
            return KnowledgeBaseConfigType.GITHUB
        case ConfigType.LAUNCHDARKLY:
            return KnowledgeBaseConfigType.LAUNCHDARKLY
        case ConfigType.DATADOG:
            return KnowledgeBaseConfigType.DATADOG
        case ConfigType.LINEAR_KB:
            return KnowledgeBaseConfigType.LINEAR
        case ConfigType.SLACK_KB:
            return KnowledgeBaseConfigType.SLACK
        default:
            throw new Error(`ConfigType ${configType} is not a valid knowledge base config type. Supported knowledge base config types are: POSTHOG, GITHUB_KB, DATADOG, LINEAR_KB, SLACK_KB.`)
    }
}

/**
 * Converts a ChannelKnowledgeBase with configs to a ConfigInstance.
 */
export const convertPrismaKnowledgeBaseConfigToConfigInstance = (channelKnowledgeBase: AgentKnowledgeBaseWithConfigs): ConfigInstance => {
    const integrationId = channelKnowledgeBase.integration_id

    if (channelKnowledgeBase.posthog_config) {
        const posthogIntegration = channelKnowledgeBase.posthog_config
        if (!posthogIntegration.project_id) {
            throw new Error("Posthog config requires project_id")
        }
        return new PosthogConfig(integrationId, posthogIntegration.project_id, posthogIntegration.project_name || undefined)
    }

    if (channelKnowledgeBase.github_kb_config) {
        return new GitHubKBConfig(integrationId, channelKnowledgeBase.github_kb_config.repository_ids || [], channelKnowledgeBase.github_kb_config.repository_names || [])
    }

    if (channelKnowledgeBase.launchdarkly_config) {
        const launchdarklyIntegration = channelKnowledgeBase.launchdarkly_config
        if (!launchdarklyIntegration.project_key) {
            throw new Error("LaunchDarkly config requires project_key")
        }
        return new LaunchDarklyConfig(integrationId, launchdarklyIntegration.project_key, launchdarklyIntegration.environment_keys || [])
    }

    if (channelKnowledgeBase.datadog_config) {
        const datadogConfig = channelKnowledgeBase.datadog_config
        return new DatadogConfig(integrationId, datadogConfig.default_indexes && datadogConfig.default_indexes.length > 0 ? datadogConfig.default_indexes : ["main"])
    }

    if (channelKnowledgeBase.linear_kb_config) {
        const c = channelKnowledgeBase.linear_kb_config
        return new LinearKBConfig(integrationId, c.team_id ?? undefined, c.team_name ?? undefined, c.project_id ?? undefined, c.project_name ?? undefined)
    }

    if (channelKnowledgeBase.slack_kb_config) {
        const c = channelKnowledgeBase.slack_kb_config
        return new SlackKBConfig(integrationId, c.channel_ids?.[0], c.channel_names?.[0], c.allow_dms ?? false, c.user_ids ?? [], c.user_names ?? [])
    }

    throw new Error(`Unsupported knowledge base config type: ${channelKnowledgeBase.config_type}`)
}

/**
 * Converts a plain object config (from request body JSON) to a proper ConfigInstance.
 * This is needed because JSON deserialization creates plain objects, not class instances.
 * If the config is already an instance (has isComplete method), returns it as-is.
 */
export const convertPlainObjectToKnowledgeBaseConfigInstance = (config: any): ConfigInstance => {
    // If it's already an instance (has isComplete method), return as-is
    if (typeof config.isComplete === "function") {
        return config as ConfigInstance
    }

    // Convert plain object to proper instance based on configType
    switch (config.configType) {
        case ConfigType.DATADOG:
            return new DatadogConfig(config.integrationId, config.defaultIndexes || ["main"])
        case ConfigType.POSTHOG:
            return new PosthogConfig(config.integrationId, config.projectId, config.projectName)
        case ConfigType.GITHUB_KB:
            return new GitHubKBConfig(config.integrationId, config.repositoryIds || [], config.repositoryNames || [])
        case ConfigType.LAUNCHDARKLY:
            return new LaunchDarklyConfig(config.integrationId, config.projectKey, config.environmentKeys || [])
        case ConfigType.LINEAR_KB:
            return new LinearKBConfig(config.integrationId, config.teamId, config.teamName, config.projectId, config.projectName)
        case ConfigType.SLACK_KB:
            return new SlackKBConfig(
                config.integrationId,
                config.channelId ?? (config as any).channelIds?.[0],
                config.channelName ?? (config as any).channelNames?.[0],
                config.allowDms ?? false,
                config.userIds ?? [],
                config.userNames ?? []
            )
        default:
            throw new Error(`Unsupported knowledge base config type: ${config.configType}`)
    }
}

/**
 * Converts a plain object config (e.g. from AgentTriggerSchema / InputConfigSchema) to a ConfigInstance.
 * Used by getSampleEvents so sample events can be tested without creating an agent/database record.
 */
export const convertPlainObjectToInputConfigInstance = (config: any): ConfigInstance => {
    if (typeof config.isComplete === "function") {
        return config as ConfigInstance
    }

    switch (config.configType) {
        case ConfigType.GMAIL:
            return new GmailConfig(config.integrationId)
        case ConfigType.FIGMA:
            return new FigmaConfig(config.integrationId, config.fileKey, config.fileName || "", config.teamId || "")
        case ConfigType.SLACK:
            return new SlackConfig(config.integrationId, config.channelId, config.channelName, config.listenToUserDms ?? false, config.userIds)
        case ConfigType.LINEAR_INPUT:
            return new LinearInputConfig(config.integrationId, config.projectId, config.projectName)
        case ConfigType.GITHUB:
            return new GitHubConfig(config.integrationId, config.repositoryIds || [])
        case ConfigType.JIRA:
            return new JiraConfig(config.integrationId, config.projectKey, config.projectId)
        case ConfigType.TIME_TRIGGER:
            return new TimeTriggerConfig(config.cronExpression || "")
        case ConfigType.WORKOS_INPUT:
            return new WorkOSInputConfig(config.integrationId, config.eventTypes || [])
        default:
            throw new Error(`Unsupported input config type: ${config.configType}`)
    }
}
