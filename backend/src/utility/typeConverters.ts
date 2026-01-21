import { IntegrationType } from "../shared/Integrations";
import { 
    InputConfigType, 
    IntegrationType as PrismaIntegrationType, 
    OutputConfigType,
    KnowledgeBaseConfigType,
} from "@prisma/client";
import { AgentInputWithConfigs, AgentOutputWithConfigs, AgentKnowledgeBaseWithConfigs } from "../types/prisma";
import { 
    ConfigInstance, 
    GmailConfig, 
    GmailOutputConfig,
    FigmaConfig, 
    SlackConfig, 
    SlackOutputConfig,
    NotionConfig, 
    NotionPageConfig, 
    LinearInputConfig, 
    LinearOutputConfig,
    GitHubConfig, 
    JiraConfig, 
    ConfluenceConfig,
    PosthogConfig,
    ConfigType,
    GitHubKBConfig,
    TimeTriggerConfig,
    LaunchDarklyConfig,
    DatadogConfig,
} from "../shared/Configs";

export const convertIntegrationTypeToPrismaIntegrationType = (integrationType: IntegrationType): PrismaIntegrationType => {
    switch (integrationType) {
        case IntegrationType.GITHUB:
            return PrismaIntegrationType.GITHUB;
        case IntegrationType.GMAIL:
            return PrismaIntegrationType.GMAIL;
        case IntegrationType.LINEAR:
            return PrismaIntegrationType.LINEAR;
        case IntegrationType.ATLASSIAN:
            return PrismaIntegrationType.JIRA;
        case IntegrationType.SLACK:
            return PrismaIntegrationType.SLACK;
        case IntegrationType.NOTION:
            return PrismaIntegrationType.NOTION;
        case IntegrationType.FIGMA:
            return PrismaIntegrationType.FIGMA;
        case IntegrationType.TERSE:
            return PrismaIntegrationType.TERSE;
        case IntegrationType.POSTHOG:
            return PrismaIntegrationType.POSTHOG;
        case IntegrationType.CRON_JOB:
            return PrismaIntegrationType.CRON_JOB;
        case IntegrationType.LAUNCHDARKLY:
            return PrismaIntegrationType.LAUNCHDARKLY;
        case IntegrationType.DATADOG:
            return PrismaIntegrationType.DATADOG;
        default:
            throw integrationType satisfies never;
    }
}

export const convertPrismaIntegrationTypeToIntegrationType = (prismaIntegrationType: PrismaIntegrationType): IntegrationType => {
    switch (prismaIntegrationType) {
        case PrismaIntegrationType.GITHUB:
            return IntegrationType.GITHUB;
        case PrismaIntegrationType.GMAIL:
            return IntegrationType.GMAIL;
        case PrismaIntegrationType.LINEAR:
            return IntegrationType.LINEAR;
        case PrismaIntegrationType.JIRA:
        case PrismaIntegrationType.CONFLUENCE:
            // Both JIRA and CONFLUENCE map to ATLASSIAN in shared enum
            return IntegrationType.ATLASSIAN;
        case PrismaIntegrationType.SLACK:
            return IntegrationType.SLACK;
        case PrismaIntegrationType.NOTION:
        case PrismaIntegrationType.NOTION_PAGE:
            // Both NOTION and NOTION_PAGE map to NOTION in shared enum
            return IntegrationType.NOTION;
        case PrismaIntegrationType.FIGMA:
            return IntegrationType.FIGMA;
        case PrismaIntegrationType.TERSE:
            return IntegrationType.TERSE;
        case PrismaIntegrationType.POSTHOG:
            return IntegrationType.POSTHOG;
        case PrismaIntegrationType.CRON_JOB:
            return IntegrationType.CRON_JOB;
        case PrismaIntegrationType.LAUNCHDARKLY:
            return IntegrationType.LAUNCHDARKLY;
        case PrismaIntegrationType.DATADOG:
            return IntegrationType.DATADOG;
        default:
            throw prismaIntegrationType satisfies never;
    }
}

