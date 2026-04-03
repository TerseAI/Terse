import * as z from "zod"

import { ConfigInstance, ConfigType } from "./Configs"
import { IntegrationType } from "./Integrations"
import { RunHistoryAction, RunHistoryActionType, RunHistoryRecordWithAgent } from "./RunHistoryTypes"
import { Project, Ticket } from "./TicketSystem"
import {
    DefinedToolOutputByName,
    ToolOutputBase,
    ToolOutputFailureBase,
    ToolOutputSuccessBase,
    gitHubCodeGrepResultSchema,
    gitHubCodeSearchResultSchema,
    gitHubCommitSummarySchema,
    gmailDraftSummarySchema,
    gmailSendSummarySchema,
    confluenceBodyContentSchema,
    confluenceBodyRepresentationSchema,
    confluenceCommentPositionSchema,
    confluencePageQueryResultSchema,
    confluencePageRelationSchema,
    confluencePageSpaceSchema,
    confluencePageVersionAuthorSchema,
    confluencePageVersionSchema,
    gitHubDirectoryEntrySchema,
    gitHubFileEntrySchema,
    gitHubOtherEntrySchema,
    gitHubPaginationSchema,
    gitHubPullRequestRefSchema,
    gitHubPullRequestSummarySchema,
    jiraIssueAssigneeSchema,
    jiraIssueProjectRefSchema,
    jiraIssueStateSchema,
    jiraIssueSummarySchema,
    jiraIssueTypeRefSchema,
    jiraRichDescriptionSchema,
    linearCommentHandleSchema,
    linearIssueAssigneeSchema,
    linearIssueDetailSchema,
    linearIssueHandleSchema,
    linearIssueProjectSchema,
    linearIssueSummarySchema,
    linearIssueTeamSchema,
    linearLabelSummarySchema,
    linearProjectSummarySchema,
    linearSearchPaginationSchema,
    linearStateSummarySchema,
    linearTeamSchema,
    linearUserSummarySchema,
    notionDatabaseQueryPageSchema,
    notionDatabaseRowMutationResultSchema,
    notionDateReferenceSchema,
    notionFileReferenceSchema,
    notionModifyBlocksAppendResultSchema,
    notionModifyBlocksDeleteResultSchema,
    notionModifyBlocksFailureSchema,
    notionModifyBlocksOperationResultSchema,
    notionModifyBlocksSuccessSchema,
    notionModifyBlocksUpdateResultSchema,
    notionPageBlockSchema,
    notionPageParentSchema,
    notionPageQueryMetadataSchema,
    notionQueryDatabaseFailureSchema,
    notionQueryDatabaseSuccessSchema,
    notionReadablePropertyValueSchema,
    notionSchemaPropertySchema,
    notionUserReferenceSchema,
    notionWorkspaceUserSchema,
    posthogEventCountSchema,
    posthogEventSummarySchema,
    posthogLogEntrySchema,
    posthogOffsetPaginationSchema,
    posthogSearchSessionsFoundSchema,
    posthogSearchSessionsNotFoundSchema,
    posthogSearchSessionsPaginationSchema,
    posthogSessionConsoleLogSchema,
    posthogSessionEventSchema,
    posthogSessionEventsSummarySchema,
    posthogSessionSummarySchema,
    slackChannelListItemSchema,
    slackConversationMessageSchema,
    slackUserResponseSchema
} from "./Tools"

export type Role = "admin" | "user"

export type User = {
    id: string
    workosId: string
    organizationId: string
    organizationName: string
    email: string
    displayName: string
    firstName: string | null
    lastName: string | null
    displayPhotoUrl: string
    roles: Role[]
}

export type UserNoOrganization = Omit<User, "organizationId" | "organizationName" | "roles">

export type SubActivity = {
    summary: string
    commits: CommitAssociation[]
}

export type CommitAssociation = {
    sha: string
    message: string
    url: string
}

export type ActivityEvent = {
    event_type: string
    title: string
    github_repository_owner_id: string
    github_repository_name: string
    created_at: Date
    sub_activities: SubActivity[]
}

export type TicketActivityEvent = {
    ticket: Ticket
    event_type: string
    title: string
}

