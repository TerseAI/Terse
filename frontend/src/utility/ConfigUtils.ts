import {
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
    TerseConfig,
    TimeTriggerConfig
} from "@/shared/Configs"

/**
 * Converts a plain JSON config object (from backend) back into a ConfigInstance class.
 * This is necessary because JSON serialization loses the prototype chain.
 */
export function deserializeConfig(jsonConfig: any): ConfigInstance {
    if (!jsonConfig || !jsonConfig.configType) {
        throw new Error("Invalid config: missing configType")
    }

    // If it's already a class instance with the isComplete method, return it as-is
    if (typeof jsonConfig.isComplete === "function") {
        return jsonConfig as ConfigInstance
    }

    // Otherwise, re-instantiate based on configType
    const configType = jsonConfig.configType as ConfigType
    const integrationId = jsonConfig.integrationId

    if (!integrationId) {
        throw new Error("Invalid config: missing integrationId")
    }

    switch (configType) {
        case ConfigType.GMAIL:
            return new GmailConfig(integrationId)

        case ConfigType.FIGMA:
            const figmaConfig = jsonConfig as FigmaConfig
            return new FigmaConfig(integrationId, figmaConfig.fileKey, figmaConfig.fileName, figmaConfig.teamId)

        case ConfigType.SLACK:
            const slackConfig = jsonConfig as SlackConfig
            return new SlackConfig(integrationId, slackConfig.channelId, slackConfig.channelName, slackConfig.listenToUserDms, slackConfig.userIds)

        case ConfigType.NOTION:
            const notionConfig = jsonConfig as NotionConfig
            return new NotionConfig(integrationId, notionConfig.databaseIds ?? [], notionConfig.databaseNames ?? [], notionConfig.pageIds ?? [], notionConfig.pageNames ?? [])

        case ConfigType.LINEAR_INPUT:
            const linearInputConfig = jsonConfig as LinearInputConfig
            return new LinearInputConfig(integrationId, linearInputConfig.projectId, linearInputConfig.projectName)
        case ConfigType.LINEAR_OUTPUT:
            const linearOutputConfig = jsonConfig as LinearOutputConfig
            return new LinearOutputConfig(integrationId, linearOutputConfig.teamId, linearOutputConfig.teamName)
        case ConfigType.GITHUB:
            const githubConfig = jsonConfig as GitHubConfig
            return new GitHubConfig(integrationId, githubConfig.repositoryIds)

        case ConfigType.JIRA:
            const jiraConfig = jsonConfig as JiraConfig
            return new JiraConfig(integrationId, jiraConfig.projectKey, jiraConfig.projectId)

        case ConfigType.CONFLUENCE:
            const confluenceConfig = jsonConfig as ConfluenceConfig
            return new ConfluenceConfig(integrationId, confluenceConfig.spaceName, confluenceConfig.spaceId, confluenceConfig.pageId, confluenceConfig.pageName)
        case ConfigType.POSTHOG:
            const posthogConfig = jsonConfig as PosthogConfig
            return new PosthogConfig(integrationId, posthogConfig.projectId, posthogConfig.projectName)
        case ConfigType.TIME_TRIGGER:
            const timeTriggerConfig = jsonConfig as TimeTriggerConfig
            return new TimeTriggerConfig(timeTriggerConfig.cronExpression)
        case ConfigType.GITHUB_KB:
            const githubKBConfig = jsonConfig as GitHubKBConfig
            return new GitHubKBConfig(integrationId, githubKBConfig.repositoryIds, githubKBConfig.repositoryNames)
        case ConfigType.SLACK_OUTPUT:
            const slackOutputConfig = jsonConfig as SlackOutputConfig
            return new SlackOutputConfig(integrationId, slackOutputConfig.channelId, slackOutputConfig.channelName, slackOutputConfig.userIds, slackOutputConfig.userNames)
        case ConfigType.GMAIL_OUTPUT:
            return new GmailOutputConfig(integrationId)
        case ConfigType.LAUNCHDARKLY:
            const launchDarklyConfig = jsonConfig as LaunchDarklyConfig
            return new LaunchDarklyConfig(integrationId, launchDarklyConfig.projectKey, launchDarklyConfig.environmentKeys)
        case ConfigType.DATADOG:
            const datadogConfig = jsonConfig as DatadogConfig
            return new DatadogConfig(integrationId, datadogConfig.defaultIndexes)
        case ConfigType.LINEAR_KB:
            const linearKBConfig = jsonConfig as LinearKBConfig
            return new LinearKBConfig(integrationId, linearKBConfig.teamId, linearKBConfig.teamName, linearKBConfig.projectId, linearKBConfig.projectName)
        case ConfigType.SLACK_KB:
            const slackKBConfig = jsonConfig as SlackKBConfig
            return new SlackKBConfig(
                integrationId,
                slackKBConfig.channelIds ?? [],
                slackKBConfig.channelNames ?? [],
                slackKBConfig.allowDms ?? false,
                slackKBConfig.userIds ?? [],
                slackKBConfig.userNames ?? []
            )
        case ConfigType.TERSE:
            return new TerseConfig()

        default:
            const _exhaustive: never = configType
            throw new Error(`Unknown config type: ${_exhaustive}`)
    }
}
