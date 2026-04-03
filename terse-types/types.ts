import * as z from "zod"

import { ConfigInstance, ConfigType } from "./Configs"
import { IntegrationType } from "./Integrations"
import { RunHistoryAction, RunHistoryActionType, RunHistoryRecordWithAgent, runHistoryActionBaseSchema } from "./RunHistoryTypes"
import { Project, Ticket } from "./TicketSystem"

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

export type LinearTeam = {
    id: string
    name: string
    key: string
}

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

export type SlackUserResponse = {
    id: string
    name: string
}

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

export const toolOutputBaseSchema = z.object({
    success: z.boolean(),
    actions: z.array(runHistoryActionBaseSchema).optional()
})
export const toolOutputSuccessSchema = toolOutputBaseSchema.extend({
    success: z.literal(true)
})
export const toolOutputFailureSchema = toolOutputBaseSchema.extend({
    success: z.literal(false)
})

export type ToolOutputBase = z.infer<typeof toolOutputBaseSchema>

export type ToolOutputSuccessBase = z.infer<typeof toolOutputSuccessSchema>

export type ToolOutputFailureBase = z.infer<typeof toolOutputFailureSchema>

export type AttioUpsertError = {
    index: number
    message: string
}

export type SlackChannelListItem = {
    id?: string
    name: string
    isPrivate: boolean
    isIm: boolean
    isMpim: boolean
}

export type SlackConversationMessage = {
    userId?: string
    userName?: string
    text: string
    timestamp?: string
    threadTs?: string
}

export type GitHubPagination = {
    page: number
    perPage: number
    hasMore: boolean
}

export type GitHubCodeSearchResult = {
    index: number
    repository: string
    path: string
    url: string
    snippets: string
}

export type GitHubCodeGrepResult = {
    index: number
    repository: string
    file: string
    url: string
    matches: string
}

export type GitHubPullRequestSummary = {
    number: number
    title: string
    description: string
    author: string
    state: string
    merged: boolean
    mergedAt?: string
    createdAt: string
    closedAt?: string
    labels: string[]
    baseBranch: string
    headBranch: string
    url: string
}

export type GitHubDirectoryEntry = {
    name?: string
    path?: string
    type?: "directory"
}

export type GitHubFileEntry = {
    name?: string
    path: string
    type?: "file"
    size?: number
}

export type GitHubOtherEntry = {
    name: string
    type: string
}

export type GitHubCommitSummary = {
    sha: string
    fullSha: string
    message: string
    fullMessage: string
    author: string
    date: string
    url: string
}

export type GitHubPullRequestRef = {
    number: number
    title: string
    state: string
    merged: boolean
    baseBranch: string
    headBranch: string
    url: string
}

export type SnowflakeQueryRow = Record<string, unknown>

export type LinearIssueAssignee = {
    id: string
    name: string
    email?: string
}

export type LinearIssueTeam = {
    id: string
    name: string
    key: string
}

export type LinearIssueProject = {
    id: string
    name: string
}

export type LinearIssueSummary = {
    id: string
    identifier: string
    title: string
    description?: string | null
    state: string
    priority?: number | null
    assignee: LinearIssueAssignee | null
    url: string
    createdAt: string | Date
    updatedAt: string | Date
}

export type LinearIssueDetail = LinearIssueSummary & {
    team: LinearIssueTeam | null
    project: LinearIssueProject | null
    dueDate?: string | Date
    estimate?: number | null
}

export type LinearIssueHandle = {
    id: string
    identifier: string
    title: string
    description?: string | null
    url: string
    createdAt?: string | Date
    updatedAt?: string | Date
}

export type LinearCommentHandle = {
    id: string
    body?: string
    createdAt?: string | Date
    updatedAt?: string | Date
}

export type LinearStateSummary = {
    id: string
    name: string
    type: string
    color: string
    teamId: string
}

export type LinearLabelSummary = {
    id: string
    name: string
    color: string
    teamId: string
}

export type LinearProjectSummary = {
    id: string
    name: string
    description?: string
    teamId: string
}

export type LinearUserSummary = {
    id: string
    name: string
    email: string
    avatarUrl?: string
}