export type ProjectActivityEvent = {
    project: Project
    event_type: string
    title: string
}

export type LinearTeam = z.infer<typeof linearTeamSchema>

export type AttioObject = {
    api_slug: string
    singular_noun: string
    plural_noun: string
}

export type AttioAttribute = {
    api_slug?: string
    title?: string
    type?: string
    is_required?: boolean
    is_unique?: boolean
    [key: string]: unknown
}

export type AttioObjectWithAttributes = AttioObject & {
    attributes?: AttioAttribute[]
}

export type AttioRecordIdentifier = {
    workspace_id?: string
    object_id?: string
    record_id?: string
    [key: string]: unknown
}

export type AttioRecord = {
    id?: AttioRecordIdentifier
    values?: Record<string, unknown>
    web_url?: string
    created_at?: string
    [key: string]: unknown
}

export type LinearWorkspace = {
    id: string
    name: string
}

export type JiraProject = {
    id: string
    key: string
    name: string
}

export type JiraCredentialsValidationResponse = {
    valid: boolean
    projects?: JiraProject[]
    error?: string
}

export type NotionResourceType = "database" | "page"
export type NotionResource = {
    id: string
    title: string
    url: string
    type: NotionResourceType
}

export type NotionResourcesResponse = {
    resources: NotionResource[]
}

export type PosthogProject = {
    id: string
    name: string
    organization_id?: string
}

export type PosthogProjectsResponse = {
    projects: PosthogProject[]
}

export type LaunchDarklyProject = {
    key: string
    name: string
}

export type LaunchDarklyProjectsResponse = {
    projects: LaunchDarklyProject[]
}

export type LaunchDarklyEnvironment = {
    key: string
    name: string
}

export type LaunchDarklyEnvironmentsResponse = {
    environments: LaunchDarklyEnvironment[]
}

export type DatadogIndex = {
    id: string
    name: string
    isEnabled: boolean
    dailyLimit?: number
    retentionDays?: number
}

export type DatadogIndexesResponse = {
    indexes: DatadogIndex[]
}

export type SlackChannel = {
    id: string
    name: string
    isPrivate: boolean
    isArchived: boolean
    isMPIM: boolean
}

export type SlackChannelsResponse = {
    channels: SlackChannel[]
    selectedChannelId: string | null
}

export type SlackUserResponse = z.infer<typeof slackUserResponseSchema>

export type SlackUsersResponse = {
    users: SlackUserResponse[]
}

export const TERSE_AGENT_MESSAGE_EVENT_TYPE = "terse_agent_message" as const

export type TerseAgentMessageMetadata = {
    event_type: typeof TERSE_AGENT_MESSAGE_EVENT_TYPE
    event_payload: {
        run_id: string
        automation_id: string
        organization_id: string
    }
}

/**
 * Slack channel type enum
 */
export enum SlackChannelType {
    CHANNEL = "channel",
    GROUP = "group",
    MPIM = "mpim",
    IM = "im"
}

export type ConfluencePage = {
    id: string
    title: string
    spaceId: string
    spaceName: string
    url: string
    status: string
    version: number
}

export type ConfluencePagesQuery = {
    integrationId: string // Jira integration ID (required)
    spaceId?: string // Space ID (optional, but either spaceId or spaceKey is required)
    spaceKey?: string // Space key (optional, but either spaceId or spaceKey is required)
}

export type ConfluencePagesResponse = {
    pages: ConfluencePage[]
    spaceId: string
    total: number
}

export type ConfluenceResourcesResponse = {
    resources: ConfluencePage[]
    spaceId: string
    total: number
}

export type JiraResourcesResponse = {
    success: boolean
    resources: {
        projects: Array<{
            id: string
            key: string
            name: string
            projectTypeKey: string
        }>
        baseUrl: string
        cloudId: string
    }
}

export type UseConfluenceResourcesReturn<MutateType = any> = {
    resources: ConfluencePage[]
    response: ConfluenceResourcesResponse | undefined
    isLoading: boolean
    isError: boolean
    error: unknown
    isValidating: boolean
    mutate: MutateType
}

