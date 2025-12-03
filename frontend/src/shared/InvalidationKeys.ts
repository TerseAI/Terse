import { GetRunHistoryParams } from "./RunHistoryTypes";

export const integrationsKey = (): readonly [string] => ['integrations'];

export const notificationDestinationsKey = (): readonly [string] => ['notificationDestinations'];

export const slackChannelsKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null;
    }

    return ['slackChannels', integrationId] as const;
};

export const notionResourcesKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null;
    }

    return ['notionResources', integrationId] as const;
};

export const githubRepositoriesKey = (installationId: number | null | undefined): readonly [string, number] | null => {
    if (!installationId) {
        return null;
    }

    return ['githubRepositories', installationId] as const;
};

export const confluenceResourcesKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null;
    }

    return ['confluenceResources', integrationId] as const;
};

export const jiraResourcesKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null;
    }

    return ['jiraResources', integrationId] as const;
};

export const linearTeamsKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null;
    }

    return ['linearTeams', integrationId] as const;
};

export const gmailIntegrationsKey = (): readonly [string] => {
    return ['gmailIntegrations'] as const;
};

export const atlassianIntegrationsKey = (): readonly [string] => {
    return ['atlassianIntegrations'] as const;
};

export const figmaIntegrationsKey = (): readonly [string] => {
    return ['figmaIntegrations'] as const;
};

export const githubIntegrationsKey = (): readonly [string] => {
    return ['githubIntegrations'] as const;
};

export const linearIntegrationsKey = (): readonly [string] => {
    return ['linearIntegrations'] as const;
};

export const notionIntegrationsKey = (): readonly [string] => {
    return ['notionIntegrations'] as const;
};

export const slackIntegrationsKey = (): readonly [string] => {
    return ['slackIntegrations'] as const;
};

export const runHistoryKey = (
    channelId: string,
    params?: GetRunHistoryParams
): readonly [string, string, string] | readonly [string, string] => {
    if (!params || Object.keys(params).length === 0) {
        return ['runHistory', channelId] as const;
    }
    
    // Yea we may need to rethink how we do this. I think it may be better to just fetch all params and fiter on the client.
    // But I see why it as done this way. It makes more sense if you support text search.
    const sortedKeys = Object.keys(params).sort();
    const sortedParams: Record<string, any> = {};
    for (const key of sortedKeys) {
        const value = params[key as keyof GetRunHistoryParams];
        if (value !== undefined) {
            sortedParams[key] = value;
        }
    }
    const serializedParams = JSON.stringify(sortedParams);
    return ['runHistory', channelId, serializedParams] as const;
};

export const recentChannelsKey = (limit?: number): readonly [string, number] | readonly [string] => {
    if (limit !== undefined) {
        return ['recentChannels', limit] as const;
    }
    return ['recentChannels'] as const;
};

export const statsKey = (): readonly [string] => {
    return ['stats'] as const;
};