// Convert IntegrationType to Prisma IntegrationType (for run history)
// Note: ATLASSIAN maps to CONFLUENCE in Prisma for run history
export const convertIntegrationTypeToPrismaIntegrationTypeForRunHistory = (integrationType: IntegrationType): PrismaIntegrationType => {
    switch (integrationType) {
        case IntegrationType.GITHUB:
            return PrismaIntegrationType.GITHUB;
        case IntegrationType.GMAIL:
            return PrismaIntegrationType.GMAIL;
        case IntegrationType.LINEAR:
            return PrismaIntegrationType.LINEAR;
        case IntegrationType.ATLASSIAN:
            // For run history, ATLASSIAN maps to CONFLUENCE by default
            // If we need to distinguish JIRA vs CONFLUENCE, we'd need more context
            return PrismaIntegrationType.CONFLUENCE;
        case IntegrationType.SLACK:
            return PrismaIntegrationType.SLACK;
        case IntegrationType.NOTION:
            return PrismaIntegrationType.NOTION;
        case IntegrationType.FIGMA:
            return PrismaIntegrationType.FIGMA;
        case IntegrationType.TERSE:
            return PrismaIntegrationType.TERSE;
        case IntegrationType.POSTHOG:
            return PrismaIntegrationType.POSTHOG;
        case IntegrationType.CRON_JOB:
            return PrismaIntegrationType.CRON_JOB;
        case IntegrationType.LAUNCHDARKLY:
            return PrismaIntegrationType.LAUNCHDARKLY;
        case IntegrationType.DATADOG:
            return PrismaIntegrationType.DATADOG;
        default:
            throw integrationType satisfies never;
    }
}

// Convert Prisma IntegrationType to shared IntegrationType (from run history)
export const convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory = (prismaIntegrationType: PrismaIntegrationType): IntegrationType => {
    switch (prismaIntegrationType) {
        case PrismaIntegrationType.GITHUB:
            return IntegrationType.GITHUB;
        case PrismaIntegrationType.GMAIL:
            return IntegrationType.GMAIL;
        case PrismaIntegrationType.LINEAR:
            return IntegrationType.LINEAR;
        case PrismaIntegrationType.CONFLUENCE:
        case PrismaIntegrationType.JIRA:
            // Both map to ATLASSIAN in shared enum
            return IntegrationType.ATLASSIAN;
        case PrismaIntegrationType.SLACK:
            return IntegrationType.SLACK;
        case PrismaIntegrationType.NOTION:
        case PrismaIntegrationType.NOTION_PAGE:
            // Both map to NOTION in shared enum
            return IntegrationType.NOTION;
        case PrismaIntegrationType.FIGMA:
            return IntegrationType.FIGMA;
        case PrismaIntegrationType.TERSE:
            return IntegrationType.TERSE;
        case PrismaIntegrationType.POSTHOG:
            return IntegrationType.POSTHOG;
        case PrismaIntegrationType.CRON_JOB:
            return IntegrationType.CRON_JOB;
        case PrismaIntegrationType.LAUNCHDARKLY:
            return IntegrationType.LAUNCHDARKLY;
        case PrismaIntegrationType.DATADOG:
            return IntegrationType.DATADOG;
        default:
            throw prismaIntegrationType satisfies never;
    }
}

export const convertPrismaConfigToConfigInstance = (agentInput: AgentInputWithConfigs): ConfigInstance => {
    const integrationId = agentInput.integration_id;

    // Determine which config is present and create the appropriate ConfigInstance
    if (agentInput.gmail_config) {
        return new GmailConfig(integrationId);
    }

    if (agentInput.figma_config) {
        return new FigmaConfig(
            integrationId,
            agentInput.figma_config.file_key,
            agentInput.figma_config.file_name || '',
            agentInput.figma_config.team_id || ''
        );
    }

    if (agentInput.slack_config) {
        return new SlackConfig(
            integrationId,
            agentInput.slack_config.channel_id || undefined,
            agentInput.slack_config.channel_name || undefined,
            agentInput.slack_config.listen_to_user_dms || false,
            agentInput.slack_config.user_ids || undefined
        );
    }

    if (agentInput.notion_page_config) {
        return new NotionPageConfig(
            integrationId,
            agentInput.notion_page_config.page_id || undefined,
            agentInput.notion_page_config.page_name || undefined
        );
    }

    if (agentInput.notion_config) {
        return new NotionConfig(
            integrationId,
            agentInput.notion_config.database_id || undefined,
            agentInput.notion_config.database_name || undefined
        );
    }

    if (agentInput.linear_config) {
        return new LinearInputConfig(
            integrationId,
            agentInput.linear_config.team_id || undefined,
            agentInput.linear_config.team_name || undefined
        );
    }

    if (agentInput.github_config) {
        return new GitHubConfig(
            integrationId,
            agentInput.github_config.repository_ids || []
        );
    }

    if (agentInput.jira_config) {
        return new JiraConfig(
            integrationId,
            agentInput.jira_config.project_key || undefined,
            agentInput.jira_config.project_id || undefined
        );
    }

    if (agentInput.confluence_config) {
        return new ConfluenceConfig(
            integrationId,
            agentInput.confluence_config.space_name || '',
            agentInput.confluence_config.space_id || '',
            agentInput.confluence_config.page_id || '',
            agentInput.confluence_config.page_name || ''
        );
    }

    if (agentInput.time_trigger_config) {
        return new TimeTriggerConfig(
            agentInput.time_trigger_config.cron_expression || ''
        );
    }

    // Type guard to ensure we implement conversion here
    switch (agentInput.config_type) {
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
            break;
        default:
            throw agentInput.config_type satisfies never;
    }

    throw new Error(`No config found for channel input ${agentInput.id}`);
}