// Figma webhook and API types
export enum FigmaEventTypes {
    FILE_COMMENT = "FILE_COMMENT"
}

/**
 * Figma webhook event user object
 */
export interface FigmaWebhookUser {
    id: string
    handle: string
    email: string
    img_url: string
}

/**
 * Figma webhook comment object (from webhook payload)
 */
export interface FigmaWebhookComment {
    id: string
    message: string
    client_meta: FigmaClientMeta
    user: FigmaWebhookUser
    created_at: string
    resolved_at: string | null
}

/**
 * Figma comment image URLs
 * Extracted images for visual context of comments
 */
export interface FigmaCommentImageUrls {
    nodeImage?: string // Image of the specific node the comment is on
    fullFrame?: string // Full frame/page image
}

/**
 * Figma positioning data structures
 * Represents the position and type of a comment in a Figma file
 */
export type FigmaVectorData = {
    x: number
    y: number
}

export type FigmaFrameOffsetData = {
    node_id: string
    node_offset: { x: number; y: number }
}

export type FigmaRegionData = {
    x: number
    y: number
    width: number
    height: number
}

export type FigmaFrameOffsetRegionData = {
    node_id: string
    node_offset: { x: number; y: number }
    x: number
    y: number
    width: number
    height: number
}

export type FigmaPositioningData =
    | { type: "Vector"; data: FigmaVectorData }
    | { type: "FrameOffset"; data: FigmaFrameOffsetData }
    | { type: "Region"; data: FigmaRegionData }
    | { type: "FrameOffsetRegion"; data: FigmaFrameOffsetRegionData }

/**
 * Figma client_meta structure
 * Represents the raw positioning metadata from Figma comment client_meta
 * Can be one of several positioning formats
 */
export type FigmaClientMeta = {
    // Vector: point coordinates
    x: number
    y: number
    // Region: rectangular area
    width: number
    height: number
    // FrameOffset: node with offset
    node_id: string
    node_offset: { x: number; y: number }
}

/**
 * Figma API comment response structure
 */
export interface FigmaApiComment {
    id: string
    message: string
    client_meta: FigmaClientMeta | null
    user: FigmaWebhookUser
    created_at: string
    resolved_at: string | null
    parent_id?: string | null
    order_id?: string
    mentions?: unknown[]
    reactions?: unknown[]
}

export interface FigmaCommentThreadEntry {
    id: string
    message: string
    author: FigmaWebhookUser
    createdAt: string
    resolvedAt: string | null
    parentId: string | null
    orderId?: string
    isRoot?: boolean
}

/**
 * Figma comment event data
 * Processed/enriched comment data used for automation events
 * This combines data from webhook, API, and enriched context
 */
export interface FigmaCommentEventData {
    integrationId: string
    commentId: string
    fileKey: string
    fileUrl: string
    nodeId?: string // Node ID the comment is attached to (if any)
    message: string
    author: FigmaWebhookUser
    createdAt: string
    resolved?: boolean
    thread?: FigmaCommentThreadEntry[]
    // Enriched context (optional - added during processing)
    fileMetadata?: any
    // Positioning and visual context (optional - added during enrichment)
    positioningData?: FigmaPositioningData
    matchedNodeIds?: string[]
    imageUrls?: FigmaCommentImageUrls
}

export type ApiToken = {
    id: string
    name: string
    tokenPrefix: string
    createdAt: string
    lastUsedAt: string | null
}

export type ApiTokenCreateResponse = {
    token: ApiToken
    rawToken: string
}

export type DeviceTokenExchangeResponse = {
    apiKey: string
    user: {
        email: string
        firstName: string | null
        displayName: string | null
    }
}

export type AgentTrigger = {
    id: string
    config: ConfigInstance
}

export type AgentOutput = {
    id: string
    config: ConfigInstance
}

export type AgentPrompt = {
    text: string
}

export type TransientAgentTrigger = {
    id: string
    config?: ConfigInstance
    configType: ConfigType
}

export type TransientAgentOutput = {
    id: string
    config?: ConfigInstance
    configType: ConfigType
}

// Template types - simplified config references without integrationId
export type TemplateConfigRef = {
    configType: ConfigType
    integrationType: IntegrationType
}

