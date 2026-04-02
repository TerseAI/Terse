import type { GithubIntegration } from "terse-types"

export interface GitHubRepo {
    id: number
    name: string
    owner: string
    fullName?: string
}

export interface GitHubInstanceData {
    integration: GithubIntegration
    repositories: GitHubRepo[]
}

export interface IntegrationInstanceData {
    id: string
    displayName: string
}

export interface SlackChannelData {
    id: string
    name: string
}

export interface LinearTeamData {
    id: string
    name: string
    key: string
}

export interface NotionResourceData {
    id: string
    title: string
    type: string
}

export interface JiraProjectData {
    id: string
    key: string
    name: string
}

export interface ConfluencePageData {
    id: string
    title: string
    spaceId: string
    spaceName: string
}

export interface PosthogProjectData {
    id: string
    name: string
}

export interface DatadogIndexData {
    name: string
}

export interface LaunchDarklyProjectData {
    key: string
    name: string
}

export interface SnowflakeInstanceData {
    id: string
    name: string
}

export interface AttioAttributeData {
    api_slug?: string
    title?: string
    type?: string
    is_required?: boolean
    is_unique?: boolean
}

export interface AttioObjectData {
    api_slug: string
    singular_noun: string
    plural_noun?: string
    attributes?: AttioAttributeData[]
}

export interface SlackInstanceData extends IntegrationInstanceData {
    channels: SlackChannelData[]
}

export interface LinearInstanceData extends IntegrationInstanceData {
    teams: LinearTeamData[]
}

export interface NotionInstanceData extends IntegrationInstanceData {
    databases: NotionResourceData[]
    pages: NotionResourceData[]
}

export interface AtlassianInstanceData extends IntegrationInstanceData {
    jiraProjects: JiraProjectData[]
    confluencePages: ConfluencePageData[]
}

export interface PosthogInstanceData extends IntegrationInstanceData {
    projects: PosthogProjectData[]
}

export interface DatadogInstanceData extends IntegrationInstanceData {
    indexes: DatadogIndexData[]
}

export interface LaunchDarklyInstanceData extends IntegrationInstanceData {
    projects: LaunchDarklyProjectData[]
}

export interface AttioInstanceData extends IntegrationInstanceData {
    objects: AttioObjectData[]
}

export interface ToolDefinition {
    name: string
    displayName: string
    description: string
    integration: string
    isReadOnly: boolean
    supportsApproval: boolean
    parameters: JsonSchema
}

export interface JsonSchema {
    type?: string
    properties?: Record<string, JsonSchema>
    required?: string[]
    items?: JsonSchema
    enum?: Array<string | number | boolean>
    anyOf?: JsonSchema[]
    description?: string
    [key: string]: unknown
}

export interface CodegenInput {
    github: GitHubInstanceData[]
    slack: SlackInstanceData[]
    gmail: IntegrationInstanceData[]
    figma: IntegrationInstanceData[]
    linear: LinearInstanceData[]
    atlassian: AtlassianInstanceData[]
    notion: NotionInstanceData[]
    posthog: PosthogInstanceData[]
    datadog: DatadogInstanceData[]
    launchdarkly: LaunchDarklyInstanceData[]
    workos: IntegrationInstanceData[]
    attio: AttioInstanceData[]
    snowflake: SnowflakeInstanceData[]
    tools: ToolDefinition[]
}
