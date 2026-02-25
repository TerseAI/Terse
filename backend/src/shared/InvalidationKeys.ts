import { GetRunHistoryParams } from "./RunHistoryTypes"
import type { StatsInterval } from "./types"

export const currentUserKey = (): readonly [string] => ["currentUser"]

export const userOrganizationsKey = (): readonly [string] => ["userOrganizations"]

export const widgetTokenKey = (): readonly [string] => ["widgetToken"]

export const integrationsKey = (): readonly [string] => ["integrations"]

export const notificationDestinationsKey = (): readonly [string] => ["notificationDestinations"]

export const slackChannelsKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null
    }

    return ["slackChannels", integrationId] as const
}

export const slackUsersKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null
    }

    return ["slackUsers", integrationId] as const
}

export const notionResourcesKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null
    }

    return ["notionResources", integrationId] as const
}

export const posthogIntegrationsKey = (): readonly [string] => {
    return ["posthogIntegrations"] as const
}

export const launchdarklyIntegrationsKey = (): readonly [string] => {
    return ["launchdarklyIntegrations"] as const
}

export const datadogIntegrationsKey = (): readonly [string] => {
    return ["datadogIntegrations"] as const
}

export const githubRepositoriesKey = (installationId: number | null | undefined): readonly [string, number] | null => {
    if (!installationId) {
        return null
    }

    return ["githubRepositories", installationId] as const
}

export const confluenceResourcesKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null
    }

    return ["confluenceResources", integrationId] as const
}

export const jiraResourcesKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null
    }

    return ["jiraResources", integrationId] as const
}

export const linearTeamsKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null
    }

    return ["linearTeams", integrationId] as const
}

export const gmailIntegrationsKey = (): readonly [string] => {
    return ["gmailIntegrations"] as const
}

export const atlassianIntegrationsKey = (): readonly [string] => {
    return ["atlassianIntegrations"] as const
}

export const figmaIntegrationsKey = (): readonly [string] => {
    return ["figmaIntegrations"] as const
}

export const githubIntegrationsKey = (): readonly [string] => {
    return ["githubIntegrations"] as const
}

export const linearIntegrationsKey = (): readonly [string] => {
    return ["linearIntegrations"] as const
}

export const notionIntegrationsKey = (): readonly [string] => {
    return ["notionIntegrations"] as const
}

export const slackIntegrationsKey = (): readonly [string] => {
    return ["slackIntegrations"] as const
}

export const workosIntegrationsKey = (): readonly [string] => {
    return ["workosIntegrations"] as const
}

export const attioIntegrationsKey = (): readonly [string] => {
    return ["attioIntegrations"] as const
}

export const attioObjectsKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null
    }

    return ["attioObjects", integrationId] as const
}

export const allRunHistoryKey = (params?: GetRunHistoryParams): readonly [string, string] | readonly [string] => {
    if (!params || Object.keys(params).length === 0) {
        return ["allRunHistory"] as const
    }
    const sortedKeys = Object.keys(params).sort()
    const sortedParams: Record<string, any> = {}
    for (const key of sortedKeys) {
        const value = params[key as keyof GetRunHistoryParams]
        if (value !== undefined) {
            sortedParams[key] = value
        }
    }
    return ["allRunHistory", JSON.stringify(sortedParams)] as const
}

export const runHistoryKey = (agentId: string, params?: GetRunHistoryParams): readonly [string, string, string] | readonly [string, string] => {
    if (!params || Object.keys(params).length === 0) {
        return ["runHistory", agentId] as const
    }

    // Yea we may need to rethink how we do this. I think it may be better to just fetch all params and fiter on the client.
    // But I see why it as done this way. It makes more sense if you support text search.
    const sortedKeys = Object.keys(params).sort()
    const sortedParams: Record<string, any> = {}
    for (const key of sortedKeys) {
        const value = params[key as keyof GetRunHistoryParams]
        if (value !== undefined) {
            sortedParams[key] = value
        }
    }
    const serializedParams = JSON.stringify(sortedParams)
    return ["runHistory", agentId, serializedParams] as const
}

export const recentAgentsKey = (limit?: number): readonly [string, number] | readonly [string] => {
    if (limit !== undefined) {
        return ["recentAgents", limit] as const
    }
    return ["recentAgents"] as const
}

export const statsKey = (timezone: string, interval?: StatsInterval): readonly [string, string] | readonly [string, string, StatsInterval] => {
    if (!interval) {
        return ["stats", timezone] as const
    }
    return ["stats", timezone, interval] as const
}

export type AgentListArgs = {
    page?: number
    limit?: number
    isActive?: boolean
    search?: string
}

export const agentListKey = ({ page = 1, limit = 25, isActive, search }: AgentListArgs = {}): readonly [string, AgentListArgs] => ["agents", { page, limit, isActive, search }]

export const agentDetailKey = (id: string | null): readonly [string, { id: string }] | null => {
    if (!id) return null
    return ["agent", { id }]
}

export const builderChatHistoryKey = (sessionId: string | null | undefined): readonly [string, string] | null => {
    if (!sessionId) return null
    return ["builderChatHistory", sessionId] as const
}

export const orgLogoKey = (organizationId: string | null | undefined): readonly [string, string] | null => {
    if (!organizationId) return null
    return ["orgLogo", organizationId] as const
}

export const userByIdKey = (userId: string | null | undefined): readonly [string, string] | null => {
    if (!userId) return null
    return ["userById", userId] as const
}