export type TemplateTrigger = {
    config: TemplateConfigRef
}

export type TemplateOutput = {
    config: TemplateConfigRef
}

export type TemplateCategory =
    | "ship" // Ship Faster
    | "users" // Understand Users
    | "sync" // Stay in Sync
    | "track" // Track Everything

export type AgentTemplate = {
    id: string
    category: TemplateCategory
    name: string
    description: string
    chatPrompt: string // Short prompt to pre-fill chat input when template is selected
    prompt: AgentPrompt
    triggers: TemplateTrigger[]
    outputs: TemplateOutput[]
    requireApproval: boolean
    isActive: boolean
}

export type Agent = {
    id: string
    name: string
    isActive: boolean
    requireApproval: boolean
    prompt: AgentPrompt
    triggers: AgentTrigger[]
    outputs: AgentOutput[]
    createdByUserId: string
    notificationSettings?: AgentNotificationSettings
    toolApprovals?: string[]
    updatedAt?: string
    source?: "WEB_UI" | "SDK"
}

export type AgentNotificationSettings = {
    enabled: boolean
    actionTypes: RunHistoryActionType[]
}

export type AgentUpdate = {
    name?: string
    triggers?: AgentTrigger[]
    outputs?: AgentOutput[]
    prompt?: AgentPrompt
    isActive?: boolean
    requireApproval?: boolean
    notificationSettings?: AgentNotificationSettings
    toolApprovals?: string[]
}

export type AgentsResponse = {
    agents: Agent[]
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
}

export type RecentAgent = Agent & {
    updatedAt: string
    lastEventProcessedAt: string | null
}

export type AgentImprovementStatus = "PENDING" | "APPLIED" | "DISMISSED"

export type AgentImprovementTargetArea = "prompt" | "trigger_config" | "output_config" | "general" | "code"

export type AgentReview = {
    id: string
    automationId: string
    title: string
    summary: string
    runsAnalyzed: number
    reviewPeriodStart: string
    reviewPeriodEnd: string
    createdAt: string
}

export type AgentImprovement = {
    id: string
    reviewId: string
    automationId: string
    title: string
    description: string
    targetArea: AgentImprovementTargetArea
    confidence: number
    status: AgentImprovementStatus
    suggestedPatch?: string
    appliedPrompt?: string
    appliedAt?: string
    dismissedAt?: string
    createdAt: string
    updatedAt: string
}

export type GetAgentImprovementsResponse = {
    review: AgentReview | null
    improvements: AgentImprovement[]
    improvementsEnabled: boolean
}

export type ApplyImprovementResponse = {
    success: boolean
    appliedPrompt: string
}

export type DismissImprovementResponse = {
    success: boolean
}

export type ToggleImprovementsEnabledResponse = {
    success: boolean
    improvementsEnabled: boolean
}

export type GithubAppInstallationCallbackRequest = {
    name: string
    email: string
    username: string
    installationId: number
    accountName: string | null
    repositories: Repository[]
}

export type Repository = {
    name: string
    owner: string
    id: number // This is the official id from github! Not to be confused with the id from github_repositories table in the DB!!!
}

export type GetGithubRepositoriesForIntegrationRequest = {}

export type GetGithubRepositoriesForIntegrationResponse = {
    repositories: Repository[]
}

export type OAuthInstallationDetails = {
    oauthUrl: string
}

// ─── Integration field definitions ───────────────────────────────────────────

export type FormFieldType = "text" | "password" | "textarea"

export interface FormFieldDefinition {
    name: string
    type: FormFieldType
    label: string
    placeholder?: string
    required?: boolean
    hint?: string
}

export type ConfigurationFieldType = "radio" | "select"

export interface ConfigurationOption {
    label: string
    value: string
}

export interface ConfigurationFieldDefinition {
    name: string
    type: ConfigurationFieldType
    label: string
    options: ConfigurationOption[]
    required?: boolean
    hint?: string
}

export interface IntegrationFieldsResponse {
    installationType: "form" | "oauth"
    fields: FormFieldDefinition[] | ConfigurationFieldDefinition[]
}