export type LinearSearchPagination = {
    hasNextPage: boolean
    endCursor: string | null
    limit: number | null
}

export type JiraIssueState = {
    id: string
    name: string
}

export type JiraIssueAssignee = {
    id: string
    name: string
    email?: string
}

export type JiraIssueProjectRef = {
    id: string
    name: string
    key: string
}

export type JiraIssueTypeRef = {
    id: string
    name: string
}

export type JiraRichDescription = string | Record<string, unknown>

export type JiraIssueSummary = {
    id?: string
    key: string
    identifier: string
    title?: string
    description?: JiraRichDescription
    state?: JiraIssueState
    priority?: number
    assignee?: JiraIssueAssignee | null
    labels?: string[]
    dueDate?: string
    project?: JiraIssueProjectRef
    issueType?: JiraIssueTypeRef
    url?: string
    createdAt?: string
    updatedAt?: string
}

export type GmailSendSummary = {
    message_id: string
    thread_id: string
    to: string
    subject: string
    summary: string
    is_reply: boolean
}

export type GmailDraftSummary = {
    draft_id: string
    message_id: string
    thread_id: string
    draft_url: string
    to: string
    subject: string
    summary: string
    is_reply: boolean
}

export type NotionUserReference = {
    id: string
    name?: string
    object?: string
}

export type NotionFileReference = {
    name: string
    type: string
    file?: string
    external?: string
}

export type NotionDateReference = {
    start?: string
    end?: string | null
    time_zone?: string | null
}

export type NotionReadablePropertyValue =
    | string
    | number
    | boolean
    | null
    | string[]
    | NotionDateReference
    | NotionUserReference
    | NotionUserReference[]
    | NotionFileReference[]
    | Record<string, unknown>

export type NotionPageBlock = {
    id: string
    type: string
    object: string
    created_time?: string
    last_edited_time?: string
    created_by?: NotionUserReference
    last_edited_by?: NotionUserReference
    has_children?: boolean
    archived?: boolean
    content?: string
    rich_text?: Record<string, unknown>[]
    checked?: boolean
    language?: string
    icon?: Record<string, unknown>
    table_width?: number
    has_column_header?: boolean
    has_row_header?: boolean
    caption?: string
    file?: string
    external?: string
    url?: string
    page_id?: string
    database_id?: string
    children?: NotionPageBlock[]
}

export type NotionPageParent = Record<string, unknown>

export type NotionPageQueryMetadata = {
    page_id: string
    object: string
    url?: string
    public_url?: string | null
    created_time?: string
    last_edited_time?: string
    archived?: boolean
    icon?: Record<string, unknown> | null
    cover?: Record<string, unknown> | null
    parent?: NotionPageParent
    created_by?: NotionUserReference
    last_edited_by?: NotionUserReference
    in_trash?: boolean
}

export type NotionDatabaseRowMutationResult = ToolOutputSuccessBase & {
    action: "created" | "updated"
    page_id: string
    url?: string
}

export type NotionSchemaProperty = {
    type: string
    id: string
    options?: string[]
    format_example?: string
}

export type NotionDatabaseQueryPage = {
    page_id: string
    properties: Record<string, NotionReadablePropertyValue>
    url?: string
    created_time?: string
    last_edited_time?: string
}

export type NotionQueryDatabaseFailure = ToolOutputFailureBase & {
    pages: []
    total_returned: 0
    has_more: false
    next_cursor: null
    error: string
    hint: string
}

export type NotionQueryDatabaseSuccess = ToolOutputSuccessBase & {
    pages: NotionDatabaseQueryPage[]
    total_returned: number
    has_more: boolean
    next_cursor: string | null
}

export type NotionModifyBlocksAppendResult = {
    operation: "append"
    actions: RunHistoryAction[]
    block_ids: string[]
    blocks_count: number
}

export type NotionModifyBlocksUpdateResult = {
    operation: "update"
    actions: RunHistoryAction[]
    block_id: string
}

export type NotionModifyBlocksDeleteResult = {
    operation: "delete"
    actions: RunHistoryAction[]
    block_id: string
}

export type NotionModifyBlocksOperationResult = NotionModifyBlocksAppendResult | NotionModifyBlocksUpdateResult | NotionModifyBlocksDeleteResult