/**
 * Converts an AutomationOutput with configs to a ConfigInstance.
 * Similar to convertPrismaConfigToConfigInstance but for outputs.
 */
export const convertPrismaOutputConfigToConfigInstance = (agentOutput: AgentOutputWithConfigs): ConfigInstance => {
    const integrationId = agentOutput.integration_id;

    // Determine which config is present and create the appropriate ConfigInstance
    // Note: Outputs only support NOTION_PAGE, NOTION_DATABASE, and CONFLUENCE
    if (agentOutput.notion_page_config) {
        return new NotionPageConfig(
            integrationId,
            agentOutput.notion_page_config.page_id || undefined,
            agentOutput.notion_page_config.page_name || undefined
        );
    }

    if (agentOutput.notion_config) {
        return new NotionConfig(
            integrationId,
            agentOutput.notion_config.database_id || undefined,
            agentOutput.notion_config.database_name || undefined
        );
    }

    if (agentOutput.confluence_config) {
        return new ConfluenceConfig(
            integrationId,
            agentOutput.confluence_config.space_name || '',
            agentOutput.confluence_config.space_id || '',
            agentOutput.confluence_config.page_id || '',
            agentOutput.confluence_config.page_name || ''
        );
    }

    if (agentOutput.linear_config) {
        return new LinearOutputConfig(
            integrationId,
            agentOutput.linear_config.team_id || undefined,
            agentOutput.linear_config.team_name || undefined
        );
    }

    if (agentOutput.jira_config) {
        return new JiraConfig(
            integrationId,
            agentOutput.jira_config.project_key || undefined,
            agentOutput.jira_config.project_id || undefined
        );
    }

    if (agentOutput.slack_config) {
        return new SlackOutputConfig(
            integrationId,
            agentOutput.slack_config.channel_id || undefined,
            agentOutput.slack_config.channel_name || undefined
        );
    }

    if (agentOutput.gmail_config) {
        return new GmailOutputConfig(integrationId);
    }

    // Type guard to ensure we implement conversion here
    switch (agentOutput.config_type) {
        case OutputConfigType.NOTION_PAGE:
        case OutputConfigType.NOTION_DATABASE:
        case OutputConfigType.CONFLUENCE:
        case OutputConfigType.LINEAR_TICKET:
        case OutputConfigType.JIRA_TICKET:
        case OutputConfigType.SLACK_CHANNEL:
        case OutputConfigType.GMAIL:
            break;
        default:
            throw agentOutput.config_type satisfies never;
    }

    throw new Error(`No config found for automation output ${agentOutput.id}`);
}

// ConfigType converters