export type StatsInterval = "1h" | "24h" | "7d" | "1mo" | "3mo" | "1y"

export interface DailyEventCount {
    date: string
    events: number
}

export interface RecentAction {
    action: string
    integration: IntegrationType // IntegrationType as string
    target: string
    details: string
    url?: string
    timestamp: string // ISO date string
    agentName: string
    type: RunHistoryActionType
}

export interface AgentActivityItem {
    agentId: string
    agentName: string
    runCount: number
}

export interface CountByString {
    label: string
    count: number
}

export interface StatsResponse {
    totalEventsProcessed: number
    totalEventsProcessedChange: string // Percentage change from previous period
    actionsTaken: number
    actionsTakenChange: string // Percentage change from previous period
    numberOfAgents: number
    numberOfAgentsChange: string // Absolute change (e.g., "+2")
    dailyEvents: DailyEventCount[] // Events per day for the selected period
    recentActions: RecentAction[] // Recent actions (last 10)
    recentRuns: RunHistoryRecordWithAgent[] // Recent non-filtered run history records (last 20)
    timezone: string // Timezone used for daily events grouping (e.g., "America/New_York" or "UTC")
    // Insight data
    agentActivity: AgentActivityItem[] // Top 10 agents by run count (current period)
    statusBreakdown: CountByString[] // Run counts grouped by status (current period)
    triggerIntegrations: CountByString[] // Run counts grouped by trigger integration (current period)
    actionIntegrations: CountByString[] // Action counts grouped by integration (current period, write-only)
    actionTypes: CountByString[] // Action counts grouped by type (current period, write-only)
}

export interface TriggerPayload {
    integrationId: string
    integrationType: IntegrationType
    config: Record<string, unknown>
}

export interface SerializedEvent {
    integrationType: IntegrationType
    eventType?: string
    formattedContent: string
    debugLog: string
    metadata?: Record<string, unknown>
}

export type SdkAgentRunEventPayload = {
    integrationType: IntegrationType
    formattedContent: string
    debugLog: string
}

export type SdkAgentSkillPayload = {
    configType: ConfigType
    config: Record<string, unknown>
}

export type SdkAgentRunOptionsPayload = {
    maxTurns?: number
    requireApproval?: boolean
}

export type SdkAgentRunRequestBody = {
    prompt?: string
    event?: Partial<SdkAgentRunEventPayload>
    skills?: SdkAgentSkillPayload[]
    options?: SdkAgentRunOptionsPayload
    toolApprovals?: string[]
}

export type SdkAgentRunResponseBody = {
    success: boolean
    error?: string
    details?: string[]
    contract?: {
        responseMode: "streaming"
        supportsInterruptions: boolean
    }
    normalizedRequest?: {
        prompt: string
        event: SdkAgentRunEventPayload
        skills: SdkAgentSkillPayload[]
        toolApprovals: string[]
        options: {
            maxTurns: number
            requireApproval: boolean
        }
    }
}

export type SdkAgentStreamEvent =
    | { type: "run_started"; runId: string }
    | { type: "text"; text: string }
    | { type: "final_output"; finalOutput: string }
    | { type: "tool_call_params"; toolCallParams: string }
    | { type: "tool_call_started"; toolCallStarted: string }
    | { type: "tool_call_completed"; toolCallCompleted: string }
    | {
          type: "tool_approval_requested"
          toolApprovalRequested: {
              stepId: string
              toolName: string
              arguments: string
          }
      }
    | { type: "action"; action: RunHistoryAction }
    | { type: "error"; message: string }
    | { type: "done" }

export type SdkApprovalDecisionRequestBody = {
    runId: string
    stepId: string
    approved: boolean
}

export type SdkDeployJob = {
    jobName: string
    triggers: AgentTrigger[]
    outputs: AgentOutput[]
    toolApprovals: string[]
    webhookURL?: string
}

export type SdkDeployRequestBody = {
    jobs: SdkDeployJob[]
    sourceZipBase64: string
}

export type SdkDeployResponseBody = {
    success: boolean
    results: { jobName: string; automationId: string; isUpdate: boolean }[]
    removed: { id: string; name: string }[]
    error?: string
    details?: string
}

