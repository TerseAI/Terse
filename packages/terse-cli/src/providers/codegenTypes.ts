import type { GithubIntegration, ResendTemplate, ToolDefinition } from "terse-types"

interface GitHubRepo {
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

interface SlackChannelData {
    id: string
    name: string
}

interface SlackUserData {
    id: string
    name: string
}

interface LinearTeamData {
    id: string
    name: string
    key: string
}

interface LinearProjectData {
    id: string
    name: string
    description?: string
    teamId: string
}

interface NotionResourceData {
    id: string
    title: string
    type: string
}

interface PosthogProjectData {
    id: string
    name: string
    events: string[]
}

interface DatadogIndexData {
    name: string
}

interface LaunchDarklyProjectData {
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
    is_multiselect?: boolean
    options?: string[]
}

interface AttioObjectData {
    id: { workspace_id: string; object_id: string }
    api_slug: string
    singular_noun: string
    plural_noun?: string
    attributes?: AttioAttributeData[]
}

export interface SlackInstanceData extends IntegrationInstanceData {
    channels: SlackChannelData[]
    users: SlackUserData[]
}

export interface LinearInstanceData extends IntegrationInstanceData {
    teams: LinearTeamData[]
    projects: LinearProjectData[]
}

export interface NotionInstanceData extends IntegrationInstanceData {
    databases: NotionResourceData[]
    pages: NotionResourceData[]
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

export interface AttioListData {
    id: { workspace_id?: string; list_id: string }
    api_slug: string
    name: string
    parent_object?: string[] | string
    attributes?: AttioAttributeData[]
}

export interface AttioInstanceData extends IntegrationInstanceData {
    objects: AttioObjectData[]
    lists: AttioListData[]
}

interface HeyReachCampaignData {
    id: string
    name: string
}

export interface HeyReachInstanceData extends IntegrationInstanceData {
    campaigns: HeyReachCampaignData[]
}

export interface ResendInstanceData extends IntegrationInstanceData {
    templates: ResendTemplate[]
}

export interface CodegenInput {
    availableIntegrations: string[]
    github: GitHubInstanceData[]
    slack: SlackInstanceData[]
    gmail: IntegrationInstanceData[]
    linear: LinearInstanceData[]
    notion: NotionInstanceData[]
    posthog: PosthogInstanceData[]
    datadog: DatadogInstanceData[]
    launchdarkly: LaunchDarklyInstanceData[]
    workos: IntegrationInstanceData[]
    attio: AttioInstanceData[]
    snowflake: SnowflakeInstanceData[]
    heyreach: HeyReachInstanceData[]
    resend: ResendInstanceData[]
    tools: ToolDefinition[]
}