export type NotionModifyBlocksSuccess =
    | (ToolOutputSuccessBase & {
          operation: "append"
          block_ids: string[]
          blocks_count: number
      })
    | (ToolOutputSuccessBase & {
          operation: "update" | "delete"
          block_id: string
      })
    | (ToolOutputSuccessBase & {
          operations: NotionModifyBlocksOperationResult[]
          block_ids: string[]
          total_operations: number
      })

export type NotionModifyBlocksFailure = ToolOutputFailureBase & {
    error: string
    block_ids: string[]
    operations?: NotionModifyBlocksOperationResult[]
    failed_at_index?: number
    total_operations?: number
    hint?: string
    retry_instructions?: string
}

export type NotionWorkspaceUser = {
    id: string
    name: string
    email?: string
}

export type ConfluencePageSpace = {
    id: string | number
    key: string
    name: string
    type: string
}

export type ConfluencePageVersionAuthor = {
    type: string
    username?: string
    userKey?: string
    accountId?: string
    displayName?: string
}

export type ConfluencePageVersion = {
    number: number
    when: string
    message?: string
    by?: ConfluencePageVersionAuthor
}

export type ConfluenceBodyRepresentation = {
    value: string
    representation: string
}

export type ConfluenceBodyContent = {
    storage?: ConfluenceBodyRepresentation
    view?: ConfluenceBodyRepresentation
    export_view?: ConfluenceBodyRepresentation
}

export type ConfluencePageRelation = {
    id: string
    title: string
    type: string
}

export type ConfluencePageQueryResult = {
    page_id: string
    title: string
    type: string
    status: string
    space?: ConfluencePageSpace
    version?: ConfluencePageVersion
    created_date?: string
    last_modified?: string
    url?: string
    body: ConfluenceBodyContent
    body_text: string
    ancestors: ConfluencePageRelation[]
    descendants: ConfluencePageRelation[]
    ancestors_count: number
    descendants_count: number
}

export type ConfluenceCommentPosition = {
    start: number
    end: number
}

export type PosthogSessionSummary = {
    id: string
    startTime?: string
    endTime?: string
    duration?: number
    eventsCount: number
    sessionUrl: string
    personId: string
    distinctId: string
}

export type PosthogSearchSessionsPagination = {
    limit: number
    offset: number
    hasNext: boolean
    hasPrevious: boolean
    nextOffset: number | null
    previousOffset: number | null
}

export type PosthogSearchSessionsFound = ToolOutputBase & {
    userEmail: string
    projectId: string
    personFound: true
    personId: string
    distinctId: string
    totalSessions: number
    sessions: PosthogSessionSummary[]
    sessionsLink: string
    pagination: PosthogSearchSessionsPagination
    message: string
}

export type PosthogSearchSessionsNotFound = ToolOutputBase & {
    userEmail: string
    projectId: string
    personFound: false
    sessions: []
    totalSessions: 0
    message: string
}

export type PosthogLogEntry = {
    id: string
    timestamp?: string
    level: string
    message: string
    service: string
    attributes: Record<string, unknown>
}

export type PosthogOffsetPagination = {
    limit: number
    offset: number
    hasMore: boolean
    nextOffset: number | null
    showing: string
}

export type PosthogEventCount = {
    eventName: string
    count: number
}

export type PosthogEventSummary = {
    id: string
    event: string
    timestamp?: string
    distinctId?: string
    url?: string
}

export type PosthogSessionEvent = {
    type: "click" | "input" | "scroll" | "console" | "network_error" | "navigation" | "custom" | "page_load" | "viewport_resize"
    timestamp: number
    relativeTime: number
    data: Record<string, unknown>
}

export type PosthogSessionConsoleLog = {
    timestamp: string
    level: string
    message: string
}

export type PosthogSessionEventsSummary = {
    totalRawEvents: number
    meaningfulEventsReturned: number
    consoleLogsReturned: number
}

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