export type AttioUpsertError = {
    index: number
    message: string
}

export type SlackChannelListItem = z.infer<typeof slackChannelListItemSchema>

export type SlackConversationMessage = z.infer<typeof slackConversationMessageSchema>

export type GitHubPagination = z.infer<typeof gitHubPaginationSchema>
export type GitHubCodeSearchResult = z.infer<typeof gitHubCodeSearchResultSchema>
export type GitHubCodeGrepResult = z.infer<typeof gitHubCodeGrepResultSchema>
export type GitHubPullRequestSummary = z.infer<typeof gitHubPullRequestSummarySchema>
export type GitHubDirectoryEntry = z.infer<typeof gitHubDirectoryEntrySchema>
export type GitHubFileEntry = z.infer<typeof gitHubFileEntrySchema>
export type GitHubOtherEntry = z.infer<typeof gitHubOtherEntrySchema>
export type GitHubCommitSummary = z.infer<typeof gitHubCommitSummarySchema>
export type GitHubPullRequestRef = z.infer<typeof gitHubPullRequestRefSchema>

export type SnowflakeQueryRow = Record<string, unknown>

export type LinearIssueAssignee = z.infer<typeof linearIssueAssigneeSchema>
export type LinearIssueTeam = z.infer<typeof linearIssueTeamSchema>
export type LinearIssueProject = z.infer<typeof linearIssueProjectSchema>
export type LinearIssueSummary = z.infer<typeof linearIssueSummarySchema>
export type LinearIssueDetail = z.infer<typeof linearIssueDetailSchema>
export type LinearIssueHandle = z.infer<typeof linearIssueHandleSchema>
export type LinearCommentHandle = z.infer<typeof linearCommentHandleSchema>
export type LinearStateSummary = z.infer<typeof linearStateSummarySchema>
export type LinearLabelSummary = z.infer<typeof linearLabelSummarySchema>
export type LinearProjectSummary = z.infer<typeof linearProjectSummarySchema>
export type LinearUserSummary = z.infer<typeof linearUserSummarySchema>
export type LinearSearchPagination = z.infer<typeof linearSearchPaginationSchema>

export type JiraIssueState = z.infer<typeof jiraIssueStateSchema>
export type JiraIssueAssignee = z.infer<typeof jiraIssueAssigneeSchema>
export type JiraIssueProjectRef = z.infer<typeof jiraIssueProjectRefSchema>
export type JiraIssueTypeRef = z.infer<typeof jiraIssueTypeRefSchema>
export type JiraRichDescription = z.infer<typeof jiraRichDescriptionSchema>
export type JiraIssueSummary = z.infer<typeof jiraIssueSummarySchema>

export type GmailSendSummary = z.infer<typeof gmailSendSummarySchema>

export type GmailDraftSummary = z.infer<typeof gmailDraftSummarySchema>

export type NotionUserReference = z.infer<typeof notionUserReferenceSchema>

export type NotionFileReference = z.infer<typeof notionFileReferenceSchema>

export type NotionDateReference = z.infer<typeof notionDateReferenceSchema>

export type NotionReadablePropertyValue = z.infer<typeof notionReadablePropertyValueSchema>

export type NotionPageBlock = z.infer<typeof notionPageBlockSchema>

export type NotionPageParent = z.infer<typeof notionPageParentSchema>

export type NotionPageQueryMetadata = z.infer<typeof notionPageQueryMetadataSchema>

export type NotionDatabaseRowMutationResult = z.infer<typeof notionDatabaseRowMutationResultSchema>

export type NotionSchemaProperty = z.infer<typeof notionSchemaPropertySchema>

export type NotionDatabaseQueryPage = z.infer<typeof notionDatabaseQueryPageSchema>

export type NotionQueryDatabaseFailure = z.infer<typeof notionQueryDatabaseFailureSchema>

export type NotionQueryDatabaseSuccess = z.infer<typeof notionQueryDatabaseSuccessSchema>

export type NotionModifyBlocksAppendResult = z.infer<typeof notionModifyBlocksAppendResultSchema>

export type NotionModifyBlocksUpdateResult = z.infer<typeof notionModifyBlocksUpdateResultSchema>