export const convertConfigTypeToInputConfigType = (configType: ConfigType): InputConfigType => {
    switch (configType) {
        case ConfigType.GMAIL:
            return InputConfigType.GMAIL;
        case ConfigType.FIGMA:
            return InputConfigType.FIGMA;
        case ConfigType.SLACK:
            return InputConfigType.SLACK;
        case ConfigType.NOTION_PAGE:
            return InputConfigType.NOTION_PAGE;
        case ConfigType.NOTION_DATABASE:
            return InputConfigType.NOTION_DATABASE;
        case ConfigType.LINEAR_INPUT:
        case ConfigType.LINEAR_OUTPUT:
            return InputConfigType.LINEAR;
        case ConfigType.GITHUB:
            return InputConfigType.GITHUB;
        case ConfigType.JIRA:
            return InputConfigType.JIRA;
        case ConfigType.CONFLUENCE:
            return InputConfigType.CONFLUENCE;
        case ConfigType.POSTHOG:
            return InputConfigType.POSTHOG;
        case ConfigType.TIME_TRIGGER:
            return InputConfigType.TIME_TRIGGER;
        case ConfigType.GITHUB_KB:
            // GitHub KB is a knowledge base config type, not a trigger config type
            throw new Error('GITHUB_KB is a knowledge base type, not a trigger type');
        case ConfigType.LAUNCHDARKLY:
            // LaunchDarkly is a knowledge base config type, not a trigger config type
            throw new Error('LAUNCHDARKLY is a knowledge base type, not a trigger type');
        case ConfigType.SLACK_OUTPUT:
            // SLACK_OUTPUT is an output config type, not a trigger config type
            throw new Error('SLACK_OUTPUT is an output type, not a trigger type');
        case ConfigType.GMAIL_OUTPUT:
            // GMAIL_OUTPUT is an output config type, not a trigger config type
            throw new Error('GMAIL_OUTPUT is an output type, not a trigger type');
        case ConfigType.DATADOG:
            throw new Error('DATADOG is not an input config type');
        default:
            throw configType satisfies never;
    }
}

export const convertInputConfigTypeToConfigType = (inputConfigType: InputConfigType): ConfigType => {
    switch (inputConfigType) {
        case InputConfigType.GMAIL:
            return ConfigType.GMAIL;
        case InputConfigType.FIGMA:
            return ConfigType.FIGMA;
        case InputConfigType.SLACK:
            return ConfigType.SLACK;
        case InputConfigType.NOTION_PAGE:
            return ConfigType.NOTION_PAGE;
        case InputConfigType.NOTION_DATABASE:
            return ConfigType.NOTION_DATABASE;
        case InputConfigType.LINEAR:
            return ConfigType.LINEAR_INPUT;
        case InputConfigType.GITHUB:
            return ConfigType.GITHUB;
        case InputConfigType.JIRA:
            return ConfigType.JIRA;
        case InputConfigType.CONFLUENCE:
            return ConfigType.CONFLUENCE;
        case InputConfigType.POSTHOG:
            return ConfigType.POSTHOG;
        case InputConfigType.TIME_TRIGGER:
            return ConfigType.TIME_TRIGGER;
        default:
            throw inputConfigType satisfies never;
    }
}

/**
 * Converts ConfigType to OutputConfigType.
 * Only NOTION_PAGE, NOTION_DATABASE, and CONFLUENCE are valid output config types.
 */
export const convertConfigTypeToOutputConfigType = (configType: ConfigType): OutputConfigType => {
    switch (configType) {
        case ConfigType.NOTION_PAGE:
            return OutputConfigType.NOTION_PAGE;
        case ConfigType.NOTION_DATABASE:
            return OutputConfigType.NOTION_DATABASE;
        case ConfigType.CONFLUENCE:
            return OutputConfigType.CONFLUENCE;
        case ConfigType.LINEAR_OUTPUT:
            return OutputConfigType.LINEAR_TICKET;
        case ConfigType.JIRA:
            return OutputConfigType.JIRA_TICKET;
        case ConfigType.SLACK_OUTPUT:
            return OutputConfigType.SLACK_CHANNEL;
        case ConfigType.GMAIL_OUTPUT:
            return OutputConfigType.GMAIL;
        default:
            throw new Error(`ConfigType ${configType} is not a valid output config type. Supported output config types are: NOTION_PAGE, NOTION_DATABASE, CONFLUENCE, LINEAR, JIRA, SLACK_OUTPUT, GMAIL_OUTPUT.`);
    }
}

/**
 * Converts OutputConfigType to IntegrationType.
 * Maps output configuration types to their corresponding integration types.
 */
export const convertOutputConfigTypeToIntegrationType = (outputConfigType: OutputConfigType): IntegrationType => {
    switch (outputConfigType) {
        case OutputConfigType.NOTION_PAGE:
        case OutputConfigType.NOTION_DATABASE:
            return IntegrationType.NOTION;
        case OutputConfigType.CONFLUENCE:
            return IntegrationType.ATLASSIAN;
        case OutputConfigType.LINEAR_TICKET:
            return IntegrationType.LINEAR;
        case OutputConfigType.JIRA_TICKET:
            return IntegrationType.ATLASSIAN;
        case OutputConfigType.SLACK_CHANNEL:
            return IntegrationType.SLACK;
        case OutputConfigType.GMAIL:
            return IntegrationType.GMAIL;
        default:
            throw outputConfigType satisfies never;
    }
}

