export const currentUserKey = () => ["currentUser"];
export const userOrganizationsKey = () => ["userOrganizations"];
export const widgetTokenKey = () => ["widgetToken"];
export const integrationsKey = () => ["integrations"];
export const notificationDestinationsKey = () => ["notificationDestinations"];
export const apiTokensKey = () => ["apiTokens"];
export const notificationSettingsKey = () => ["notificationSettings"];
export const sentNotificationsKey = () => ["sentNotifications"];
export const pendingApprovalsKey = () => ["pending   Approvals"];
export const slackChannelsKey = (integrationId) => {
    if (!integrationId) {
        return null;
    }
    return ["slackChannels", integrationId];
};
export const slackUsersKey = (integrationId) => {
    if (!integrationId) {
        return null;
    }
    return ["slackUsers", integrationId];
};
export const notionResourcesKey = (integrationId) => {
    if (!integrationId) {
        return null;
    }
    return ["notionResources", integrationId];
};
export const posthogIntegrationsKey = () => {
    return ["posthogIntegrations"];
};
export const launchdarklyIntegrationsKey = () => {
    return ["launchdarklyIntegrations"];
};
export const datadogIntegrationsKey = () => {
    return ["datadogIntegrations"];
};
export const githubRepositoriesKey = (installationId) => {
    if (!installationId) {
        return null;
    }
    return ["githubRepositories", installationId];
};
export const confluenceResourcesKey = (integrationId) => {
    if (!integrationId) {
        return null;
    }
    return ["confluenceResources", integrationId];
};
export const jiraResourcesKey = (integrationId) => {
    if (!integrationId) {
        return null;
    }
    return ["jiraResources", integrationId];
};
export const linearTeamsKey = (integrationId) => {
    if (!integrationId) {
        return null;
    }
    return ["linearTeams", integrationId];
};
export const gmailIntegrationsKey = () => {
    return ["gmailIntegrations"];
};
export const atlassianIntegrationsKey = () => {
    return ["atlassianIntegrations"];
};
export const figmaIntegrationsKey = () => {
    return ["figmaIntegrations"];
};
export const githubIntegrationsKey = () => {
    return ["githubIntegrations"];
};
export const linearIntegrationsKey = () => {
    return ["linearIntegrations"];
};
export const notionIntegrationsKey = () => {
    return ["notionIntegrations"];
};
export const slackIntegrationsKey = () => {
    return ["slackIntegrations"];
};
export const workosIntegrationsKey = () => {
    return ["workosIntegrations"];
};
export const attioIntegrationsKey = () => {
    return ["attioIntegrations"];
};
export const snowflakeIntegrationsKey = () => {
    return ["snowflakeIntegrations"];
};
export const attioObjectsKey = (integrationId) => {
    if (!integrationId) {
        return null;
    }
    return ["attioObjects", integrationId];
};
export const allRunHistoryKey = (params) => {
    if (!params || Object.keys(params).length === 0) {
        return ["allRunHistory"];
    }
    const sortedKeys = Object.keys(params).sort();
    const sortedParams = {};
    for (const key of sortedKeys) {
        const value = params[key];
        if (value !== undefined) {
            sortedParams[key] = value;
        }
    }
    return ["allRunHistory", JSON.stringify(sortedParams)];
};
export const runHistoryKey = (agentId, params) => {
    if (!params || Object.keys(params).length === 0) {
        return ["runHistory", agentId];
    }
    // Yea we may need to rethink how we do this. I think it may be better to just fetch all params and fiter on the client.
    // But I see why it as done this way. It makes more sense if you support text search.
    const sortedKeys = Object.keys(params).sort();
    const sortedParams = {};
    for (const key of sortedKeys) {
        const value = params[key];
        if (value !== undefined) {
            sortedParams[key] = value;
        }
    }
    const serializedParams = JSON.stringify(sortedParams);
    return ["runHistory", agentId, serializedParams];
};
export const recentAgentsKey = (limit) => {
    if (limit !== undefined) {
        return ["recentAgents", limit];
    }
    return ["recentAgents"];
};
export const statsKey = (timezone, interval) => {
    if (!interval) {
        return ["stats", timezone];
    }
    return ["stats", timezone, interval];
};
export const agentListKey = ({ page = 1, limit = 25, isActive, search } = {}) => ["agents", { page, limit, isActive, search }];
export const agentDetailKey = (id) => {
    if (!id)
        return null;
    return ["agent", { id }];
};
export const agentImprovementsKey = (agentId) => {
    if (!agentId)
        return null;
    return ["agentImprovements", { agentId }];
};
export const builderChatHistoryKey = (sessionId) => {
    if (!sessionId)
        return null;
    return ["builderChatHistory", sessionId];
};
export const orgLogoKey = (organizationId) => {
    if (!organizationId)
        return null;
    return ["orgLogo", organizationId];
};
export const userByIdKey = (userId) => {
    if (!userId)
        return null;
    return ["userById", userId];
};