export type NotionModifyBlocksDeleteResult = z.infer<typeof notionModifyBlocksDeleteResultSchema>

export type NotionModifyBlocksOperationResult = z.infer<typeof notionModifyBlocksOperationResultSchema>

export type NotionModifyBlocksSuccess = z.infer<typeof notionModifyBlocksSuccessSchema>

export type NotionModifyBlocksFailure = z.infer<typeof notionModifyBlocksFailureSchema>

export type NotionWorkspaceUser = z.infer<typeof notionWorkspaceUserSchema>

export type ConfluencePageSpace = z.infer<typeof confluencePageSpaceSchema>

export type ConfluencePageVersionAuthor = z.infer<typeof confluencePageVersionAuthorSchema>

export type ConfluencePageVersion = z.infer<typeof confluencePageVersionSchema>

export type ConfluenceBodyRepresentation = z.infer<typeof confluenceBodyRepresentationSchema>

export type ConfluenceBodyContent = z.infer<typeof confluenceBodyContentSchema>

export type ConfluencePageRelation = z.infer<typeof confluencePageRelationSchema>

export type ConfluencePageQueryResult = z.infer<typeof confluencePageQueryResultSchema>

export type ConfluenceCommentPosition = z.infer<typeof confluenceCommentPositionSchema>

export type PosthogSessionSummary = z.infer<typeof posthogSessionSummarySchema>

export type PosthogSearchSessionsPagination = z.infer<typeof posthogSearchSessionsPaginationSchema>

export type PosthogSearchSessionsFound = z.infer<typeof posthogSearchSessionsFoundSchema>

export type PosthogSearchSessionsNotFound = z.infer<typeof posthogSearchSessionsNotFoundSchema>

export type PosthogLogEntry = z.infer<typeof posthogLogEntrySchema>

export type PosthogOffsetPagination = z.infer<typeof posthogOffsetPaginationSchema>

export type PosthogEventCount = z.infer<typeof posthogEventCountSchema>

export type PosthogEventSummary = z.infer<typeof posthogEventSummarySchema>

export type PosthogSessionEvent = z.infer<typeof posthogSessionEventSchema>

export type PosthogSessionConsoleLog = z.infer<typeof posthogSessionConsoleLogSchema>

export type PosthogSessionEventsSummary = z.infer<typeof posthogSessionEventsSummarySchema>

export type LaunchDarklyFlagSummary = {
    key: string
    name: string
    description: string
    environments: Record<string, boolean>
    url: string
    environmentUrls: Record<string, string>
}

export type LaunchDarklyFlagMetadata = {
    key: string
    name: string
    description: string
    kind: string
    variations: Record<string, unknown>[]
    tags: string[]
    maintainerId: string | null
}

export type LaunchDarklyEnvironmentConfig = {
    on: boolean
    targets: Record<string, unknown>[]
    contextTargets: Record<string, unknown>[]
    rules: Record<string, unknown>[]
    fallthrough: Record<string, unknown> | null
    offVariation: number | null
    prerequisites: Record<string, unknown>[]
}

export type LaunchDarklyHistoryEntry = {
    id: string
    timestamp: string
    kind: string
    key: string
    name: string
    description: string
    member: Record<string, unknown> | null
    changes: Record<string, unknown>[]
}

export type LaunchDarklyHistoryResult = {
    entries: LaunchDarklyHistoryEntry[]
    totalEntries: number
    url: string
}

export type DatadogLogEntry = {
    id: string
    timestamp?: string
    message?: string
    host?: string
    service?: string
    status?: string
    tags: string[]
    customAttributes: Record<string, unknown>
}

export type DatadogCursorPagination = {
    limit: number
    cursor?: string | null
    nextCursor: string | null
    hasMore: boolean
    showing: string
}

export type DatadogRumSessionDetails = {
    id?: string
    type?: string
    hasReplay?: boolean
    duration?: number
}

export type DatadogRumViewDetails = {
    id?: string
    name?: string
    url?: string
    loadTime?: number
    timeSpent?: number
}

export type DatadogRumActionDetails = {
    id?: string
    type?: string
    target?: string
    loadingTime?: number
}