export const convertConfigTypeToKnowledgeBaseConfigType = (configType: ConfigType): KnowledgeBaseConfigType => {
    switch (configType) {
        case ConfigType.POSTHOG:
            return KnowledgeBaseConfigType.POSTHOG;
        case ConfigType.GITHUB_KB:
            return KnowledgeBaseConfigType.GITHUB;
        case ConfigType.LAUNCHDARKLY:
            return KnowledgeBaseConfigType.LAUNCHDARKLY;
        case ConfigType.DATADOG:
            return KnowledgeBaseConfigType.DATADOG;
        default:
            throw new Error(`ConfigType ${configType} is not a valid knowledge base config type. Supported knowledge base config types are: POSTHOG, GITHUB_KB, DATADOG.`);
    }
}

/**
 * Converts an AgentKnowledgeBase with configs to a ConfigInstance.
 */
export const convertPrismaKnowledgeBaseConfigToConfigInstance = (agentKnowledgeBase: AgentKnowledgeBaseWithConfigs): ConfigInstance => {
    const integrationId = agentKnowledgeBase.integration_id;

    if (agentKnowledgeBase.posthog_config) {
        const posthogIntegration = agentKnowledgeBase.posthog_config;
        if (!posthogIntegration.project_id) {
            throw new Error('Posthog config requires project_id');
        }
        return new PosthogConfig(
            integrationId,
            posthogIntegration.project_id,
            posthogIntegration.project_name || undefined,
            posthogIntegration.can_read_logs || false,
            posthogIntegration.can_read_session_recordings || false
        );
    }

    if (agentKnowledgeBase.github_kb_config) {
        return new GitHubKBConfig(
            integrationId,
            agentKnowledgeBase.github_kb_config.repository_ids || [],
            agentKnowledgeBase.github_kb_config.repository_names || []
        );
    }

    if (agentKnowledgeBase.launchdarkly_config) {
        const launchdarklyIntegration = agentKnowledgeBase.launchdarkly_config;
        if (!launchdarklyIntegration.project_key) {
            throw new Error('LaunchDarkly config requires project_key');
        }
        return new LaunchDarklyConfig(
            integrationId,
            launchdarklyIntegration.project_key,
            launchdarklyIntegration.environment_keys || []
        );
    }

    if (agentKnowledgeBase.datadog_config) {
        const datadogConfig = agentKnowledgeBase.datadog_config;
        return new DatadogConfig(
            integrationId,
            datadogConfig.default_indexes && datadogConfig.default_indexes.length > 0
                ? datadogConfig.default_indexes
                : ["main"]
        );
    }

    throw new Error(`Unsupported knowledge base config type: ${agentKnowledgeBase.config_type}`);
}

/**
 * Converts a plain object config (from request body JSON) to a proper ConfigInstance.
 * This is needed because JSON deserialization creates plain objects, not class instances.
 * If the config is already an instance (has isComplete method), returns it as-is.
 */
export const convertPlainObjectToKnowledgeBaseConfigInstance = (config: any): ConfigInstance => {
    // If it's already an instance (has isComplete method), return as-is
    if (typeof config.isComplete === 'function') {
        return config as ConfigInstance;
    }

    // Convert plain object to proper instance based on configType
    switch (config.configType) {
        case ConfigType.DATADOG:
            return new DatadogConfig(
                config.integrationId,
                config.defaultIndexes || ["main"]
            );
        case ConfigType.POSTHOG:
            return new PosthogConfig(
                config.integrationId,
                config.projectId,
                config.projectName,
                config.canReadLogs || false,
                config.canReadSessionRecordings || false
            );
        case ConfigType.GITHUB_KB:
            return new GitHubKBConfig(
                config.integrationId,
                config.repositoryIds || [],
                config.repositoryNames || []
            );
        case ConfigType.LAUNCHDARKLY:
            return new LaunchDarklyConfig(
                config.integrationId,
                config.projectKey,
                config.environmentKeys || []
            );
        default:
            throw new Error(`Unsupported knowledge base config type: ${config.configType}`);
    }
}