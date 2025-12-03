import { IntegrationType } from "../shared/Integrations";
import { 
    InputConfigType, 
    IntegrationType as PrismaIntegrationType, 
    OutputConfigType,
} from "@prisma/client";
import { ChannelInputWithConfigs, ChannelOutputWithConfigs } from "../types/prisma";
import { 
    ConfigInstance, 
    GmailConfig, 
    FigmaConfig, 
    SlackConfig, 
    NotionConfig, 
    NotionPageConfig, 
    LinearConfig, 
    GitHubConfig, 
    JiraConfig, 
    ConfluenceConfig,
    ConfigType
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
        default:
            throw prismaIntegrationType satisfies never;
    }
}

export const convertPrismaConfigToConfigInstance = (channelInput: ChannelInputWithConfigs): ConfigInstance => {
    const integrationId = channelInput.integration_id;

    // Determine which config is present and create the appropriate ConfigInstance
    if (channelInput.gmail_config) {
        return new GmailConfig(integrationId);
    }

    if (channelInput.figma_config) {
        return new FigmaConfig(
            integrationId,
            channelInput.figma_config.file_key,
            channelInput.figma_config.file_name || '',
            channelInput.figma_config.team_id || ''
        );
    }

    if (channelInput.slack_config) {
        return new SlackConfig(
            integrationId,
            channelInput.slack_config.channel_id || undefined,
            channelInput.slack_config.channel_name || undefined,
            channelInput.slack_config.listen_to_user_dms || false
        );
    }

    if (channelInput.notion_page_config) {
        return new NotionPageConfig(
            integrationId,
            channelInput.notion_page_config.page_id || undefined,
            channelInput.notion_page_config.page_name || undefined
        );
    }

    if (channelInput.notion_config) {
        return new NotionConfig(
            integrationId,
            channelInput.notion_config.database_id || undefined,
            channelInput.notion_config.database_name || undefined
        );
    }

    if (channelInput.linear_config) {
        return new LinearConfig(
            integrationId,
            channelInput.linear_config.project_id || undefined,
            channelInput.linear_config.project_name || undefined
        );
    }

    if (channelInput.github_config) {
        return new GitHubConfig(
            integrationId,
            channelInput.github_config.repository_ids || []
        );
    }

    if (channelInput.jira_config) {
        return new JiraConfig(
            integrationId,
            channelInput.jira_config.project_key || undefined,
            channelInput.jira_config.project_id || undefined
        );
    }

    if (channelInput.confluence_config) {
        return new ConfluenceConfig(
            integrationId,
            channelInput.confluence_config.space_name || '',
            channelInput.confluence_config.space_id || '',
            channelInput.confluence_config.page_id || '',
            channelInput.confluence_config.page_name || ''
        );
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
            break;
        default:
            throw channelInput.config_type satisfies never;
    }

    throw new Error(`No config found for channel input ${channelInput.id}`);
}

/**
 * Converts a ChannelOutput with configs to a ConfigInstance.
 * Similar to convertPrismaConfigToConfigInstance but for outputs.
 */
export const convertPrismaOutputConfigToConfigInstance = (channelOutput: ChannelOutputWithConfigs): ConfigInstance => {
    const integrationId = channelOutput.integration_id;

    // Determine which config is present and create the appropriate ConfigInstance
    // Note: Outputs only support NOTION_PAGE, NOTION_DATABASE, and CONFLUENCE
    if (channelOutput.notion_page_config) {
        return new NotionPageConfig(
            integrationId,
            channelOutput.notion_page_config.page_id || undefined,
            channelOutput.notion_page_config.page_name || undefined
        );
    }

    if (channelOutput.notion_config) {
        return new NotionConfig(
            integrationId,
            channelOutput.notion_config.database_id || undefined,
            channelOutput.notion_config.database_name || undefined
        );
    }

    if (channelOutput.confluence_config) {
        return new ConfluenceConfig(
            integrationId,
            channelOutput.confluence_config.space_name || '',
            channelOutput.confluence_config.space_id || '',
            channelOutput.confluence_config.page_id || '',
            channelOutput.confluence_config.page_name || ''
        );
    }

    // Type guard to ensure we implement conversion here
    switch (channelOutput.config_type) {
        case OutputConfigType.NOTION_PAGE:
        case OutputConfigType.NOTION_DATABASE:
        case OutputConfigType.CONFLUENCE:
            break;
        default:
            throw channelOutput.config_type satisfies never;
    }

    throw new Error(`No config found for channel output ${channelOutput.id}`);
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
        case ConfigType.LINEAR:
            return InputConfigType.LINEAR;
        case ConfigType.GITHUB:
            return InputConfigType.GITHUB;
        case ConfigType.JIRA:
            return InputConfigType.JIRA;
        case ConfigType.CONFLUENCE:
            return InputConfigType.CONFLUENCE;
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
            return ConfigType.LINEAR;
        case InputConfigType.GITHUB:
            return ConfigType.GITHUB;
        case InputConfigType.JIRA:
            return ConfigType.JIRA;
        case InputConfigType.CONFLUENCE:
            return ConfigType.CONFLUENCE;
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
        default:
            throw new Error(`ConfigType ${configType} is not a valid output config type. Only NOTION_PAGE, NOTION_DATABASE, and CONFLUENCE are supported.`);
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
        default:
            throw outputConfigType satisfies never;
    }
}