export type DatadogRumErrorDetails = {
    id?: string
    message?: string
    source?: string
    stack?: string
    type?: string
}

export type DatadogRumResourceDetails = {
    id?: string
    type?: string
    url?: string
    method?: string
    statusCode?: number
    duration?: number
}

export type DatadogRumLongTaskDetails = {
    id?: string
    duration?: number
}

export type DatadogRumEvent = {
    id: string
    type: string
    timestamp?: string
    session?: DatadogRumSessionDetails
    view?: DatadogRumViewDetails | Record<string, unknown>
    action?: DatadogRumActionDetails
    error?: DatadogRumErrorDetails
    resource?: DatadogRumResourceDetails
    longTask?: DatadogRumLongTaskDetails
    service?: string
    version?: string
    environment?: string
    device?: Record<string, unknown>
    os?: Record<string, unknown>
    browser?: Record<string, unknown>
    user?: Record<string, unknown>
    tags: string[]
    customAttributes: Record<string, unknown>
}

export type DatadogAggregationBucketCompute = {
    value: unknown
    aggregation: string
    metric: string
}

export type DatadogAggregationBucket = {
    by: Record<string, unknown>
    computes: Record<string, DatadogAggregationBucketCompute>
}

export type DatadogAggregationMeta = {
    elapsed?: number
    requestId?: string
    status?: unknown
}

export type WorkOSUserSummary = {
    id: string
    email: string
    emailVerified: boolean
    firstName?: string | null
    lastName?: string | null
    profilePictureUrl?: string | null
    createdAt: string
    updatedAt: string
}

export type WorkOSOrganizationSummary = {
    id: string
    name: string
    externalId?: string | null
    domains: string[]
    createdAt: string
    updatedAt: string
}

export type WorkOSPagination = {
    hasMore: boolean
    after?: string | null
}

export type WebSearchResultItem = {
    title: string
    url: string
    content: string
    score: number
}

export type WebSearchOutput = {
    query: string
    answer: string | undefined
    results: WebSearchResultItem[]
}

export type WebExtractResultItem = {
    url: string
    raw_content: string
}

export type WebExtractOutput = {
    results: WebExtractResultItem[]
    failed_results: unknown
}

export type WebResearchSource = {
    title: string
    url: string
}

export type WebResearchOutput = ToolOutputBase & {
    status: "completed"
    request_id: string
    content: string | undefined
    sources: WebResearchSource[] | undefined
}

export type ImageEditSnippet = {
    type: "image"
    url: string
}

export type ImageEditOutput = ToolOutputBase & {
    url: string
    image_url: string
    summary: string
    snippets: ImageEditSnippet[]
}

type LegacyToolOutputByName = {
    searchDatadogLogs: ToolOutputBase & {
        query: string | null
        indexes: string[]
        totalLogs: number
        logs: DatadogLogEntry[]
        logsLink: string
        pagination: DatadogCursorPagination
        warnings: string | null
        message: string
    }
    searchRumEvents: ToolOutputBase & {
        query: string | null
        totalEvents: number
        events: DatadogRumEvent[]
        eventsByType: Record<string, number>
        rumLink: string
        pagination: DatadogCursorPagination
        warnings: string | null
        message: string
    }
    listRumEvents: ToolOutputBase & {
        query: string | null
        totalEvents: number
        events: DatadogRumEvent[]
        eventsByType: Record<string, number>
        rumLink: string
        pagination: DatadogCursorPagination
        warnings: string | null
        message: string
    }
    aggregateRumEvents: ToolOutputBase & {
        query: string | null
        from: string
        to: string | null
        compute: string
        groupBy: string
        totalBuckets: number
        buckets: DatadogAggregationBucket[]
        rumLink: string
        pagination: Omit<DatadogCursorPagination, "cursor">
        warnings: string | null
        meta: DatadogAggregationMeta
        message: string
    }
    web_search: WebSearchOutput
    web_extract: WebExtractOutput
    web_research: WebResearchOutput
    image_edit: ImageEditOutput
}

export type ToolOutputByName = DefinedToolOutputByName & LegacyToolOutputByName
