import { ConfigInstance, ConfigType, GmailConfig, FigmaConfig, SlackConfig, SlackOutputConfig, NotionConfig, NotionPageConfig, LinearInputConfig, LinearOutputConfig, GitHubConfig, JiraConfig, ConfluenceConfig, PosthogConfig, TimeTriggerConfig, GitHubKBConfig, LaunchDarklyConfig, DatadogConfig, GmailOutputConfig } from '@/shared/Configs';


/**
 * Converts a plain JSON config object (from backend) back into a ConfigInstance class.
 * This is necessary because JSON serialization loses the prototype chain.
 */
export function deserializeConfig(jsonConfig: any): ConfigInstance {
    if (!jsonConfig || !jsonConfig.configType) {
        throw new Error('Invalid config: missing configType');
    }

    // If it's already a class instance with the isComplete method, return it as-is
    if (typeof jsonConfig.isComplete === 'function') {
        return jsonConfig as ConfigInstance;
    }

    // Otherwise, re-instantiate based on configType
    const configType = jsonConfig.configType as ConfigType;
    const integrationId = jsonConfig.integrationId;

    if (!integrationId) {
        throw new Error('Invalid config: missing integrationId');
    }

    switch (configType) {
        case ConfigType.GMAIL:
            return new GmailConfig(integrationId);

        case ConfigType.FIGMA:
            return new FigmaConfig(
                integrationId,
                jsonConfig.fileKey || '',
                jsonConfig.fileName || '',
                jsonConfig.teamId || ''
            );

        case ConfigType.SLACK:
            return new SlackConfig(
                integrationId,
                jsonConfig.channelId,
                jsonConfig.channelName,
                jsonConfig.listenToUserDms || false,
                jsonConfig.userIds || []
            );

        case ConfigType.NOTION_DATABASE:
            return new NotionConfig(
                integrationId,
                jsonConfig.databaseId,
                jsonConfig.databaseName
            );

        case ConfigType.NOTION_PAGE:
            return new NotionPageConfig(
                integrationId,
                jsonConfig.pageId,
                jsonConfig.pageName
            );

        case ConfigType.LINEAR_INPUT:
            return new LinearInputConfig(
                integrationId,
                jsonConfig.projectId,
                jsonConfig.projectName
            );
        case ConfigType.LINEAR_OUTPUT:
            return new LinearOutputConfig(
                integrationId,
                jsonConfig.teamId,
                jsonConfig.teamName
            );
        case ConfigType.GITHUB:
            return new GitHubConfig(
                integrationId,
                jsonConfig.repositoryIds || []
            );

        case ConfigType.JIRA:
            return new JiraConfig(
                integrationId,
                jsonConfig.projectKey,
                jsonConfig.projectId
            );

        case ConfigType.CONFLUENCE:
            return new ConfluenceConfig(
                integrationId,
                jsonConfig.spaceName || '',
                jsonConfig.spaceId || '',
                jsonConfig.pageId || '',
                jsonConfig.pageName || ''
            );
        case ConfigType.POSTHOG:
            return new PosthogConfig(
                integrationId,
                jsonConfig.projectId || '',
                jsonConfig.projectName || undefined,
                jsonConfig.canReadLogs ?? false,
                jsonConfig.canReadSessionRecordings ?? false
            );
        case ConfigType.TIME_TRIGGER:
            return new TimeTriggerConfig(
                jsonConfig.cronExpression || ''
            );
        case ConfigType.GITHUB_KB:
            return new GitHubKBConfig(
                integrationId,
                jsonConfig.repositoryIds || [],
                jsonConfig.repositoryNames || []
            );
        case ConfigType.SLACK_OUTPUT:
            return new SlackOutputConfig(
                integrationId,
                jsonConfig.channelId,
                jsonConfig.channelName
            );
        case ConfigType.GMAIL_OUTPUT:
            return new GmailOutputConfig(
                integrationId
            );
        case ConfigType.LAUNCHDARKLY:
            return new LaunchDarklyConfig(
                integrationId,
                jsonConfig.projectKey || '',
                jsonConfig.environmentKeys || []
            );
        case ConfigType.DATADOG:
            return new DatadogConfig(
                integrationId,
                jsonConfig.defaultIndexes || []
            );

        default:
            const _exhaustive: never = configType;
            throw new Error(`Unknown config type: ${_exhaustive}`);
    }
}