export type ToolOutputByName = {
    attio_list_objects: ToolOutputBase & {
        objects: AttioObjectWithAttributes[]
        count: number
    }
    attio_query_records: ToolOutputBase & {
        records: AttioRecord[]
        count: number
    }
    attio_upsert_record: ToolOutputBase & {
        records?: AttioRecord[]
        count?: number
        requestedCount?: number
        successCount?: number
        failureCount?: number
        partial?: boolean
        errors?: AttioUpsertError[]
    }
    slack_send_message: ToolOutputBase & {
        message_ts: string | undefined
        channel: string
        thread_ts: string | undefined
        summary: string
        has_blocks: boolean
    }
    slack_list_channels: ToolOutputBase & {
        channels: SlackChannelListItem[]
        count: number
        nextCursor: string | null
        hasMore: boolean
    }
    slack_list_users: ToolOutputBase & {
        users: SlackUserResponse[]
        count: number
    }
    slack_read_conversation: ToolOutputBase & {
        channelId: string
        channelName?: string
        messages: SlackConversationMessage[]
        count: number
        hasMore: boolean
        nextCursor: string | null
    }
    searchGitHubCode: ToolOutputBase & {
        totalCount: number
        resultsReturned: number
        query: string
        repositories: string[]
        pagination: GitHubPagination
        results: GitHubCodeSearchResult[]
        message: string
        tip: string
    }
    readGitHubFile: ToolOutputBase & {
        repository: string
        path: string
        url: string
        totalLines: number
        displayedLines: string
        size: number
        content: string
        warning?: string
    }
    listGitHubPullRequests: ToolOutputBase & {
        repository: string
        timeWindow: string
        summary: { total: number; merged: number; open: number; closed: number }
        pagination: GitHubPagination
        pullRequests: GitHubPullRequestSummary[]
        message: string
    }
    listGitHubDirectory: ToolOutputBase & {
        repository: string
        path: string
        recursive: boolean
        totalItems: number
        directories: Array<GitHubDirectoryEntry | string>
        files: GitHubFileEntry[]
        warning?: string
        tip?: string
        truncated?: boolean
        other?: GitHubOtherEntry[]
    }
    listGitHubCommits: ToolOutputBase & {
        repository: string
        timeWindow: string
        filters: string
        summary: { total: number; byAuthor: Record<string, number> }
        commits: GitHubCommitSummary[]
        message: string
        tip: string
    }
    grepGitHubCode: ToolOutputBase & {
        totalCount: number
        resultsReturned: number
        pattern: string
        query: string
        repositories: string[]
        pagination: GitHubPagination
        results: GitHubCodeGrepResult[]
        message: string
        tip: string
    }
    summarizeGitHubPullRequestDiff: ToolOutputBase & {
        repository: string
        pullRequest: GitHubPullRequestRef
        summary: Record<string, unknown>
        pagination: GitHubPagination
        analysis: string
        message: string
    }
    snowflakeExecuteQuery: ToolOutputBase & {
        rows: SnowflakeQueryRow[]
        columns: string[]
        rowCount: number
    }
    snowflakeExplainQuery: ToolOutputBase & {
        explainPlan: SnowflakeQueryRow[]
        columns: string[]
        rowCount: number
    }
    linear_create_ticket: ToolOutputBase & {
        issue: LinearIssueHandle
    }
    linear_update_ticket: ToolOutputBase & {
        issue: LinearIssueHandle
    }
    linear_add_comment: ToolOutputBase & {
        comment: LinearCommentHandle
    }
    linear_search_ticket: ToolOutputBase & {
        issues: LinearIssueSummary[]
        count: number
        query: string
        pagination: LinearSearchPagination
    }
    linear_read_ticket: ToolOutputBase & {
        issue: LinearIssueDetail
        comments?: Array<{
            id: string
            body: string
            authorId: string
            createdAt: string
        }>
    }
    linear_get_states: ToolOutputBase & {
        states: LinearStateSummary[]
    }
    linear_get_labels: ToolOutputBase & {
        labels: LinearLabelSummary[]
    }
    linear_get_projects: ToolOutputBase & {
        projects: LinearProjectSummary[]
    }
    linear_get_teams: ToolOutputBase & {
        teams: LinearTeam[]
    }
    linear_get_users: ToolOutputBase & {
        users: LinearUserSummary[]
    }
    jira_create_ticket: ToolOutputBase & {
        issue: JiraIssueSummary
    }
    jira_update_ticket: ToolOutputBase & {
        issue: JiraIssueSummary
        updatedFields: string[]
    }
    jira_search_ticket: ToolOutputBase & {
        issues: JiraIssueSummary[]
        count: number
        total: number
        maxResults: number
        isLast: boolean
        nextPageToken?: string
        jql: string
    }
    notion_create_or_update_page: NotionDatabaseRowMutationResult
    notion_create_or_update_database_row: NotionDatabaseRowMutationResult
    notion_modify_blocks: NotionModifyBlocksSuccess | NotionModifyBlocksFailure
    notion_query_page: ToolOutputBase &
        NotionPageQueryMetadata & {
            properties: Record<string, NotionReadablePropertyValue>
            properties_raw?: Record<string, unknown>
            blocks: NotionPageBlock[]
            blocks_count: number
        }
    notion_query_database: NotionQueryDatabaseSuccess | NotionQueryDatabaseFailure
    notion_get_schema: ToolOutputBase & {
        data_source_id: string
        database_name: string
        schema: Record<string, NotionSchemaProperty>
        property_count: number
    }
    notion_fetch_related_events: ToolOutputBase & {
        events_count: number
        events?: string
        message: string
    }
    notion_list_users: ToolOutputBase & {
        users: NotionWorkspaceUser[]
        count: number
    }
    gmail_send_email: ToolOutputBase & GmailSendSummary
    gmail_create_draft: ToolOutputBase & GmailDraftSummary
    confluence_query_page: ToolOutputBase & ConfluencePageQueryResult
    confluence_add_comment: ToolOutputBase & {
        comment_id: string
        comment_text: string
        position: ConfluenceCommentPosition
        text_commented_on?: string
        message: string
    }
    searchPosthogSessions: PosthogSearchSessionsFound | PosthogSearchSessionsNotFound
    searchPosthogLogs: ToolOutputBase & {
        userEmail: string | null
        severityLevels: Array<"error" | "warn" | "info" | "debug"> | null
        messageSearch: string | null
        projectId: string
        totalLogs: number
        logs: PosthogLogEntry[]
        logsLink: string
        pagination: PosthogOffsetPagination
        message: string
    }
    getPosthogSessionEvents: ToolOutputBase & {
        sessionId: string
        sessionUrl: string
        startTime: string
        duration?: number
        timeWindow: {
            startSeconds: number
            endSeconds: number | null
        }
        summary: PosthogSessionEventsSummary
        events: PosthogSessionEvent[]
        consoleLogs: PosthogSessionConsoleLog[]
        message: string
    }
    searchPosthogEvents:
        | (ToolOutputBase & {
              countByEventNameOnly: true
              customEventsOnly: boolean
              eventCounts: PosthogEventCount[]
              totalEventTypes: number
              eventsLink: string
              message: string
          })
        | (ToolOutputBase & {
              userEmail: string | null
              eventName: string | null
              projectId: string
              totalEvents: number
              events: PosthogEventSummary[]
              eventsLink: string
              pagination: PosthogOffsetPagination
              message: string
          })
    listLaunchDarklyFlags: ToolOutputBase & {
        projectKey: string
        totalFlags: number
        flags: LaunchDarklyFlagSummary[]
        flagsLink: string
        message: string
    }
    getLaunchDarklyFlagDetails: ToolOutputBase & {
        projectKey: string
        flag: LaunchDarklyFlagMetadata
        environments: Record<string, LaunchDarklyEnvironmentConfig>
        url: string
        history?: LaunchDarklyHistoryResult
        message: string
    }
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
    listWorkOSUsers: ToolOutputBase & {
        users: WorkOSUserSummary[]
        pagination: WorkOSPagination
        message: string
    }
    listWorkOSOrganizations: ToolOutputBase & {
        organizations: WorkOSOrganizationSummary[]
        pagination: WorkOSPagination
        message: string
    }
    getWorkOSUser: ToolOutputBase & {
        user: WorkOSUserSummary
        message: string
    }
    web_search: WebSearchOutput
    web_extract: WebExtractOutput
    web_research: WebResearchOutput
    image_edit: ImageEditOutput
}
