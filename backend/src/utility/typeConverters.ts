import { IntegrationType } from "../shared/Integrations";
import { 
    InputConfigType, 
    IntegrationType as PrismaIntegrationType, 
    RunHistoryIntegration,
    RunHistoryStatus as PrismaRunHistoryStatus,
    RunHistoryDecisionAction as PrismaRunHistoryDecisionAction
} from "@prisma/client";
import { AutomationInputWithConfigs } from "../types/prisma";
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
import {
    RunHistoryStatus,
    RunHistoryDecisionAction,
    RunHistoryRecord,
    RunHistoryAction,
    RunHistoryTrigger,
    RunHistoryDecision
} from "../shared/RunHistoryTypes";
import { Prisma } from "@prisma/client";

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
        default:
            throw prismaIntegrationType satisfies never;
    }
}

export const convertIntegrationTypeToRunHistoryIntegration = (integrationType: IntegrationType): RunHistoryIntegration => {
    switch (integrationType) {
        case IntegrationType.GITHUB:
            return RunHistoryIntegration.github;
        case IntegrationType.GMAIL:
            return RunHistoryIntegration.gmail;
        case IntegrationType.LINEAR:
            return RunHistoryIntegration.linear;
        case IntegrationType.ATLASSIAN:
            return RunHistoryIntegration.confluence; // ATLASSIAN maps to confluence in run history
        case IntegrationType.SLACK:
            return RunHistoryIntegration.slack;
        case IntegrationType.NOTION:
            return RunHistoryIntegration.notion;
        case IntegrationType.FIGMA:
            return RunHistoryIntegration.figma;
        default:
            throw integrationType satisfies never;
    }
}

export const convertRunHistoryIntegrationToIntegrationType = (runHistoryIntegration: RunHistoryIntegration): IntegrationType => {
    switch (runHistoryIntegration) {
        case RunHistoryIntegration.github:
            return IntegrationType.GITHUB;
        case RunHistoryIntegration.gmail:
            return IntegrationType.GMAIL;
        case RunHistoryIntegration.linear:
            return IntegrationType.LINEAR;
        case RunHistoryIntegration.confluence:
        case RunHistoryIntegration.jira:
            // Both map to ATLASSIAN in shared enum
            return IntegrationType.ATLASSIAN;
        case RunHistoryIntegration.slack:
            return IntegrationType.SLACK;
        case RunHistoryIntegration.notion:
            return IntegrationType.NOTION;
        case RunHistoryIntegration.figma:
            return IntegrationType.FIGMA;
        default:
            throw runHistoryIntegration satisfies never;
    }
}

export const convertPrismaConfigToConfigInstance = (automationInput: AutomationInputWithConfigs): ConfigInstance => {
    const integrationId = automationInput.integration_id;

    // Determine which config is present and create the appropriate ConfigInstance
    if (automationInput.gmail_config) {
        return new GmailConfig(integrationId);
    }

    if (automationInput.figma_config) {
        return new FigmaConfig(
            integrationId,
            automationInput.figma_config.file_key,
            automationInput.figma_config.file_name || '',
            automationInput.figma_config.team_id || ''
        );
    }

    if (automationInput.slack_config) {
        return new SlackConfig(
            integrationId,
            automationInput.slack_config.channel_id || undefined,
            automationInput.slack_config.channel_name || undefined,
            automationInput.slack_config.listen_to_user_dms || false
        );
    }

    if (automationInput.notion_page_config) {
        return new NotionPageConfig(
            integrationId,
            automationInput.notion_page_config.page_id || undefined,
            automationInput.notion_page_config.page_name || undefined
        );
    }

    if (automationInput.notion_config) {
        return new NotionConfig(
            integrationId,
            automationInput.notion_config.database_id || undefined,
            automationInput.notion_config.database_name || undefined
        );
    }

    if (automationInput.linear_config) {
        return new LinearConfig(
            integrationId,
            automationInput.linear_config.project_id || undefined,
            automationInput.linear_config.project_name || undefined
        );
    }

    if (automationInput.github_config) {
        return new GitHubConfig(
            integrationId,
            automationInput.github_config.repository_ids || []
        );
    }

    if (automationInput.jira_config) {
        return new JiraConfig(
            integrationId,
            automationInput.jira_config.project_key || undefined,
            automationInput.jira_config.project_id || undefined
        );
    }

    if (automationInput.confluence_config) {
        return new ConfluenceConfig(
            integrationId,
            automationInput.confluence_config.space_name || '',
            automationInput.confluence_config.space_id || '',
            automationInput.confluence_config.page_id || '',
            automationInput.confluence_config.page_name || ''
        );
    }

    // Type guard to ensure we implement conversion here
    switch (automationInput.config_type) {
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
            throw automationInput.config_type satisfies never;
    }

    throw new Error(`No config found for automation input ${automationInput.id}`);
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