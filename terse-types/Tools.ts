import { z } from "zod"

import { runHistoryActionBaseSchema } from "./RunHistoryTypes"
import { LinearStateName } from "./TicketSystem"

type AnySchema = z.ZodTypeAny

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

export function defineTool<const TName extends string, TInput extends AnySchema, TOutput extends AnySchema>(def: { name: TName; inputSchema: TInput; outputSchema: TOutput }) {
    return def
}

const linearStateNameValues = Object.values(LinearStateName)
const dateLikeSchema = z.union([z.string(), z.date()])

export const linearTeamSchema = z.object({
    id: z.string(),
    name: z.string(),
    key: z.string()
})

export const linearIssueAssigneeSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().optional()
})

export const linearIssueProjectSchema = z.object({
    id: z.string(),
    name: z.string()
})

export const linearIssueSummarySchema = z.object({
    id: z.string(),
    identifier: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    state: z.string(),
    priority: z.number().int().nullable().optional(),
    assignee: linearIssueAssigneeSchema.nullable(),
    url: z.string(),
    createdAt: dateLikeSchema,
    updatedAt: dateLikeSchema
})

export const linearIssueDetailSchema = linearIssueSummarySchema.extend({
    team: linearTeamSchema.nullable(),
    project: linearIssueProjectSchema.nullable(),
    dueDate: dateLikeSchema.optional(),
    estimate: z.number().nullable().optional()
})

export const linearIssueHandleSchema = z.object({
    id: z.string(),
    identifier: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    url: z.string(),
    createdAt: dateLikeSchema.optional(),
    updatedAt: dateLikeSchema.optional()
})

export const linearCommentHandleSchema = z.object({
    id: z.string(),
    body: z.string().optional(),
    createdAt: dateLikeSchema.optional(),
    updatedAt: dateLikeSchema.optional()
})

export const linearReadTicketCommentSchema = z.object({
    id: z.string(),
    body: z.string(),
    authorId: z.string(),
    createdAt: z.string()
})

export const linearStateSummarySchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    color: z.string(),
    teamId: z.string()
})

export const linearLabelSummarySchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    teamId: z.string()
})

export const linearProjectSummarySchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    teamId: z.string()
})

export const linearUserSummarySchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    avatarUrl: z.string().optional()
})

export const linearSearchPaginationSchema = z.object({
    hasNextPage: z.boolean(),
    endCursor: z.string().nullable(),
    limit: z.number().int().nullable()
})

export const slackUserResponseSchema = z.object({
    id: z.string(),
    name: z.string()
})

export const slackChannelListItemSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    isPrivate: z.boolean(),
    isIm: z.boolean(),
    isMpim: z.boolean(),
    userId: z.string().optional()
})

export const slackConversationMessageSchema = z.object({
    userId: z.string().optional(),
    userName: z.string().optional(),
    text: z.string(),
    timestamp: z.string().optional(),
    threadTs: z.string().optional()
})

export const gitHubPaginationSchema = z.object({
    page: z.number().int(),
    perPage: z.number().int(),
    hasMore: z.boolean()
})

export const gitHubCodeSearchResultSchema = z.object({
    index: z.number().int(),
    repository: z.string(),
    path: z.string(),
    url: z.string(),
    snippets: z.string()
})

export const gitHubCodeGrepResultSchema = z.object({
    index: z.number().int(),
    repository: z.string(),
    file: z.string(),
    url: z.string(),
    matches: z.string()
})

export const gitHubPullRequestSummarySchema = z.object({
    number: z.number().int(),
    title: z.string(),
    description: z.string(),
    author: z.string(),
    state: z.string(),
    merged: z.boolean(),
    mergedAt: z.string().optional(),
    createdAt: z.string(),
    closedAt: z.string().optional(),
    labels: z.array(z.string()),
    baseBranch: z.string(),
    headBranch: z.string(),
    url: z.string()
})

export const gitHubDirectoryEntrySchema = z.object({
    name: z.string().optional(),
    path: z.string().optional(),
    type: z.literal("directory").optional()
})

export const gitHubFileEntrySchema = z.object({
    name: z.string().optional(),
    path: z.string(),
    type: z.literal("file").optional(),
    size: z.number().int().optional()
})

export const gitHubOtherEntrySchema = z.object({
    name: z.string(),
    type: z.string()
})

export const gitHubCommitSummarySchema = z.object({
    sha: z.string(),
    fullSha: z.string(),
    message: z.string(),
    fullMessage: z.string(),
    author: z.string(),
    date: z.string(),
    url: z.string()
})

export const gitHubPullRequestListSummarySchema = z.object({
    total: z.number().int(),
    merged: z.number().int(),
    open: z.number().int(),
    closed: z.number().int()
})

export const gitHubCommitListSummarySchema = z.object({
    total: z.number().int(),
    byAuthor: z.record(z.string(), z.number().int())
})

export const gitHubPullRequestRefSchema = z.object({
    number: z.number().int(),
    title: z.string(),
    state: z.string(),
    merged: z.boolean(),
    baseBranch: z.string(),
    headBranch: z.string(),
    url: z.string()
})

export const notionLooseObjectSchema = z.record(z.string(), z.unknown())

export const notionUserReferenceSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    object: z.string().optional()
})

export const notionFileReferenceSchema = z.object({
    name: z.string(),
    type: z.string(),
    file: z.string().optional(),
    external: z.string().optional()
})

export const notionDateReferenceSchema = z.object({
    start: z.string().optional(),
    end: z.string().nullable().optional(),
    time_zone: z.string().nullable().optional()
})

export const notionReadablePropertyValueSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string()),
    notionDateReferenceSchema,
    notionUserReferenceSchema,
    z.array(notionUserReferenceSchema),
    z.array(notionFileReferenceSchema),
    notionLooseObjectSchema
])

export const notionPageBlockSchema: z.ZodType<{
    id: string
    type: string
    object: string
    created_time?: string
    last_edited_time?: string
    created_by?: z.infer<typeof notionUserReferenceSchema>
    last_edited_by?: z.infer<typeof notionUserReferenceSchema>
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
    children?: any[]
}> = z.lazy(() =>
    z.object({
        id: z.string(),
        type: z.string(),
        object: z.string(),
        created_time: z.string().optional(),
        last_edited_time: z.string().optional(),
        created_by: notionUserReferenceSchema.optional(),
        last_edited_by: notionUserReferenceSchema.optional(),
        has_children: z.boolean().optional(),
        archived: z.boolean().optional(),
        content: z.string().optional(),
        rich_text: z.array(notionLooseObjectSchema).optional(),
        checked: z.boolean().optional(),
        language: z.string().optional(),
        icon: notionLooseObjectSchema.optional(),
        table_width: z.number().int().optional(),
        has_column_header: z.boolean().optional(),
        has_row_header: z.boolean().optional(),
        caption: z.string().optional(),
        file: z.string().optional(),
        external: z.string().optional(),
        url: z.string().optional(),
        page_id: z.string().optional(),
        database_id: z.string().optional(),
        children: z.array(notionPageBlockSchema).optional()
    })
)

export const notionPageQueryMetadataSchema = z.object({
    page_id: z.string(),
    object: z.string(),
    url: z.string().optional(),
    public_url: z.string().nullable().optional(),
    created_time: z.string().optional(),
    last_edited_time: z.string().optional(),
    archived: z.boolean().optional(),
    icon: notionLooseObjectSchema.nullable().optional(),
    cover: notionLooseObjectSchema.nullable().optional(),
    parent: notionLooseObjectSchema.optional(),
    created_by: notionUserReferenceSchema.optional(),
    last_edited_by: notionUserReferenceSchema.optional(),
    in_trash: z.boolean().optional()
})

export const notionDatabaseRowMutationResultSchema = toolOutputSuccessSchema.extend({
    action: z.enum(["created", "updated"]),
    page_id: z.string(),
    url: z.string().optional()
})

export const notionSchemaPropertySchema = z.object({
    type: z.string(),
    id: z.string(),
    options: z.array(z.string()).optional(),
    format_example: z.string().optional()
})

export const notionDatabaseQueryPageSchema = z.object({
    page_id: z.string(),
    properties: z.record(z.string(), notionReadablePropertyValueSchema),
    url: z.string().optional(),
    created_time: z.string().optional(),
    last_edited_time: z.string().optional()
})

export const notionQueryDatabaseFailureSchema = toolOutputFailureSchema.extend({
    pages: z.array(notionDatabaseQueryPageSchema),
    total_returned: z.literal(0),
    has_more: z.literal(false),
    next_cursor: z.null(),
    error: z.string(),
    hint: z.string()
})

export const notionQueryDatabaseSuccessSchema = toolOutputSuccessSchema.extend({
    pages: z.array(notionDatabaseQueryPageSchema),
    total_returned: z.number().int(),
    has_more: z.boolean(),
    next_cursor: z.string().nullable()
})

export const notionModifyBlocksAppendResultSchema = z.object({
    operation: z.literal("append"),
    actions: z.array(runHistoryActionBaseSchema),
    block_ids: z.array(z.string()),
    blocks_count: z.number().int()
})

export const notionModifyBlocksUpdateResultSchema = z.object({
    operation: z.literal("update"),
    actions: z.array(runHistoryActionBaseSchema),
    block_id: z.string()
})

export const notionModifyBlocksDeleteResultSchema = z.object({
    operation: z.literal("delete"),
    actions: z.array(runHistoryActionBaseSchema),
    block_id: z.string()
})

export const notionModifyBlocksOperationResultSchema = z.union([notionModifyBlocksAppendResultSchema, notionModifyBlocksUpdateResultSchema, notionModifyBlocksDeleteResultSchema])

export const notionModifyBlocksAppendSuccessSchema = toolOutputSuccessSchema.extend({
    operation: z.literal("append"),
    block_ids: z.array(z.string()),
    blocks_count: z.number().int()
})

export const notionModifyBlocksSingleBlockSuccessSchema = toolOutputSuccessSchema.extend({
    operation: z.enum(["update", "delete"]),
    block_id: z.string()
})

export const notionModifyBlocksBatchSuccessSchema = toolOutputSuccessSchema.extend({
    operations: z.array(notionModifyBlocksOperationResultSchema),
    block_ids: z.array(z.string()),
    total_operations: z.number().int()
})

export const notionModifyBlocksSuccessSchema = z.union([notionModifyBlocksAppendSuccessSchema, notionModifyBlocksSingleBlockSuccessSchema, notionModifyBlocksBatchSuccessSchema])

export const notionModifyBlocksFailureSchema = toolOutputFailureSchema.extend({
    error: z.string(),
    block_ids: z.array(z.string()),
    operations: z.array(notionModifyBlocksOperationResultSchema).optional(),
    failed_at_index: z.number().int().optional(),
    total_operations: z.number().int().optional(),
    hint: z.string().optional(),
    retry_instructions: z.string().optional()
})

export const notionWorkspaceUserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().optional()
})

export const gmailHeaderSchema = z.object({
    key: z.string(),
    value: z.string()
})

export const gmailSendSummarySchema = z.object({
    message_id: z.string(),
    thread_id: z.string(),
    to: z.string(),
    subject: z.string(),
    summary: z.string(),
    is_reply: z.boolean()
})

export const gmailDraftSummarySchema = z.object({
    draft_id: z.string(),
    message_id: z.string(),
    thread_id: z.string(),
    draft_url: z.string(),
    to: z.string(),
    subject: z.string(),
    summary: z.string(),
    is_reply: z.boolean()
})

export const posthogSeverityLevelSchema = z.enum(["error", "warn", "info", "debug"])

export const posthogSessionSummarySchema = z.object({
    id: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    duration: z.number().optional(),
    eventsCount: z.number().int(),
    sessionUrl: z.string(),
    personId: z.string(),
    distinctId: z.string()
})

export const posthogSearchSessionsPaginationSchema = z.object({
    limit: z.number().int(),
    offset: z.number().int(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
    nextOffset: z.number().int().nullable(),
    previousOffset: z.number().int().nullable()
})

export const posthogSearchSessionsFoundSchema = toolOutputSuccessSchema.extend({
    userEmail: z.string(),
    projectId: z.string(),
    personFound: z.literal(true),
    personId: z.string(),
    distinctId: z.string(),
    totalSessions: z.number().int(),
    sessions: z.array(posthogSessionSummarySchema),
    sessionsLink: z.string(),
    pagination: posthogSearchSessionsPaginationSchema,
    message: z.string()
})

export const posthogSearchSessionsNotFoundSchema = toolOutputSuccessSchema.extend({
    userEmail: z.string(),
    projectId: z.string(),
    personFound: z.literal(false),
    sessions: z.array(posthogSessionSummarySchema).length(0),
    totalSessions: z.literal(0),
    message: z.string()
})

export const posthogLogEntrySchema = z.object({
    id: z.string(),
    timestamp: z.string().optional(),
    level: z.string(),
    message: z.string(),
    service: z.string(),
    attributes: z.record(z.string(), z.unknown())
})

export const posthogOffsetPaginationSchema = z.object({
    limit: z.number().int(),
    offset: z.number().int(),
    hasMore: z.boolean(),
    nextOffset: z.number().int().nullable(),
    showing: z.string()
})

export const posthogEventCountSchema = z.object({
    eventName: z.string(),
    count: z.number().int()
})

export const posthogEventSummarySchema = z.object({
    id: z.string(),
    event: z.string(),
    timestamp: z.string().optional(),
    distinctId: z.string().optional(),
    url: z.string().optional()
})

export const posthogSessionEventTypeSchema = z.enum(["click", "input", "scroll", "console", "network_error", "navigation", "custom", "page_load", "viewport_resize"])

export const posthogSessionEventSchema = z.object({
    type: posthogSessionEventTypeSchema,
    timestamp: z.number(),
    relativeTime: z.number(),
    data: z.record(z.string(), z.unknown())
})

export const posthogSessionConsoleLogSchema = z.object({
    timestamp: z.string(),
    level: z.string(),
    message: z.string()
})

export const posthogSessionEventsSummarySchema = z.object({
    totalRawEvents: z.number().int(),
    meaningfulEventsReturned: z.number().int(),
    consoleLogsReturned: z.number().int()
})

export const posthogSessionEventsTimeWindowSchema = z.object({
    startSeconds: z.number(),
    endSeconds: z.number().nullable()
})

export const linearCreateTicketPayloadSchema = z.object({
    title: z.string(),
    teamId: z.string(),
    description: z.string().nullable().optional(),
    stateId: z.string().nullable().optional(),
    priority: z.number().int().nullable().optional(),
    projectId: z.string().nullable().optional(),
    labelIds: z.array(z.string()).nullable().optional(),
    assigneeId: z.string().nullable().optional()
})

export const linearCreateTicketInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Linear workspace to use."),
    ticket: linearCreateTicketPayloadSchema
})

export const linearUpdateTicketUpdatesSchema = z.object({
    title: z.string().nullable().optional().describe("The updated title of the ticket."),
    description: z.string().nullable().optional().describe("The updated description of the ticket."),
    stateId: z.string().nullable().optional().describe("The ID of the state to set. Use linear_get_states to find available states."),
    priority: z.number().int().nullable().optional().describe("The priority of the ticket. 0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low."),
    projectId: z.string().nullable().optional().describe("The ID of the project to associate with the ticket. Use linear_get_projects to find available projects."),
    labelIds: z.array(z.string()).nullable().optional().describe("The IDs of labels to add to the ticket. Use linear_get_labels to find available labels."),
    assigneeId: z.string().nullable().optional().describe("The ID of the user to assign the ticket to. Use linear_get_users to find available users and their IDs.")
})

export const linearUpdateTicketInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Linear workspace to use."),
    issueId: z.string().describe("The ID of the Linear issue to update. Use linear_search_ticket to find the issue ID."),
    updates: linearUpdateTicketUpdatesSchema
})

export const linearAddCommentInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Linear workspace to use."),
    issueId: z.string().describe("The ID of the Linear issue to add the comment to. Use linear_search_ticket to find the issue ID."),
    body: z.string().describe("The comment text to add to the issue.")
})

export const linearSearchTicketDateFilterFieldSchema = z.enum(["updatedAt", "createdAt"])

export const linearSearchTicketInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Linear integration to use."),
    searchTerm: z
        .string()
        .optional()
        .default("")
        .describe(
            `Plain-text keyword search (matched against titles, descriptions, etc.).
            Do NOT include operators or field filters. Use dedicated parameters instead.
            ✓ "block kit"
            ✗ "team:TER state:Done updated:>2026-02-04 block kit"`
        ),
    stateNames: z
        .array(z.nativeEnum(LinearStateName))
        .nullable()
        .optional()
        .describe(`Filter to only include issues with these state names. Available states: ${linearStateNameValues.join(", ")}.`),
    dateFilterField: linearSearchTicketDateFilterFieldSchema
        .nullable()
        .optional()
        .describe("Which date field to filter on. Required if using dateAfter or dateBefore. Options: 'updatedAt' (when issue was last modified) or 'createdAt' (when issue was created)."),
    dateAfter: z
        .string()
        .nullable()
        .optional()
        .describe("Filter to only include issues where the dateFilterField is on or after this date. ISO 8601 format (e.g., '2026-01-01' or '2026-01-01T00:00:00Z')."),
    dateBefore: z
        .string()
        .nullable()
        .optional()
        .describe("Filter to only include issues where the dateFilterField is on or before this date. ISO 8601 format (e.g., '2026-02-01' or '2026-02-01T23:59:59Z')."),
    limit: z.number().int().nullable().optional().describe("Maximum number of issues to return. Defaults to 10 if not provided."),
    after: z.string().nullable().optional().describe("Cursor for pagination. Use the endCursor from the previous response to fetch the next page of results.")
})

export const linearReadTicketInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Linear integration to use."),
    issueId: z.string().describe("The Linear issue ID (UUID) or identifier (e.g. 'PROJ-123')."),
    includeComments: z.boolean().nullable().optional().describe("Whether to include comments. Defaults to true.")
})

export const linearGetStatesInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Linear integration to use."),
    teamId: z.string().nullable().optional().describe("Optional team ID to limit results to that team's states.")
})

export const linearGetLabelsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Linear integration to use."),
    teamId: z.string().nullable().optional().describe("Optional team ID to limit results to that team's labels.")
})

export const linearGetProjectsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Linear integration to use."),
    teamId: z.string().nullable().optional().describe("Optional team ID to limit results to that team's projects.")
})

export const linearGetTeamsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Linear integration to use.")
})

export const linearGetUsersInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Linear integration to use.")
})

export const slackSendMessageInputSchema = z
    .object({
        integrationId: z.string().describe("The integration ID of the Slack workspace to use."),
        channelId: z.string().nullable().optional().describe("Slack channel ID (C…/G…) or existing DM channel ID (D…). Omit when sending via slackUserId (opens DM if needed)."),
        slackUserId: z
            .string()
            .nullable()
            .optional()
            .describe("Slack member ID (U…) to send a direct message. The workspace opens the DM conversation if one does not exist yet. Omit when sending to channelId."),
        message: z.string().describe("Message content (mrkdwn). Used as fallback for Block Kit or main message."),
        thread_ts: z
            .string()
            .nullable()
            .optional()
            .describe(
                "Thread timestamp to reply to existing thread. If sending a message to a thread, this should be the timestamp of the thread to reply to. If sending an unthreaded message, this should be set to null."
            ),
        blocks: z.string().nullable().optional().describe("Block Kit JSON array string for interactive messages with buttons, structured layouts")
    })
    .superRefine((data, ctx) => {
        if (!data.channelId && !data.slackUserId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Provide channelId (channel or existing DM) or slackUserId (workspace member to DM)."
            })
        }
    })

export const slackListChannelsTypesSchema = z.enum(["public", "private", "im", "mpim", "all"])

export const slackListChannelsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Slack workspace (user_slack_integrations id)."),
    types: slackListChannelsTypesSchema.nullable().optional().describe("Filter by type: public (public channels), private (private channels), im (DMs), mpim (group DMs), or all. Defaults to all."),
    limit: z.number().int().min(1).max(500).nullable().optional().default(100).describe("Maximum number of conversations to return."),
    cursor: z.string().nullable().optional().describe("Pagination cursor from a previous response (nextCursor). Omit on first call.")
})

export const slackListUsersInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Slack workspace (user_slack_integrations id)."),
    query: z.string().nullable().optional().describe("Optional search query to filter users by name. Case-insensitive partial match.")
})

export const slackReadConversationInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Slack workspace (user_slack_integrations id)."),
    channelId: z.string().describe("The Slack channel ID to read (from slack_list_channels)."),
    limit: z.number().int().min(1).max(200).nullable().optional().default(50).describe("Maximum number of messages to return."),
    cursor: z.string().nullable().optional().describe("Pagination cursor from a previous response (nextCursor). Omit on first call.")
})

export const searchGitHubCodeInputSchema = z.object({
    repositoryNames: z.array(z.string()).describe("Array of repository full names (owner/repo format) to search in."),
    query: z.string().describe('The search query. Use natural language or code-specific terms. Examples: "authentication middleware", "class UserRepository", "handleSubmit form validation"'),
    language: z.string().nullable().optional().describe('Filter by programming language (e.g., "typescript", "javascript"). Use null to search all languages.'),
    filename: z.string().nullable().optional().describe('Filter by filename pattern (e.g., "*.test.ts" for test files, "*.config.*" for config files). Use null to search all files.'),
    path: z.string().nullable().optional().describe('Filter by path (e.g., "src/components" to only search in that directory). Use null to search everywhere.'),
    perPage: z.number().int().describe("Number of results to return (default: 10, max: 100)"),
    page: z
        .number()
        .int()
        .min(1)
        .nullable()
        .describe("Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.")
})

export const grepGitHubCodeInputSchema = z.object({
    repositoryNames: z.array(z.string()).describe("Array of repository full names (owner/repo format) to search in."),
    pattern: z.string().describe('The exact text pattern to search for. For function calls, include the opening parenthesis (e.g., "fetchUser("). For strings, include quotes if needed.'),
    fileExtension: z.string().nullable().optional().describe('Filter by file extension (e.g., "ts", "js", "py"). Do not include the dot. Use null to search all file types.'),
    path: z.string().nullable().optional().describe('Filter by directory path (e.g., "src/services" to only search in that directory). Use null to search everywhere.'),
    perPage: z.number().int().describe("Number of results to return (default: 20, max: 100)"),
    page: z
        .number()
        .int()
        .min(1)
        .nullable()
        .describe("Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.")
})

export const readGitHubFileInputSchema = z.object({
    repository: z.string().describe('The repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
    path: z.string().describe('The file path within the repository (e.g., "src/components/Button.tsx" or "README.md")'),
    startLine: z.number().int().nullable().optional().describe("Start reading from this line number (1-indexed). Use with endLine for partial file reads. Use null to start from beginning."),
    endLine: z.number().int().nullable().optional().describe("Stop reading at this line number (1-indexed, inclusive). Use with startLine for partial file reads. Use null to read to end.")
})

export const listGitHubDirectoryInputSchema = z.object({
    repository: z.string().describe('The repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
    path: z.string().describe('The directory path to list (e.g., "src/components"). Use empty string "" for root directory.'),
    recursive: z.boolean().describe("If true, list all files recursively (can be large for big repos). Use false for single-level listing.")
})

export const listGitHubPullRequestsInputSchema = z.object({
    repository: z.string().describe('Repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
    state: z.enum(["open", "closed", "all"]).describe('Filter by PR state. Use "closed" to see merged PRs, "open" for in-progress, or "all" for both.'),
    since: z
        .string()
        .nullable()
        .describe('Start date in YYYY-MM-DD format (e.g., "2024-01-15"). Only PRs updated on or after this date (starting at 00:00:00) are included. Use null for no start filter.'),
    until: z.string().nullable().describe('End date in YYYY-MM-DD format (e.g., "2024-01-15"). Only PRs updated on or before this date (ending at 23:59:59) are included. Use null for no end filter.'),
    perPage: z.number().int().describe("Number of results to return (default: 20, max: 100)"),
    page: z
        .number()
        .int()
        .min(1)
        .nullable()
        .describe("Page number for pagination (default: 1). Use this to fetch additional PRs if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.")
})

export const listGitHubCommitsInputSchema = z.object({
    repository: z.string().describe('Repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
    since: z
        .string()
        .nullable()
        .describe('Start of time window (ISO date string, e.g., "2024-01-01" or "2024-01-15T00:00:00Z"). Only commits after this date are included. Use null for no start filter.'),
    until: z.string().nullable().optional().describe("End of time window (ISO date string). Only commits before this date are included. Use null for no end filter."),
    branch: z.string().nullable().optional().describe('Branch name to list commits from (e.g., "main", "develop"). Use null for the repository\'s default branch.'),
    path: z.string().nullable().optional().describe('Only include commits that affect this file or directory path (e.g., "src/components" or "package.json"). Use null for all paths.'),
    author: z.string().nullable().optional().describe("Filter commits by author (GitHub username or email). Use null for all authors."),
    perPage: z.number().int().describe("Number of results to return (default: 30, max: 100)")
})

export const summarizeGitHubPullRequestDiffInputSchema = z.object({
    repository: z.string().describe('The repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
    pullNumber: z.number().int().describe("The pull request number (e.g., 123 for PR #123)"),
    page: z
        .number()
        .int()
        .min(1)
        .nullable()
        .describe("Page number for pagination (default: 1). Use this to fetch additional files if a PR has more than 100 files. Use null for page 1. Must be a positive integer >= 1."),
    context: z
        .string()
        .nullable()
        .describe(
            'Optional high-level context about what you\'re looking for in this PR. This helps the sub-agent focus its analysis. For example: "I need to understand the authentication changes" or "Focus on database migration changes". Use null if no specific context.'
        )
})

export const notionCreateOrUpdatePageInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
    page_id: z.string().nullable().optional().describe("ID of an existing page to update. Omit or null to create a new subpage under parentPageId."),
    parentPageId: z
        .string()
        .optional()
        .nullable()
        .describe("Required for create: the allowed page ID under which to create the new subpage (from the Notion config list). Ignored when page_id is provided for update."),
    title: z.string().describe("The page title (used for both create and update).")
})

export const notionCreateOrUpdateDatabaseRowInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
    databaseId: z.string().describe("The Notion database ID (data source ID)."),
    page_id: z.string().nullable().describe("The ID of the row to update (from notion_query_database). MUST be null to create a new row. Provide a valid page ID to update an existing row."),
    properties_json: z
        .string()
        .describe(
            'JSON string with property names and Notion-formatted values. Example: "{\\"Name\\": {\\"title\\": [{\\"text\\": {\\"content\\": \\"New Item\\"}}]}, \\"Status\\": {\\"select\\": {\\"name\\": \\"In Progress\\"}}}"'
        )
})

export const notionModifyBlocksInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
    pageId: z.string().describe("The Notion page ID to modify."),
    operation_json: z.string().describe(`JSON string: a single operation object OR an array of operation objects (executed in order).
Each operation: operation ("append"|"update"|"delete"); for append: blocks (array), optional parent_block_id, optional after_block_id; for update: block_id, block; for delete: block_id.
Append with after_block_id inserts after that block; omit for end of page/parent.`)
})

export const notionQueryPageInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
    pageId: z.string().describe("The Notion page ID to query.")
})

export const notionQueryDatabaseInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
    databaseId: z.string().describe("The Notion database ID (data source ID) to query."),
    filter_properties: z
        .array(z.string())
        .nullable()
        .optional()
        .describe("Array of property names or IDs to include in results. Only these properties will be returned, improving performance. Use property names from the database schema."),
    filter: z.string().nullable().optional()
        .describe(`JSON string with filter object to query pages matching specific criteria. Supports complex filtering with AND/OR logic, property filters, and timestamp filters.

BASIC STRUCTURE:
- Property filter: { "property": "Property Name", "type": { "condition": value } }
- Timestamp filter: { "timestamp": "created_time" | "last_edited_time", "created_time" | "last_edited_time": { "condition": value } }
- Compound filter: { "and": [...] } or { "or": [...] } to combine multiple filters (nesting supported up to 2 levels)

PROPERTY FILTER TYPES AND CONDITIONS:

1. CHECKBOX: { "property": "Name", "checkbox": { "equals": true|false } | { "does_not_equal": true|false } }

2. DATE: { "property": "Name", "date": { 
"after": "2021-05-10" | "2021-05-10T12:00:00" | "2021-10-15T12:00:00-07:00",
"before": "2021-05-10",
"equals": "2021-05-10",
"on_or_after": "2021-05-10",
"on_or_before": "2021-05-10",
"is_empty": true,
"is_not_empty": true,
"past_week": {},
"past_month": {},
"past_year": {},
"next_week": {},
"next_month": {},
"next_year": {},
"this_week": {}
} }

3. FILES: { "property": "Name", "files": { "is_empty": true } | { "is_not_empty": true } }

4. FORMULA: { "property": "Name", "formula": { 
"checkbox": { checkbox conditions },
"date": { date conditions },
"number": { number conditions },
"string": { rich_text conditions }
} }

5. MULTI_SELECT: { "property": "Name", "multi_select": { 
"contains": "Value",
"does_not_contain": "Value",
"is_empty": true,
"is_not_empty": true
} }

6. NUMBER: { "property": "Name", "number": { 
"equals": 42,
"does_not_equal": 42,
"greater_than": 42,
"less_than": 42,
"greater_than_or_equal_to": 42,
"less_than_or_equal_to": 42,
"is_empty": true,
"is_not_empty": true
} }

7. PEOPLE (also for created_by, last_edited_by): { "property": "Name", "people": { 
"contains": "uuid-v4",
"does_not_contain": "uuid-v4",
"is_empty": true,
"is_not_empty": true
} }

8. RELATION: { "property": "Name", "relation": { 
"contains": "uuid-v4",
"does_not_contain": "uuid-v4",
"is_empty": true,
"is_not_empty": true
} }

9. RICH_TEXT (also title): { "property": "Name", "rich_text": { 
"contains": "string",
"does_not_contain": "string",
"does_not_equal": "string",
"ends_with": "string",
"equals": "string",
"is_empty": true,
"is_not_empty": true,
"starts_with": "string"
} }

10. ROLLUP: { "property": "Name", "rollup": { 
"any": { filter condition },
"every": { filter condition },
"none": { filter condition },
"date": { date conditions },
"number": { number conditions }
} }

11. SELECT: { "property": "Name", "select": { 
"equals": "Value",
"does_not_equal": "Value",
"is_empty": true,
"is_not_empty": true
} }

12. STATUS: { "property": "Name", "status": { 
"equals": "Value",
"does_not_equal": "Value",
"is_empty": true,
"is_not_empty": true
} }

13. TIMESTAMP: { "timestamp": "created_time" | "last_edited_time", "created_time" | "last_edited_time": { 
same conditions as DATE filter (after, before, equals, on_or_after, on_or_before, is_empty, is_not_empty, past_week, past_month, past_year, next_week, next_month, next_year, this_week)
} }
NOTE: Do NOT include "property" field for timestamp filters.

14. VERIFICATION: { "property": "Name", "verification": { "status": "verified" | "expired" | "none" } }

15. UNIQUE_ID: { "property": "Name", "unique_id": { 
"equals": 42,
"does_not_equal": 42,
"greater_than": 42,
"less_than": 42,
"greater_than_or_equal_to": 42,
"less_than_or_equal_to": 42
} }

COMPOUND FILTERS:
- AND: { "and": [filter1, filter2, ...] } - all conditions must match
- OR: { "or": [filter1, filter2, ...] } - any condition can match
- Nesting: Can nest AND/OR up to 2 levels deep

EXAMPLES:
- Simple: "{\\"property\\": \\"Task completed\\", \\"checkbox\\": {\\"equals\\": true}}"
- Compound: "{\\"and\\": [{\\"property\\": \\"Done\\", \\"checkbox\\": {\\"equals\\": true}}, {\\"or\\": [{\\"property\\": \\"Tags\\", \\"multi_select\\": {\\"contains\\": \\"A\\"}}, {\\"property\\": \\"Tags\\", \\"multi_select\\": {\\"contains\\": \\"B\\"}}]}]}"
- Timestamp: "{\\"timestamp\\": \\"created_time\\", \\"created_time\\": {\\"on_or_after\\": \\"2023-02-08\\"}}"`),
    page_size: z.number().int().min(1).max(100).nullable().optional().describe("Number of results per page (1-100). Default returns all results. Use pagination for large databases."),
    start_cursor: z.string().nullable().optional().describe("Cursor from previous response to fetch next page. Use next_cursor from response when has_more is true."),
    result_type: z.enum(["page", "data_source"]).nullable().optional().describe("Filter results to only pages or data sources. Only relevant for wiki databases.")
})

export const notionGetSchemaInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
    databaseId: z.string().describe("The Notion database ID (data source ID) to get the schema for.")
})

export const notionListUsersInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Notion workspace to use."),
    query: z.string().nullable().optional().describe("Optional search query to filter users by name. Case-insensitive partial match.")
})

export const gmailSendEmailInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Gmail account to use."),
    to: z.string().describe("Recipient email address(es). Multiple addresses can be comma-separated."),
    subject: z.string().describe("Email subject line"),
    body: z.string().nullable().optional().describe("Plain text email body content. Do not include image URLs here — images cannot be embedded in plain text."),
    html_body: z
        .string()
        .nullable()
        .optional()
        .describe(
            'HTML email body content. If provided with body, sends multipart/alternative. NEVER use <img src="https://..."> with remote URLs — they will expire. Images must be passed via image_urls and referenced as <img src="cid:image-1.png">.'
        ),
    thread_id: z.string().nullable().optional().describe("Gmail Thread ID (numeric string from the email event, NOT the Message-ID header). Omit for new emails."),
    cc: z.string().nullable().optional().describe("CC recipient email address(es). Multiple addresses can be comma-separated."),
    bcc: z.string().nullable().optional().describe("BCC recipient email address(es). Multiple addresses can be comma-separated."),
    image_urls: z
        .array(z.string())
        .nullable()
        .optional()
        .describe(
            'URLs of images to embed in the email. Must be signed URLs from our internal GCS image bucket. Each image is downloaded and base64-encoded as an inline MIME attachment with a Content-ID. Images are assigned sequential filenames: image-1.png, image-2.png, etc. (extension reflects actual MIME type). You MUST reference each one in html_body as <img src="cid:image-1.png">, <img src="cid:image-2.png">, etc. Do NOT put the raw URLs in html_body.'
        ),
    custom_headers: z
        .array(gmailHeaderSchema)
        .nullable()
        .optional()
        .describe(
            'Custom email headers as key-value pairs. Useful for adding headers like List-Unsubscribe, List-Unsubscribe-Post, X-Priority, etc. Example: {"List-Unsubscribe": "<mailto:unsubscribe@example.com>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}'
        )
})

export const gmailCreateDraftInputSchema = gmailSendEmailInputSchema.extend({
    thread_id: z.string().nullable().optional().describe("Gmail Thread ID (numeric string from the email event, NOT the Message-ID header). Omit for new drafts.")
})

export const searchPosthogSessionsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the PostHog skill to use."),
    projectId: z.string().describe("The PostHog project ID."),
    userEmail: z.string().describe("The email address of the user to query session recordings for. Must be a valid email address."),
    limit: z.number().int().default(10).describe("Maximum number of session recordings to return (default: 10, max: 100)"),
    offset: z.number().int().default(0).describe("Offset for pagination (default: 0)"),
    last7Days: z
        .boolean()
        .default(false)
        .describe(
            "If true and dateFrom is not provided, filters session recordings from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided."
        ),
    dateFrom: z
        .union([z.string(), z.null()])
        .describe(
            'Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.'
        ),
    dateTo: z.string().nullable().optional().describe('End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.')
})

export const searchPosthogLogsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the PostHog skill to use."),
    projectId: z.string().describe("The PostHog project ID."),
    userEmail: z.string().nullable().optional().describe('Optional: User email to filter logs by (e.g., "user@example.com").'),
    severityLevels: z
        .union([z.array(posthogSeverityLevelSchema), z.null()])
        .describe('Optional: Array of log severity levels to filter by (e.g., ["error", "warn"]). If not provided, all severity levels are included.'),
    messageSearch: z.string().nullable().optional().describe("Optional: Text to search for within log messages. Searches are case-insensitive and match partial text."),
    limit: z.number().int().default(50).describe("Maximum number of log entries to return (default: 50, max: 250)"),
    offset: z.number().int().default(0).describe("Offset for pagination (default: 0). Use with limit to page through results. For example, offset=0 gets logs 1-50, offset=50 gets logs 51-100, etc."),
    last7Days: z
        .boolean()
        .default(false)
        .describe("If true and dateFrom is not provided, filters logs from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided."),
    dateFrom: z
        .union([z.string(), z.null()])
        .describe(
            'Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.'
        ),
    dateTo: z.string().nullable().optional().describe('End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.')
})

export const getPosthogSessionEventsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the PostHog skill to use."),
    projectId: z.string().describe("The PostHog project ID."),
    sessionId: z.string().uuid().describe("The PostHog session ID (UUID format) to fetch events for. You can get this from searchPosthogSessions."),
    startSeconds: z.number().nullable().optional().describe("Optional: Start time in seconds from the beginning of the session. If not provided, starts from the beginning."),
    endSeconds: z.number().nullable().optional().describe("Optional: End time in seconds from the beginning of the session. If not provided, goes until the end.")
})

export const posthogPropertyFilterValueSchema = z.union([z.string(), z.number(), z.boolean()])

export const posthogPropertyFilterOperatorSchema = z.enum(["exact", "is_not", "icontains", "not_icontains", "gt", "lt", "gte", "lte"])

export const posthogPropertyFilterTypeSchema = z.enum(["event", "person"])

export const posthogPropertyFilterSchema = z.object({
    key: z.string().describe('Property key to filter on (e.g. "$current_url", "plan", "email").'),
    value: posthogPropertyFilterValueSchema.describe("Property value to match"),
    operator: posthogPropertyFilterOperatorSchema.optional().describe('Comparison operator (default: "exact")'),
    type: posthogPropertyFilterTypeSchema
        .optional()
        .describe('"event" (default) matches a property on the event itself; "person" matches a property on the person who sent it (e.g. {key: "email", value: "user@example.com", type: "person"}).')
})

export type PosthogPropertyFilter = z.infer<typeof posthogPropertyFilterSchema>

const posthogDistinctIdSchema = z
    .string()
    .nullable()
    .optional()
    .describe("Optional: only include events sent by this user, matched against the event's distinct ID (the ID your app passes to posthog.identify(), often your internal user ID).")

const posthogPropertyFiltersSchema = z
    .union([z.array(posthogPropertyFilterSchema), z.null()])
    .optional()
    .describe('Optional: property filters. To filter by a user\'s email use {key: "email", value: "user@example.com", type: "person"}.')

const posthogDateFromSchema = z
    .string()
    .nullable()
    .optional()
    .describe('Optional: start of the time range. UTC "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD", or relative like "-30m", "-24h", "-7d", "-2w". If omitted, no lower bound.')

const posthogDateToSchema = z.string().nullable().optional().describe("Optional: end of the time range, same formats as dateFrom. Defaults to now.")

export const listPosthogEventNamesInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the PostHog skill to use."),
    projectId: z.string().describe("The PostHog project ID."),
    customEventsOnly: z.boolean().optional().describe("If true (default), exclude PostHog built-in events (names starting with $, e.g. $pageview) and list only the project's custom-tracked events."),
    distinctId: posthogDistinctIdSchema,
    propertyFilters: posthogPropertyFiltersSchema,
    dateFrom: posthogDateFromSchema,
    dateTo: posthogDateToSchema
})

export const searchPosthogEventsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the PostHog skill to use."),
    projectId: z.string().describe("The PostHog project ID."),
    eventName: z.string().nullable().optional().describe('Optional: specific event name to filter by (e.g., "$pageview", "button_clicked"). Use listPosthogEventNames to discover available names.'),
    customEventsOnly: z.boolean().optional().describe("If true (default), exclude PostHog built-in events (names starting with $). Ignored when eventName is provided."),
    distinctId: posthogDistinctIdSchema,
    propertyFilters: posthogPropertyFiltersSchema,
    limit: z.number().int().optional().describe("Maximum number of events to return (default: 50, max: 100)."),
    cursor: z.string().nullable().optional().describe("Pagination cursor: pass nextCursor from the previous response to fetch the next (older) page."),
    dateFrom: posthogDateFromSchema,
    dateTo: posthogDateToSchema
})

export const linearCreateTicketTool = defineTool({
    name: "linear_create_ticket",
    inputSchema: linearCreateTicketInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        issue: linearIssueHandleSchema
    })
})

export const linearUpdateTicketTool = defineTool({
    name: "linear_update_ticket",
    inputSchema: linearUpdateTicketInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        issue: linearIssueHandleSchema
    })
})

export const linearAddCommentTool = defineTool({
    name: "linear_add_comment",
    inputSchema: linearAddCommentInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        comment: linearCommentHandleSchema
    })
})

export const linearSearchTicketTool = defineTool({
    name: "linear_search_ticket",
    inputSchema: linearSearchTicketInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        issues: z.array(linearIssueSummarySchema),
        count: z.number().int(),
        query: z.string(),
        pagination: linearSearchPaginationSchema
    })
})

export const linearReadTicketTool = defineTool({
    name: "linear_read_ticket",
    inputSchema: linearReadTicketInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        issue: linearIssueDetailSchema,
        comments: z.array(linearReadTicketCommentSchema).optional()
    })
})

export const linearGetStatesTool = defineTool({
    name: "linear_get_states",
    inputSchema: linearGetStatesInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        states: z.array(linearStateSummarySchema)
    })
})

export const linearGetLabelsTool = defineTool({
    name: "linear_get_labels",
    inputSchema: linearGetLabelsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        labels: z.array(linearLabelSummarySchema)
    })
})

export const linearGetProjectsTool = defineTool({
    name: "linear_get_projects",
    inputSchema: linearGetProjectsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        projects: z.array(linearProjectSummarySchema)
    })
})

export const linearGetTeamsTool = defineTool({
    name: "linear_get_teams",
    inputSchema: linearGetTeamsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        teams: z.array(linearTeamSchema)
    })
})

export const linearGetUsersTool = defineTool({
    name: "linear_get_users",
    inputSchema: linearGetUsersInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        users: z.array(linearUserSummarySchema)
    })
})

export const slackSendMessageTool = defineTool({
    name: "slack_send_message",
    inputSchema: slackSendMessageInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        message_ts: z.string().optional(),
        channel: z.string(),
        thread_ts: z.string().optional(),
        summary: z.string(),
        has_blocks: z.boolean()
    })
})

export const slackListChannelsTool = defineTool({
    name: "slack_list_channels",
    inputSchema: slackListChannelsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        channels: z.array(slackChannelListItemSchema),
        count: z.number().int(),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean()
    })
})

export const slackListUsersTool = defineTool({
    name: "slack_list_users",
    inputSchema: slackListUsersInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        users: z.array(slackUserResponseSchema),
        count: z.number().int()
    })
})

export const slackReadConversationTool = defineTool({
    name: "slack_read_conversation",
    inputSchema: slackReadConversationInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        channelId: z.string(),
        channelName: z.string().optional(),
        messages: z.array(slackConversationMessageSchema),
        count: z.number().int(),
        hasMore: z.boolean(),
        nextCursor: z.string().nullable()
    })
})

export const searchGitHubCodeTool = defineTool({
    name: "searchGitHubCode",
    inputSchema: searchGitHubCodeInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        totalCount: z.number().int(),
        resultsReturned: z.number().int(),
        query: z.string(),
        repositories: z.array(z.string()),
        pagination: gitHubPaginationSchema,
        results: z.array(gitHubCodeSearchResultSchema),
        message: z.string(),
        tip: z.string()
    })
})

export const grepGitHubCodeTool = defineTool({
    name: "grepGitHubCode",
    inputSchema: grepGitHubCodeInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        totalCount: z.number().int(),
        resultsReturned: z.number().int(),
        pattern: z.string(),
        query: z.string(),
        repositories: z.array(z.string()),
        pagination: gitHubPaginationSchema,
        results: z.array(gitHubCodeGrepResultSchema),
        message: z.string(),
        tip: z.string()
    })
})

export const readGitHubFileTool = defineTool({
    name: "readGitHubFile",
    inputSchema: readGitHubFileInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        repository: z.string(),
        path: z.string(),
        url: z.string(),
        totalLines: z.number().int(),
        displayedLines: z.string(),
        size: z.number().int(),
        content: z.string(),
        warning: z.string().optional()
    })
})

export const listGitHubDirectoryTool = defineTool({
    name: "listGitHubDirectory",
    inputSchema: listGitHubDirectoryInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        repository: z.string(),
        path: z.string(),
        recursive: z.boolean(),
        totalItems: z.number().int(),
        directories: z.array(z.union([gitHubDirectoryEntrySchema, z.string()])),
        files: z.array(gitHubFileEntrySchema),
        warning: z.string().optional(),
        tip: z.string().optional(),
        truncated: z.boolean().optional(),
        other: z.array(gitHubOtherEntrySchema).optional()
    })
})

export const listGitHubPullRequestsTool = defineTool({
    name: "listGitHubPullRequests",
    inputSchema: listGitHubPullRequestsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        repository: z.string(),
        timeWindow: z.string(),
        summary: gitHubPullRequestListSummarySchema,
        pagination: gitHubPaginationSchema,
        pullRequests: z.array(gitHubPullRequestSummarySchema),
        message: z.string()
    })
})

export const listGitHubCommitsTool = defineTool({
    name: "listGitHubCommits",
    inputSchema: listGitHubCommitsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        repository: z.string(),
        timeWindow: z.string(),
        filters: z.string(),
        summary: gitHubCommitListSummarySchema,
        commits: z.array(gitHubCommitSummarySchema),
        message: z.string(),
        tip: z.string()
    })
})

export const summarizeGitHubPullRequestDiffTool = defineTool({
    name: "summarizeGitHubPullRequestDiff",
    inputSchema: summarizeGitHubPullRequestDiffInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        repository: z.string(),
        pullRequest: gitHubPullRequestRefSchema,
        summary: z.record(z.string(), z.unknown()),
        pagination: gitHubPaginationSchema,
        analysis: z.string(),
        message: z.string()
    })
})

export const notionCreateOrUpdatePageTool = defineTool({
    name: "notion_create_or_update_page",
    inputSchema: notionCreateOrUpdatePageInputSchema,
    outputSchema: notionDatabaseRowMutationResultSchema
})

export const notionCreateOrUpdateDatabaseRowTool = defineTool({
    name: "notion_create_or_update_database_row",
    inputSchema: notionCreateOrUpdateDatabaseRowInputSchema,
    outputSchema: notionDatabaseRowMutationResultSchema
})

export const notionModifyBlocksTool = defineTool({
    name: "notion_modify_blocks",
    inputSchema: notionModifyBlocksInputSchema,
    outputSchema: z.union([notionModifyBlocksSuccessSchema, notionModifyBlocksFailureSchema])
})

export const notionQueryPageTool = defineTool({
    name: "notion_query_page",
    inputSchema: notionQueryPageInputSchema,
    outputSchema: notionPageQueryMetadataSchema.extend({
        success: z.literal(true),
        actions: z.array(runHistoryActionBaseSchema).optional(),
        properties: z.record(z.string(), notionReadablePropertyValueSchema),
        properties_raw: z.record(z.string(), z.unknown()).optional(),
        blocks: z.array(notionPageBlockSchema),
        blocks_count: z.number().int()
    })
})

export const notionQueryDatabaseTool = defineTool({
    name: "notion_query_database",
    inputSchema: notionQueryDatabaseInputSchema,
    outputSchema: z.discriminatedUnion("success", [notionQueryDatabaseSuccessSchema, notionQueryDatabaseFailureSchema])
})

export const notionGetSchemaTool = defineTool({
    name: "notion_get_schema",
    inputSchema: notionGetSchemaInputSchema,
    outputSchema: toolOutputSuccessSchema.extend({
        data_source_id: z.string(),
        database_name: z.string(),
        schema: z.record(z.string(), notionSchemaPropertySchema),
        property_count: z.number().int()
    })
})

export const notionListUsersTool = defineTool({
    name: "notion_list_users",
    inputSchema: notionListUsersInputSchema,
    outputSchema: toolOutputSuccessSchema.extend({
        users: z.array(notionWorkspaceUserSchema),
        count: z.number().int()
    })
})

export const gmailSendEmailTool = defineTool({
    name: "gmail_send_email",
    inputSchema: gmailSendEmailInputSchema,
    outputSchema: toolOutputSuccessSchema.merge(gmailSendSummarySchema)
})

export const gmailCreateDraftTool = defineTool({
    name: "gmail_create_draft",
    inputSchema: gmailCreateDraftInputSchema,
    outputSchema: toolOutputSuccessSchema.merge(gmailDraftSummarySchema)
})

export const searchPosthogSessionsTool = defineTool({
    name: "searchPosthogSessions",
    inputSchema: searchPosthogSessionsInputSchema,
    outputSchema: z.union([posthogSearchSessionsFoundSchema, posthogSearchSessionsNotFoundSchema])
})

export const searchPosthogLogsTool = defineTool({
    name: "searchPosthogLogs",
    inputSchema: searchPosthogLogsInputSchema,
    outputSchema: toolOutputSuccessSchema.extend({
        userEmail: z.string().nullable(),
        severityLevels: z.array(posthogSeverityLevelSchema).nullable(),
        messageSearch: z.string().nullable(),
        projectId: z.string(),
        totalLogs: z.number().int(),
        logs: z.array(posthogLogEntrySchema),
        logsLink: z.string(),
        pagination: posthogOffsetPaginationSchema,
        message: z.string()
    })
})

export const getPosthogSessionEventsTool = defineTool({
    name: "getPosthogSessionEvents",
    inputSchema: getPosthogSessionEventsInputSchema,
    outputSchema: toolOutputSuccessSchema.extend({
        sessionId: z.string(),
        sessionUrl: z.string(),
        startTime: z.string(),
        duration: z.number().optional(),
        timeWindow: posthogSessionEventsTimeWindowSchema,
        summary: posthogSessionEventsSummarySchema,
        events: z.array(posthogSessionEventSchema),
        consoleLogs: z.array(posthogSessionConsoleLogSchema),
        message: z.string()
    })
})

export const listPosthogEventNamesTool = defineTool({
    name: "listPosthogEventNames",
    inputSchema: listPosthogEventNamesInputSchema,
    outputSchema: toolOutputSuccessSchema.extend({
        eventCounts: z.array(posthogEventCountSchema),
        totalEventTypes: z.number().int(),
        eventsLink: z.string()
    })
})

export const searchPosthogEventsTool = defineTool({
    name: "searchPosthogEvents",
    inputSchema: searchPosthogEventsInputSchema,
    outputSchema: toolOutputSuccessSchema.extend({
        events: z.array(posthogEventSummarySchema),
        totalEvents: z.number().int(),
        hasMore: z.boolean(),
        nextCursor: z.string().nullable(),
        eventsLink: z.string()
    })
})

// Datadog schemas
export const datadogLogEntrySchema = z.object({
    id: z.string(),
    timestamp: z.string().optional(),
    message: z.string().optional(),
    host: z.string().optional(),
    service: z.string().optional(),
    status: z.string().optional(),
    tags: z.array(z.string()),
    customAttributes: z.record(z.string(), z.unknown())
})

export const datadogCursorPaginationSchema = z.object({
    limit: z.number().int(),
    cursor: z.string().nullable().optional(),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    showing: z.string()
})

export const datadogPagePaginationSchema = datadogCursorPaginationSchema.omit({ cursor: true })

export const datadogRumSessionDetailsSchema = z.object({
    id: z.string().optional(),
    type: z.string().optional(),
    hasReplay: z.boolean().optional(),
    duration: z.number().optional()
})

export const datadogRumViewDetailsSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    url: z.string().optional(),
    loadTime: z.number().optional(),
    timeSpent: z.number().optional()
})

export const datadogRumActionDetailsSchema = z.object({
    id: z.string().optional(),
    type: z.string().optional(),
    target: z.string().optional(),
    loadingTime: z.number().optional()
})

export const datadogRumErrorDetailsSchema = z.object({
    id: z.string().optional(),
    message: z.string().optional(),
    source: z.string().optional(),
    stack: z.string().optional(),
    type: z.string().optional()
})

export const datadogRumResourceDetailsSchema = z.object({
    id: z.string().optional(),
    type: z.string().optional(),
    url: z.string().optional(),
    method: z.string().optional(),
    statusCode: z.number().int().optional(),
    duration: z.number().optional()
})

export const datadogRumLongTaskDetailsSchema = z.object({
    id: z.string().optional(),
    duration: z.number().optional()
})

export const datadogRumEventSchema = z.object({
    id: z.string(),
    type: z.string(),
    timestamp: z.string().optional(),
    session: datadogRumSessionDetailsSchema.optional(),
    view: z.union([datadogRumViewDetailsSchema, z.record(z.string(), z.unknown())]).optional(),
    action: datadogRumActionDetailsSchema.optional(),
    error: datadogRumErrorDetailsSchema.optional(),
    resource: datadogRumResourceDetailsSchema.optional(),
    longTask: datadogRumLongTaskDetailsSchema.optional(),
    service: z.string().optional(),
    version: z.string().optional(),
    environment: z.string().optional(),
    device: z.record(z.string(), z.unknown()).optional(),
    os: z.record(z.string(), z.unknown()).optional(),
    browser: z.record(z.string(), z.unknown()).optional(),
    user: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string()),
    customAttributes: z.record(z.string(), z.unknown())
})

export const datadogAggregationBucketComputeSchema = z.object({
    value: z.unknown(),
    aggregation: z.string(),
    metric: z.string()
})

export const datadogAggregationBucketSchema = z.object({
    by: z.record(z.string(), z.unknown()),
    computes: z.record(z.string(), datadogAggregationBucketComputeSchema)
})

export const datadogAggregationMetaSchema = z.object({
    elapsed: z.number().optional(),
    requestId: z.string().optional(),
    status: z.unknown().optional()
})

export const datadogAggregationComputeSchema = z.object({
    aggregation: z.enum(["count", "pc90", "pc95", "pc99", "avg", "sum", "min", "max", "cardinality"]).describe("Aggregation: count, pc90/pc95/pc99, avg, sum, min, max, cardinality"),
    metric: z.string().describe('Metric to compute (e.g., @view.loading_time, @duration). Use "*" for count of all events.'),
    type: z.enum(["total", "timeseries"]).default("total").describe('Computation type: "total" (overall) or "timeseries" (time-bucketed)')
})

export const datadogAggregationGroupBySchema = z.object({
    facet: z.string().describe("Facet to group by (e.g., @view.name, @service, @browser.name)"),
    limit: z.number().int().default(10).describe("Maximum number of groups to return (default: 10)"),
    total: z.boolean().default(false).describe('Include "total" group with all events combined (default: false)')
})

// Datadog input schemas
export const searchDatadogLogsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Datadog skill to use."),
    defaultIndexes: z
        .union([z.array(z.string()), z.null()])
        .optional()
        .describe('Default log indexes to search (e.g., ["main"]). Falls back to ["main"] if not provided.'),
    query: z.string().nullable().optional().describe("Datadog log search query (e.g., service:web AND @status:error)"),
    indexes: z
        .union([z.array(z.string()), z.null()])
        .optional()
        .describe('Log indexes to search (e.g., ["main"]). Defaults to defaultIndexes if not provided.'),
    from: z.string().nullable().optional().describe('Start time (ISO8601 or relative like "now-1h")'),
    to: z.string().nullable().optional().describe("End time (ISO8601). Defaults to now if not provided."),
    limit: z.number().int().default(50).describe("Maximum number of log entries to return (default: 50)"),
    cursor: z.string().nullable().optional().describe("Pagination cursor from previous response"),
    sort: z.enum(["timestamp", "-timestamp"]).default("timestamp").describe('Sort order: "timestamp" (ascending) or "-timestamp" (descending)')
})

export const searchRumEventsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Datadog skill to use."),
    query: z.string().nullable().optional().describe("Datadog RUM search query (e.g., @type:error AND @error.source:network)"),
    from: z.string().describe('Start time (ISO8601 or relative like "now-15m")'),
    to: z.string().nullable().optional().describe('End time (ISO8601). Defaults to "now" if not provided.'),
    limit: z.number().int().default(25).describe("Maximum number of RUM events to return (default: 25, max: 1000)"),
    pageCursor: z.string().nullable().optional().describe("Pagination cursor from previous response"),
    sort: z.enum(["timestamp", "-timestamp"]).default("timestamp").describe('Sort order: "timestamp" (ascending) or "-timestamp" (descending)'),
    timezone: z.string().default("GMT").describe('Timezone for time-based queries (default: "GMT")')
})

export const listRumEventsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Datadog skill to use."),
    query: z.string().nullable().optional().describe("Datadog RUM search query to filter events (e.g., @type:view)"),
    from: z.string().nullable().optional().describe('Minimum timestamp (ISO8601 only, e.g., "2020-09-17T11:48:36+01:00")'),
    to: z.string().nullable().optional().describe("Maximum timestamp (ISO8601 only). Defaults to now if not provided."),
    limit: z.number().int().default(25).describe("Maximum number of RUM events to return (default: 25, max: 1000)"),
    pageCursor: z.string().nullable().optional().describe("Pagination cursor from previous response"),
    sort: z.enum(["timestamp", "-timestamp"]).default("timestamp").describe('Sort order: "timestamp" (ascending) or "-timestamp" (descending)')
})

export const aggregateRumEventsInputSchema = z.object({
    query: z.string().nullable().optional().describe("Datadog RUM search query to filter events before aggregation (e.g., @type:view)"),
    from: z.string().describe('Start time (ISO8601 or relative like "now-15m")'),
    to: z.string().nullable().optional().describe('End time (ISO8601). Defaults to "now" if not provided.'),
    compute: z.array(datadogAggregationComputeSchema).describe("Array of metrics to compute. At least one required."),
    groupBy: z.union([z.array(datadogAggregationGroupBySchema), z.null()]).describe("Facets to group results by"),
    timezone: z.string().default("GMT").describe('Timezone for time-based queries (default: "GMT")'),
    pageLimit: z.number().int().default(25).describe("Maximum number of buckets to return (default: 25)"),
    integrationId: z.string().describe("The integration ID of the Datadog skill to use.")
})

// Terse tool schemas
export const webExtractResultItemSchema = z.object({
    url: z.string(),
    raw_content: z.string()
})

export const webExtractOutputSchema = z.object({
    results: z.array(webExtractResultItemSchema),
    failed_results: z.unknown()
})

export const webResearchSourceSchema = z.object({
    title: z.string(),
    url: z.string()
})

export const webResearchOutputSchema = toolOutputBaseSchema.extend({
    status: z.literal("completed"),
    request_id: z.string(),
    content: z.string().optional(),
    sources: z.array(webResearchSourceSchema).optional()
})

export const imageEditSnippetSchema = z.object({
    type: z.literal("image"),
    url: z.string()
})

export const imageEditOutputSchema = toolOutputBaseSchema.extend({
    url: z.string(),
    image_url: z.string(),
    summary: z.string(),
    snippets: z.array(imageEditSnippetSchema)
})

// Terse input schemas
export const webExtractInputSchema = z.object({
    urls: z.union([z.string(), z.array(z.string())]).describe("URL or list of URLs to extract content from"),
    extract_depth: z.enum(["basic", "advanced"]).nullable().describe("'advanced' handles JavaScript-heavy pages but is slower")
})

export const webResearchInputSchema = z.object({
    input: z.string().describe("The research question or topic to investigate"),
    model: z.enum(["mini", "pro", "auto"]).nullable().describe("'mini' for quick focused research, 'pro' for comprehensive multi-angle research, 'auto' picks automatically")
})

export const imageEditInputSchema = z.object({
    image_url: z.string().describe("URL of the image to edit. Must be a signed URL from our internal GCS image bucket."),
    prompt: z.string().describe("Natural language instruction describing how to edit the image.")
})

export const searchDatadogLogsTool = defineTool({
    name: "searchDatadogLogs",
    inputSchema: searchDatadogLogsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        query: z.string().nullable(),
        indexes: z.array(z.string()),
        totalLogs: z.number().int(),
        logs: z.array(datadogLogEntrySchema),
        logsLink: z.string(),
        pagination: datadogCursorPaginationSchema,
        warnings: z.string().nullable(),
        message: z.string()
    })
})

export const searchRumEventsTool = defineTool({
    name: "searchRumEvents",
    inputSchema: searchRumEventsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        query: z.string().nullable(),
        totalEvents: z.number().int(),
        events: z.array(datadogRumEventSchema),
        eventsByType: z.record(z.string(), z.number().int()),
        rumLink: z.string(),
        pagination: datadogCursorPaginationSchema,
        warnings: z.string().nullable(),
        message: z.string()
    })
})

export const listRumEventsTool = defineTool({
    name: "listRumEvents",
    inputSchema: listRumEventsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        query: z.string().nullable(),
        totalEvents: z.number().int(),
        events: z.array(datadogRumEventSchema),
        eventsByType: z.record(z.string(), z.number().int()),
        rumLink: z.string(),
        pagination: datadogCursorPaginationSchema,
        warnings: z.string().nullable(),
        message: z.string()
    })
})

export const aggregateRumEventsTool = defineTool({
    name: "aggregateRumEvents",
    inputSchema: aggregateRumEventsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        query: z.string().nullable(),
        from: z.string(),
        to: z.string().nullable(),
        compute: z.string(),
        groupBy: z.string(),
        totalBuckets: z.number().int(),
        buckets: z.array(datadogAggregationBucketSchema),
        rumLink: z.string(),
        pagination: datadogPagePaginationSchema,
        warnings: z.string().nullable(),
        meta: datadogAggregationMetaSchema,
        message: z.string()
    })
})

export const webExtractTool = defineTool({
    name: "web_extract",
    inputSchema: webExtractInputSchema,
    outputSchema: webExtractOutputSchema
})

export const webResearchTool = defineTool({
    name: "web_research",
    inputSchema: webResearchInputSchema,
    outputSchema: webResearchOutputSchema
})

export const imageEditTool = defineTool({
    name: "image_edit",
    inputSchema: imageEditInputSchema,
    outputSchema: imageEditOutputSchema
})

// Attio schemas
export const attioObjectSchema = z.object({
    id: z.object({
        workspace_id: z.string(),
        object_id: z.string()
    }),
    api_slug: z.string(),
    singular_noun: z.string(),
    plural_noun: z.string()
})

export const attioAttributeSchema = z
    .object({
        api_slug: z.string().optional(),
        title: z.string().optional(),
        type: z.string().optional(),
        is_required: z.boolean().optional(),
        is_unique: z.boolean().optional(),
        is_multiselect: z.boolean().optional(),
        /** Active option/status titles, populated for select and status attributes when fetched for codegen. */
        options: z.array(z.string()).optional()
    })
    .catchall(z.unknown())

export const attioObjectWithAttributesSchema = attioObjectSchema.extend({
    attributes: z.array(attioAttributeSchema).optional()
})

export const attioRecordIdentifierSchema = z
    .object({
        workspace_id: z.string().optional(),
        object_id: z.string().optional(),
        record_id: z.string().optional()
    })
    .catchall(z.unknown())

export const attioRecordSchema = z
    .object({
        id: attioRecordIdentifierSchema.optional(),
        values: z.record(z.string(), z.unknown()).optional(),
        web_url: z.string().optional(),
        created_at: z.string().optional()
    })
    .catchall(z.unknown())

export const attioSearchMatchSchema = z
    .object({
        id: attioRecordIdentifierSchema.optional(),
        record_text: z.string().optional(),
        object_slug: z.string().optional()
    })
    .catchall(z.unknown())

export const attioAttributeHistoryEntrySchema = z
    .object({
        active_from: z.string(),
        active_until: z.string().nullable(),
        attribute_type: z.string().optional()
    })
    .catchall(z.unknown())

export const attioTaskSchema = z
    .object({
        id: z.object({ workspace_id: z.string(), task_id: z.string() }),
        content_plaintext: z.string(),
        deadline_at: z.string().nullable(),
        is_completed: z.boolean(),
        linked_records: z.array(z.object({ target_object_id: z.string(), target_record_id: z.string() }).catchall(z.unknown())),
        assignees: z.array(z.object({ referenced_actor_type: z.string(), referenced_actor_id: z.string().nullable() }).catchall(z.unknown())),
        created_at: z.string()
    })
    .catchall(z.unknown())

export const attioNoteSchema = z
    .object({
        id: z.object({ workspace_id: z.string(), note_id: z.string() }),
        parent_object: z.string(),
        parent_record_id: z.string(),
        title: z.string(),
        content_plaintext: z.string().nullable(),
        content_markdown: z.string().nullable(),
        created_at: z.string()
    })
    .catchall(z.unknown())

export const attioCommentSchema = z
    .object({
        id: z.object({ workspace_id: z.string(), comment_id: z.string() }),
        thread_id: z.string(),
        content_plaintext: z.string(),
        author: z.record(z.string(), z.unknown()),
        resolved_at: z.string().nullable(),
        created_at: z.string()
    })
    .catchall(z.unknown())

export const attioThreadSchema = z
    .object({
        id: z.object({ workspace_id: z.string(), thread_id: z.string() }),
        comments: z.array(attioCommentSchema),
        created_at: z.string()
    })
    .catchall(z.unknown())

export const attioListSchema = z
    .object({
        id: z.object({ workspace_id: z.string(), list_id: z.string() }),
        api_slug: z.string(),
        name: z.string(),
        parent_object: z.array(z.string()).or(z.string()),
        created_at: z.string(),
        /** Synthesized by Terse from the workspace slug; the Attio API does not return list URLs. */
        web_url: z.string().optional()
    })
    .catchall(z.unknown())

export const attioListEntrySchema = z
    .object({
        id: z.object({ workspace_id: z.string(), list_id: z.string(), entry_id: z.string() }),
        parent_record_id: z.string(),
        parent_object: z.string(),
        entry_values: z.record(z.string(), z.unknown()),
        created_at: z.string()
    })
    .catchall(z.unknown())

export const attioMeetingTimeSchema = z
    .object({
        datetime: z.string().optional(),
        timezone: z.string().nullable().optional(),
        date: z.string().optional()
    })
    .catchall(z.unknown())

export const attioMeetingSchema = z
    .object({
        id: z.object({ workspace_id: z.string(), meeting_id: z.string() }),
        title: z.string().nullable(),
        description: z.string().nullable().optional(),
        is_all_day: z.boolean().optional(),
        start: attioMeetingTimeSchema.optional(),
        end: attioMeetingTimeSchema.optional(),
        participants: z.array(z.record(z.string(), z.unknown())),
        linked_records: z.array(z.record(z.string(), z.unknown())),
        created_at: z.string()
    })
    .catchall(z.unknown())

export const attioStatusSchema = z
    .object({
        id: z.object({ workspace_id: z.string().optional(), object_id: z.string().optional(), attribute_id: z.string().optional(), status_id: z.string().optional() }).catchall(z.unknown()),
        title: z.string(),
        is_archived: z.boolean()
    })
    .catchall(z.unknown())

export const attioSelectOptionEntitySchema = z
    .object({
        id: z.object({ workspace_id: z.string().optional(), object_id: z.string().optional(), attribute_id: z.string().optional(), option_id: z.string().optional() }).catchall(z.unknown()),
        title: z.string(),
        is_archived: z.boolean()
    })
    .catchall(z.unknown())

export const attioCallRecordingSchema = z
    .object({
        id: z.object({ workspace_id: z.string(), meeting_id: z.string(), call_recording_id: z.string() }),
        status: z.string(),
        created_at: z.string()
    })
    .catchall(z.unknown())

export const attioTranscriptSpeechSchema = z
    .object({
        speech: z.string(),
        start_time: z.number().optional(),
        end_time: z.number().optional()
    })
    .catchall(z.unknown())

export const attioTranscriptSchema = z
    .object({
        id: z.object({ workspace_id: z.string(), meeting_id: z.string(), call_recording_id: z.string() }).optional(),
        transcript: z.array(attioTranscriptSpeechSchema)
    })
    .catchall(z.unknown())

export const attioFileSchema = z
    .object({
        id: z.record(z.string(), z.unknown()),
        name: z.string(),
        content_type: z.string().nullable().optional(),
        content_size: z.number().nullable().optional(),
        record_id: z.string().optional(),
        object_slug: z.string().optional(),
        created_at: z.string()
    })
    .catchall(z.unknown())

export const attioWorkspaceMemberSchema = z
    .object({
        id: z.object({
            workspace_id: z.string(),
            workspace_member_id: z.string()
        }),
        first_name: z.string().nullable(),
        last_name: z.string().nullable(),
        avatar_url: z.string().nullable(),
        email_address: z.string(),
        access_level: z.string(),
        created_at: z.string()
    })
    .catchall(z.unknown())

// WorkOS schemas
export const workOSUserSummarySchema = z.object({
    id: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    profilePictureUrl: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string()
})

export const workOSOrganizationSummarySchema = z.object({
    id: z.string(),
    name: z.string(),
    externalId: z.string().nullable().optional(),
    domains: z.array(z.string()),
    createdAt: z.string(),
    updatedAt: z.string()
})

export const workOSPaginationSchema = z.object({
    hasMore: z.boolean(),
    after: z.string().nullable().optional()
})

// LaunchDarkly schemas
export const launchDarklyFlagSummarySchema = z.object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    environments: z.record(z.string(), z.boolean()),
    url: z.string(),
    environmentUrls: z.record(z.string(), z.string())
})

export const launchDarklyFlagMetadataSchema = z.object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    kind: z.string(),
    variations: z.array(z.record(z.string(), z.unknown())),
    tags: z.array(z.string()),
    maintainerId: z.string().nullable()
})

export const launchDarklyEnvironmentConfigSchema = z.object({
    on: z.boolean(),
    targets: z.array(z.record(z.string(), z.unknown())),
    contextTargets: z.array(z.record(z.string(), z.unknown())),
    rules: z.array(z.record(z.string(), z.unknown())),
    fallthrough: z.record(z.string(), z.unknown()).nullable(),
    offVariation: z.number().int().nullable(),
    prerequisites: z.array(z.record(z.string(), z.unknown()))
})

export const launchDarklyHistoryEntrySchema = z.object({
    id: z.string(),
    timestamp: z.string(),
    kind: z.string(),
    key: z.string(),
    name: z.string(),
    description: z.string(),
    member: z.record(z.string(), z.unknown()).nullable(),
    changes: z.array(z.record(z.string(), z.unknown()))
})

export const launchDarklyHistoryResultSchema = z.object({
    entries: z.array(launchDarklyHistoryEntrySchema),
    totalEntries: z.number().int(),
    url: z.string()
})

// Snowflake schemas
export const snowflakeQueryRowSchema = z.record(z.string(), z.unknown())

// Attio input schemas
const attioObjectSlugField = z.string().describe("The Attio object type slug (e.g. 'people', 'companies').")
const attioRecordIdField = z.string().describe("The record ID (UUID).")

export const attioQueryRecordsRequestSchema = z.object({
    action: z.literal("query").describe("List records of an object, with optional filtering and limit/offset pagination."),
    objectSlug: attioObjectSlugField,
    filter: z
        .string()
        .nullable()
        .describe(
            'Optional Attio filter as a JSON string. Use shorthand (e.g. \'{"email_addresses":"test@example.com"}\') or verbose syntax with operators ($eq, $contains, $starts_with, $ends_with) combined via $and/$or. Pass null for no filtering.'
        ),
    limit: z.number().int().nullable().describe("Maximum number of records to return (default 20, max 500). Pass null for the default."),
    offset: z.number().int().nullable().describe("Number of records to skip, for pagination. Pass null for 0.")
})

export const attioSearchRecordsRequestSchema = z.object({
    action: z
        .literal("search")
        .describe(
            "Fuzzy-search records following Attio's in-product matching: names/domains/emails/phones on people and companies, the record label on other objects (e.g. deal names). Query with a distinctive substring of the target; extra tokens that are not in the record's name can prevent matches. Results are eventually consistent (a just-created record may not be indexed yet) — use 'query' for read-after-write."
        ),
    objectSlug: attioObjectSlugField,
    query: z.string().describe("The search term, matched fuzzily against record names, email addresses and domains (max 256 chars)."),
    limit: z.number().int().nullable().describe("Maximum number of matches to return (default and max 25). Pass null for the default.")
})

export const attioGetRecordRequestSchema = z.object({
    action: z.literal("get").describe("Fetch a single record by its ID."),
    objectSlug: attioObjectSlugField,
    recordId: attioRecordIdField
})

export const attioCreateRecordRequestSchema = z.object({
    action: z.literal("create").describe("Create a new record. Unlike 'upsert', no matching attribute is needed, so this works for objects without a unique writable attribute (e.g. deals)."),
    objectSlug: attioObjectSlugField,
    values: z.string().describe('A JSON object string mapping attribute slugs to values (e.g. \'{"name":"Acme","domains":["acme.com"]}\'). For multi-value attributes, pass an array.')
})

export const attioUpdateRecordRequestSchema = z.object({
    action: z.literal("update").describe("Update an existing record by its ID. Only the attributes present in 'values' are touched."),
    objectSlug: attioObjectSlugField,
    recordId: attioRecordIdField,
    values: z.string().describe("A JSON object string mapping the attribute slugs to update to their new values."),
    multiselectMode: z
        .enum(["overwrite", "append"])
        .nullable()
        .describe("'overwrite' (the default) replaces the values of multi-value attributes; 'append' adds to them without removing existing values. Pass null for the default.")
})

export const attioUpsertRecordsRequestSchema = z.object({
    action: z
        .literal("upsert")
        .describe(
            "Create or update one or more records, matched on a unique attribute. If a match is found the record is updated, otherwise a new one is created. Throws if ANY record in the batch fails, naming each failure; earlier records may already be written (upserts are safe to retry)."
        ),
    objectSlug: attioObjectSlugField,
    matchingAttribute: z.string().describe("The unique, writable attribute slug to match on (e.g. 'email_addresses' for people, 'domains' for companies)."),
    records: z
        .string()
        .describe(
            'A JSON string representing a list of records to upsert. Each record maps attribute slugs to values; for multi-value attributes pass an array. Example: \'[{"email_addresses":["test@example.com"],"name":"John"}]\'.'
        )
})

export const attioDeleteRecordRequestSchema = z.object({
    action: z.literal("delete").describe("Permanently delete a record by its ID. This cannot be undone."),
    objectSlug: attioObjectSlugField,
    recordId: attioRecordIdField
})

export const attioGetAttributeHistoryRequestSchema = z.object({
    action: z.literal("get_attribute_history").describe("Fetch the historic values of one attribute on a record (e.g. every stage a deal has been in)."),
    objectSlug: attioObjectSlugField,
    recordId: attioRecordIdField,
    attributeSlug: z.string().describe("The attribute slug to fetch the value history for."),
    limit: z.number().int().nullable().describe("Maximum number of history entries to return. Pass null for the default."),
    offset: z.number().int().nullable().describe("Number of entries to skip, for pagination. Pass null for 0.")
})

export const attioRecordsRequestSchema = z.discriminatedUnion("action", [
    attioQueryRecordsRequestSchema,
    attioSearchRecordsRequestSchema,
    attioGetRecordRequestSchema,
    attioCreateRecordRequestSchema,
    attioUpdateRecordRequestSchema,
    attioUpsertRecordsRequestSchema,
    attioDeleteRecordRequestSchema,
    attioGetAttributeHistoryRequestSchema
])

export const attioRecordsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Attio workspace to use."),
    request: attioRecordsRequestSchema.describe("The record operation to perform and its arguments.")
})

export type AttioQueryRecordsRequest = z.infer<typeof attioQueryRecordsRequestSchema>
export type AttioSearchRecordsRequest = z.infer<typeof attioSearchRecordsRequestSchema>
export type AttioGetRecordRequest = z.infer<typeof attioGetRecordRequestSchema>
export type AttioCreateRecordRequest = z.infer<typeof attioCreateRecordRequestSchema>
export type AttioUpdateRecordRequest = z.infer<typeof attioUpdateRecordRequestSchema>
export type AttioUpsertRecordsRequest = z.infer<typeof attioUpsertRecordsRequestSchema>
export type AttioDeleteRecordRequest = z.infer<typeof attioDeleteRecordRequestSchema>
export type AttioGetAttributeHistoryRequest = z.infer<typeof attioGetAttributeHistoryRequestSchema>
export type AttioRecordsRequest = z.infer<typeof attioRecordsRequestSchema>
export type AttioRecordsAction = AttioRecordsRequest["action"]


const attioTargetRecordFields = {
    objectSlug: z.string().describe("The object type slug of the record (e.g. 'people', 'companies')."),
    recordId: z.string().describe("The record ID (UUID).")
}

export const attioTasksRequestSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("list").describe("List tasks, optionally filtered by linked record, assignee or completion state."),
        linkedObjectSlug: z.string().nullable().optional().describe("Filter to tasks linked to records of this object slug. Requires linkedRecordId."),
        linkedRecordId: z.string().nullable().optional().describe("Filter to tasks linked to this record ID."),
        isCompleted: z.boolean().nullable().optional().describe("Filter by completion state. Omit for all tasks."),
        limit: z.number().int().nullable().optional().describe("Maximum tasks to return."),
        offset: z.number().int().nullable().optional().describe("Number of tasks to skip, for pagination.")
    }),
    z.object({ action: z.literal("get").describe("Fetch a single task by ID."), taskId: z.string() }),
    z.object({
        action: z.literal("create").describe("Create a task, optionally linked to records and assigned to workspace members."),
        content: z.string().describe("The task text (plaintext, max 2000 chars)."),
        deadlineAt: z.string().nullable().optional().describe("Deadline as an ISO 8601 timestamp, or null for no deadline."),
        isCompleted: z.boolean().nullable().optional().describe("Whether the task starts completed. Defaults to false."),
        assignees: z.array(z.string()).nullable().optional().describe("Workspace member email addresses or member IDs (UUIDs) to assign."),
        linkedRecords: z.array(z.object(attioTargetRecordFields)).nullable().optional().describe("Records to link the task to.")
    }),
    z.object({
        action: z.literal("update").describe("Update a task's deadline, completion state, assignees or linked records. Task content cannot be changed."),
        taskId: z.string(),
        deadlineAt: z.string().nullable().optional().describe("New deadline (ISO 8601), or null to clear."),
        isCompleted: z.boolean().nullable().optional().describe("New completion state. Omit to leave unchanged."),
        assignees: z.array(z.string()).nullable().optional().describe("Replacement assignee emails/IDs. Omit to leave unchanged."),
        linkedRecords: z.array(z.object(attioTargetRecordFields)).nullable().optional().describe("Replacement linked records. Omit to leave unchanged.")
    }),
    z.object({ action: z.literal("delete").describe("Permanently delete a task."), taskId: z.string() })
])

export const attioNotesRequestSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("list").describe("List notes, optionally scoped to one record."),
        parentObjectSlug: z.string().nullable().optional().describe("Filter to notes on records of this object slug. Requires parentRecordId."),
        parentRecordId: z.string().nullable().optional().describe("Filter to notes on this record ID."),
        limit: z.number().int().nullable().optional(),
        offset: z.number().int().nullable().optional()
    }),
    z.object({ action: z.literal("get").describe("Fetch a single note by ID."), noteId: z.string() }),
    z.object({
        action: z.literal("create").describe("Create a note on a record."),
        parentObjectSlug: z.string().describe("The object type slug of the record the note belongs to."),
        parentRecordId: z.string().describe("The record ID the note belongs to."),
        title: z.string().describe("The note title."),
        content: z.string().describe("The note body."),
        format: z.enum(["plaintext", "markdown"]).nullable().optional().describe("Content format. Defaults to markdown.")
    }),
    z.object({ action: z.literal("delete").describe("Permanently delete a note."), noteId: z.string() })
])

export const attioCommentsRequestSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("create").describe("Create a comment. Target EITHER an existing thread (threadId, to reply) OR a record (objectSlug + recordId, to start a new thread)."),
        content: z.string().describe("The comment text (plaintext)."),
        authorWorkspaceMemberId: z.string().describe("The workspace member ID the comment is authored as. Use attio_workspace_members to find it."),
        threadId: z.string().nullable().optional().describe("Reply to this thread. Pass null/omit when commenting on a record."),
        objectSlug: z.string().nullable().optional().describe("With recordId: start a new comment thread on this record."),
        recordId: z.string().nullable().optional()
    }),
    z.object({ action: z.literal("get").describe("Fetch a single comment by ID."), commentId: z.string() }),
    z.object({ action: z.literal("delete").describe("Permanently delete a comment."), commentId: z.string() }),
    z.object({
        action: z.literal("list_threads").describe("List comment threads on a record."),
        objectSlug: z.string().nullable().optional().describe("With recordId: threads on this record."),
        recordId: z.string().nullable().optional(),
        limit: z.number().int().nullable().optional(),
        offset: z.number().int().nullable().optional()
    }),
    z.object({ action: z.literal("get_thread").describe("Fetch a thread with all of its comments."), threadId: z.string() })
])

export const attioListsRequestSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("list").describe("List all lists in the workspace.") }),
    z.object({ action: z.literal("get").describe("Fetch a list's configuration by ID or slug."), listIdOrSlug: z.string() }),
    z.object({
        action: z.literal("create").describe("Create a new list over an object."),
        name: z.string().describe("Display name of the list."),
        apiSlug: z.string().describe("Unique slug for the list (snake_case)."),
        parentObjectSlug: z.string().describe("The object the list contains records of (e.g. 'companies')."),
        workspaceAccess: z.enum(["full-access", "read-and-write", "read-only"]).nullable().optional().describe("Workspace-wide access level. Defaults to full-access.")
    }),
    z.object({ action: z.literal("update").describe("Rename a list."), listIdOrSlug: z.string(), name: z.string() }),
    z.object({
        action: z.literal("query_entries").describe("List entries in a list, with optional filter, parent-record lookup, and limit/offset pagination."),
        listIdOrSlug: z.string(),
        filter: z.string().nullable().optional().describe("Optional Attio filter as a JSON string, matching entry attributes."),
        parentRecordId: z.string().nullable().optional().describe("Only return entries whose parent record has this ID. Requires parentObjectSlug."),
        parentObjectSlug: z.string().nullable().optional().describe("Object slug of the parent record (e.g. 'companies'); required with parentRecordId."),
        limit: z.number().int().nullable().optional().describe("Maximum entries to return (max 500)."),
        offset: z.number().int().nullable().optional()
    }),
    z.object({
        action: z.literal("add_entry").describe("Add a record to a list as a new entry. Throws on unique-attribute conflicts; the same record may appear in multiple entries."),
        listIdOrSlug: z.string(),
        parentObjectSlug: z.string().describe("Object slug of the record being added."),
        parentRecordId: z.string().describe("Record ID being added."),
        entryValues: z.string().nullable().optional().describe("Optional JSON object string of entry attribute values (e.g. a stage).")
    }),
    z.object({
        action: z.literal("upsert_entry").describe("Create or update a list entry keyed by its parent record: updates the existing entry if the record is already in the list, otherwise adds it."),
        listIdOrSlug: z.string(),
        parentObjectSlug: z.string(),
        parentRecordId: z.string(),
        entryValues: z.string().nullable().optional().describe("Optional JSON object string of entry attribute values.")
    }),
    z.object({ action: z.literal("get_entry").describe("Fetch a single list entry."), listIdOrSlug: z.string(), entryId: z.string() }),
    z.object({
        action: z.literal("update_entry").describe("Update a list entry's attribute values (e.g. move stage)."),
        listIdOrSlug: z.string(),
        entryId: z.string(),
        entryValues: z.string().describe("JSON object string mapping entry attribute slugs to new values."),
        multiselectMode: z.enum(["overwrite", "append"]).nullable().optional().describe("'overwrite' (default) replaces multi-value attribute values; 'append' adds to them.")
    }),
    z.object({ action: z.literal("remove_entry").describe("Remove an entry from a list. The parent record itself is untouched."), listIdOrSlug: z.string(), entryId: z.string() })
])

export const attioMeetingsRequestSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("list").describe("List meetings, optionally filtered by linked record, participants or time range. Uses cursor pagination."),
        linkedObjectSlug: z.string().nullable().optional(),
        linkedRecordId: z.string().nullable().optional(),
        participants: z.string().nullable().optional().describe("Comma-separated participant email addresses."),
        startsBefore: z.string().nullable().optional().describe("Only meetings starting before this ISO timestamp."),
        endsFrom: z.string().nullable().optional().describe("Only meetings ending at/after this ISO timestamp."),
        limit: z.number().int().nullable().optional().describe("Maximum meetings to return (max 200)."),
        cursor: z.string().nullable().optional().describe("Pagination cursor from a previous response's nextCursor.")
    }),
    z.object({ action: z.literal("get").describe("Fetch a single meeting by ID."), meetingId: z.string() }),
    z.object({
        action: z.literal("list_recordings").describe("List call recordings for a meeting."),
        meetingId: z.string(),
        limit: z.number().int().nullable().optional(),
        cursor: z.string().nullable().optional()
    }),
    z.object({
        action: z.literal("get_transcript").describe("Fetch the transcript of a call recording."),
        meetingId: z.string(),
        callRecordingId: z.string(),
        cursor: z.string().nullable().optional()
    })
])

export const attioFilesRequestSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("list").describe("List files attached to a record."),
        objectSlug: z.string().describe("Object slug of the record."),
        recordId: z.string().describe("Record ID."),
        limit: z.number().int().nullable().optional(),
        cursor: z.string().nullable().optional()
    }),
    z.object({ action: z.literal("get").describe("Fetch a file's metadata by ID."), fileId: z.string() }),
    z.object({
        action: z.literal("upload").describe("Upload a file to a record (native Attio storage, max 50 MB)."),
        objectSlug: z.string(),
        recordId: z.string(),
        fileName: z.string().describe("File name including extension."),
        contentBase64: z.string().describe("The file content, base64-encoded."),
        contentType: z.string().nullable().optional().describe("MIME type. Defaults to application/octet-stream.")
    }),
    z.object({ action: z.literal("get_download_url").describe("Get a signed download URL for a file."), fileId: z.string() }),
    z.object({ action: z.literal("delete").describe("Permanently delete a file (deleting a folder deletes its descendants)."), fileId: z.string() })
])

const attioSchemaTargetFields = {
    target: z.enum(["objects", "lists"]).describe("Whether the attribute lives on an object or a list."),
    identifier: z.string().describe("The object slug (e.g. 'deals') or list ID/slug the attribute belongs to.")
}

export const attioSchemaRequestSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("list_objects").describe("List all object types in the workspace with their attributes and field definitions. Call this before creating or updating records.") }),
    z.object({ action: z.literal("get_object").describe("Fetch one object's configuration."), objectSlug: z.string() }),
    z.object({
        action: z.literal("create_object").describe("Create a custom object type. This changes the workspace schema for every user."),
        apiSlug: z.string().describe("Unique slug (snake_case)."),
        singularNoun: z.string().describe("Singular display name (e.g. 'Ticket')."),
        pluralNoun: z.string().describe("Plural display name (e.g. 'Tickets').")
    }),
    z.object({
        action: z.literal("update_object").describe("Update an object's slug or display names."),
        objectSlug: z.string(),
        newApiSlug: z.string().nullable().optional(),
        singularNoun: z.string().nullable().optional(),
        pluralNoun: z.string().nullable().optional()
    }),
    z.object({ action: z.literal("list_attributes").describe("List the attributes defined on an object or list."), ...attioSchemaTargetFields }),
    z.object({
        action: z.literal("create_attribute").describe("Create a new attribute on an object or list. This changes the workspace schema for every user."),
        ...attioSchemaTargetFields,
        title: z.string().describe("Display name of the attribute."),
        apiSlug: z.string().describe("Unique attribute slug (snake_case)."),
        attributeType: z
            .string()
            .describe(
                "Attio attribute type, e.g. 'text', 'number', 'checkbox', 'currency', 'date', 'timestamp', 'rating', 'status', 'select', 'record-reference', 'actor-reference', 'location', 'domain', 'email-address', 'phone-number'."
            ),
        isRequired: z.boolean().nullable().optional().describe("Whether a value is required. Defaults to false."),
        isUnique: z.boolean().nullable().optional().describe("Whether values must be unique. Defaults to false."),
        isMultiselect: z.boolean().nullable().optional().describe("Whether the attribute holds multiple values. Defaults to false."),
        config: z.string().nullable().optional().describe('Optional JSON object string for type-specific config, e.g. \'{"record_reference":{"allowed_objects":["people"]}}\'.')
    }),
    z.object({
        action: z.literal("update_attribute").describe("Update an attribute's title or constraints."),
        ...attioSchemaTargetFields,
        attributeSlug: z.string(),
        title: z.string().nullable().optional(),
        isRequired: z.boolean().nullable().optional()
    }),
    z.object({ action: z.literal("list_statuses").describe("List the statuses of a status attribute (e.g. deal stages)."), ...attioSchemaTargetFields, attributeSlug: z.string() }),
    z.object({
        action: z.literal("create_status").describe("Add a new status to a status attribute. Rerun terse generate afterwards to refresh generated constants."),
        ...attioSchemaTargetFields,
        attributeSlug: z.string(),
        title: z.string().describe("The status title.")
    }),
    z.object({
        action: z.literal("update_status").describe("Rename or archive a status."),
        ...attioSchemaTargetFields,
        attributeSlug: z.string(),
        statusId: z.string().describe("The status ID (UUID)."),
        title: z.string().nullable().optional(),
        isArchived: z.boolean().nullable().optional()
    }),
    z.object({ action: z.literal("list_select_options").describe("List the options of a select attribute."), ...attioSchemaTargetFields, attributeSlug: z.string() }),
    z.object({
        action: z.literal("create_select_option").describe("Add an option to a select attribute. Rerun terse generate afterwards to refresh generated constants."),
        ...attioSchemaTargetFields,
        attributeSlug: z.string(),
        title: z.string().describe("The option title.")
    }),
    z.object({
        action: z.literal("update_select_option").describe("Rename or archive a select option."),
        ...attioSchemaTargetFields,
        attributeSlug: z.string(),
        optionId: z.string().describe("The option ID (UUID)."),
        title: z.string().nullable().optional(),
        isArchived: z.boolean().nullable().optional()
    })
])

export type AttioTasksRequest = z.infer<typeof attioTasksRequestSchema>
export type AttioNotesRequest = z.infer<typeof attioNotesRequestSchema>
export type AttioCommentsRequest = z.infer<typeof attioCommentsRequestSchema>
export type AttioListsRequest = z.infer<typeof attioListsRequestSchema>
export type AttioMeetingsRequest = z.infer<typeof attioMeetingsRequestSchema>
export type AttioFilesRequest = z.infer<typeof attioFilesRequestSchema>
export type AttioSchemaRequest = z.infer<typeof attioSchemaRequestSchema>

export const attioListWorkspaceMembersRequestSchema = z.object({
    action: z
        .literal("list")
        .describe("List every workspace member (name, email address, access level). Use to resolve a record's owner to a person, or to find the ID/email to write into an actor-reference attribute.")
})

export const attioGetWorkspaceMemberRequestSchema = z.object({
    action: z.literal("get").describe("Fetch a single workspace member by ID (e.g. the referenced_actor_id of a record's owner value)."),
    workspaceMemberId: z.string().describe("The workspace member ID (UUID).")
})

export const attioWorkspaceMembersRequestSchema = z.discriminatedUnion("action", [attioListWorkspaceMembersRequestSchema, attioGetWorkspaceMemberRequestSchema])

export const attioWorkspaceMembersInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Attio workspace to use."),
    request: attioWorkspaceMembersRequestSchema.describe("The workspace-member operation to perform and its arguments.")
})

export type AttioListWorkspaceMembersRequest = z.infer<typeof attioListWorkspaceMembersRequestSchema>
export type AttioGetWorkspaceMemberRequest = z.infer<typeof attioGetWorkspaceMemberRequestSchema>
export type AttioWorkspaceMembersRequest = z.infer<typeof attioWorkspaceMembersRequestSchema>

// WorkOS input schemas
export const listWorkOSUsersInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the WorkOS skill to use."),
    email: z.string().nullable().optional().describe("Optional exact email address filter. Omit or pass null to list all users."),
    organizationId: z.string().nullable().optional().describe("Optional WorkOS organization ID filter. Omit or pass null for all organizations."),
    limit: z.number().int().default(20).describe("Maximum number of users to return (default: 20, max: 100)."),
    after: z.string().nullable().optional().describe("Optional pagination cursor. Use the 'after' value from a previous response to get the next page.")
})

export const listWorkOSOrganizationsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the WorkOS skill to use."),
    limit: z.number().int().default(20).describe("Maximum number of organizations to return (default: 20, max: 100)."),
    after: z.string().nullable().optional().describe("Optional pagination cursor. Use the 'after' value from a previous response to get the next page.")
})

export const getWorkOSUserInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the WorkOS skill to use."),
    userId: z.string().describe("The WorkOS user ID to look up.")
})

// LaunchDarkly input schemas
export const listLaunchDarklyFlagsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the LaunchDarkly skill to use."),
    projectKey: z.string().describe("The LaunchDarkly project key."),
    environmentKeys: z.array(z.string()).describe("Array of environment keys to query."),
    summary: z.boolean().default(true).describe("If true, return only flag key, name, and on/off state per environment. If false, return full flag details."),
    filter: z.string().nullable().optional().describe("Optional: Filter flags by name/key containing this text."),
    tags: z
        .union([z.array(z.string()), z.null()])
        .optional()
        .describe("Optional: Filter flags by tags.")
})

export const getLaunchDarklyFlagDetailsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the LaunchDarkly skill to use."),
    projectKey: z.string().describe("The LaunchDarkly project key."),
    environmentKeys: z.array(z.string()).describe("Array of environment keys to query."),
    flagKey: z.string().describe("The flag key to retrieve."),
    environmentKey: z.string().nullable().optional().describe("Optional: Specific environment to get details for (if not provided, returns all configured environments)."),
    includeHistory: z.boolean().default(false).describe("If true, includes change history for the flag over the specified time window."),
    before: z.string().nullable().optional().describe("Optional: ISO date - only return history entries before this date (only used if includeHistory is true)."),
    after: z.string().nullable().optional().describe("Optional: ISO date - only return history entries after this date (only used if includeHistory is true)."),
    historyLimit: z.number().int().default(20).describe("Number of history entries to return if includeHistory is true (default: 20, max: 20).")
})

// Snowflake input schemas
export const snowflakeExecuteQueryInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Snowflake connection to use."),
    query: z.string().describe("The SQL query to execute. Should be a read-only SELECT statement.")
})

export const snowflakeExplainQueryInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Snowflake connection to use."),
    query: z.string().describe("The SQL query to explain.")
})

export const webSearchResultItemSchema = z.object({
    title: z.string(),
    url: z.string(),
    content: z.string(),
    score: z.number()
})

export const webSearchOutputSchema = z.object({
    query: z.string(),
    answer: z.string().optional(),
    results: z.array(webSearchResultItemSchema)
})

const attioToolInput = <T extends z.ZodType>(request: T) =>
    z.object({
        integrationId: z.string().describe("The integration ID of the Attio workspace to use."),
        request: request.describe("The operation to perform and its arguments.")
    })

export const attioTasksInputSchema = attioToolInput(attioTasksRequestSchema)
export const attioNotesInputSchema = attioToolInput(attioNotesRequestSchema)
export const attioCommentsInputSchema = attioToolInput(attioCommentsRequestSchema)
export const attioListsInputSchema = attioToolInput(attioListsRequestSchema)
export const attioMeetingsInputSchema = attioToolInput(attioMeetingsRequestSchema)
export const attioFilesInputSchema = attioToolInput(attioFilesRequestSchema)
export const attioSchemaInputSchema = attioToolInput(attioSchemaRequestSchema)

const attioToolOutputBaseSchema = toolOutputBaseSchema.omit({ success: true })

export const attioTasksTool = defineTool({
    name: "attio_tasks",
    inputSchema: attioTasksInputSchema,
    outputSchema: attioToolOutputBaseSchema.extend({
        tasks: z.array(attioTaskSchema).optional(),
        task: attioTaskSchema.optional(),
        count: z.number().int().optional()
    })
})

export const attioNotesTool = defineTool({
    name: "attio_notes",
    inputSchema: attioNotesInputSchema,
    outputSchema: attioToolOutputBaseSchema.extend({
        notes: z.array(attioNoteSchema).optional(),
        note: attioNoteSchema.optional(),
        count: z.number().int().optional()
    })
})

export const attioCommentsTool = defineTool({
    name: "attio_comments",
    inputSchema: attioCommentsInputSchema,
    outputSchema: attioToolOutputBaseSchema.extend({
        comment: attioCommentSchema.optional(),
        threads: z.array(attioThreadSchema).optional(),
        thread: attioThreadSchema.optional(),
        count: z.number().int().optional()
    })
})

export const attioListsTool = defineTool({
    name: "attio_lists",
    inputSchema: attioListsInputSchema,
    outputSchema: attioToolOutputBaseSchema.extend({
        lists: z.array(attioListSchema).optional(),
        list: attioListSchema.optional(),
        entries: z.array(attioListEntrySchema).optional(),
        entry: attioListEntrySchema.optional(),
        count: z.number().int().optional(),
        offset: z.number().int().optional()
    })
})

export const attioMeetingsTool = defineTool({
    name: "attio_meetings",
    inputSchema: attioMeetingsInputSchema,
    outputSchema: attioToolOutputBaseSchema.extend({
        meetings: z.array(attioMeetingSchema).optional(),
        meeting: attioMeetingSchema.optional(),
        recordings: z.array(attioCallRecordingSchema).optional(),
        transcript: attioTranscriptSchema.optional(),
        count: z.number().int().optional(),
        nextCursor: z.string().nullable().optional()
    })
})

export const attioFilesTool = defineTool({
    name: "attio_files",
    inputSchema: attioFilesInputSchema,
    outputSchema: attioToolOutputBaseSchema.extend({
        files: z.array(attioFileSchema).optional(),
        file: attioFileSchema.optional(),
        downloadUrl: z.string().optional(),
        count: z.number().int().optional(),
        nextCursor: z.string().nullable().optional()
    })
})

export const attioSchemaTool = defineTool({
    name: "attio_schema",
    inputSchema: attioSchemaInputSchema,
    outputSchema: attioToolOutputBaseSchema.extend({
        objects: z.array(attioObjectWithAttributesSchema).optional(),
        object: attioObjectSchema.optional(),
        attributes: z.array(attioAttributeSchema).optional(),
        attribute: attioAttributeSchema.optional(),
        statuses: z.array(attioStatusSchema).optional(),
        status: attioStatusSchema.optional(),
        selectOptions: z.array(attioSelectOptionEntitySchema).optional(),
        selectOption: attioSelectOptionEntitySchema.optional(),
        count: z.number().int().optional()
    })
})

export const attioWorkspaceMembersTool = defineTool({
    name: "attio_workspace_members",
    inputSchema: attioWorkspaceMembersInputSchema,
    outputSchema: attioToolOutputBaseSchema.extend({
        members: z.array(attioWorkspaceMemberSchema).optional(),
        member: attioWorkspaceMemberSchema.optional(),
        count: z.number().int().optional()
    })
})

export const attioRecordsTool = defineTool({
    name: "attio_records",
    inputSchema: attioRecordsInputSchema,
    outputSchema: attioToolOutputBaseSchema.extend({
        records: z.array(attioRecordSchema).optional(),
        record: attioRecordSchema.optional(),
        matches: z.array(attioSearchMatchSchema).optional(),
        history: z.array(attioAttributeHistoryEntrySchema).optional(),
        count: z.number().int().optional(),
        offset: z.number().int().optional()
    })
})

export const listWorkOSUsersTool = defineTool({
    name: "listWorkOSUsers",
    inputSchema: listWorkOSUsersInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        users: z.array(workOSUserSummarySchema),
        pagination: workOSPaginationSchema,
        message: z.string()
    })
})

export const listWorkOSOrganizationsTool = defineTool({
    name: "listWorkOSOrganizations",
    inputSchema: listWorkOSOrganizationsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        organizations: z.array(workOSOrganizationSummarySchema),
        pagination: workOSPaginationSchema,
        message: z.string()
    })
})

export const getWorkOSUserTool = defineTool({
    name: "getWorkOSUser",
    inputSchema: getWorkOSUserInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        user: workOSUserSummarySchema,
        message: z.string()
    })
})

export const listLaunchDarklyFlagsTool = defineTool({
    name: "listLaunchDarklyFlags",
    inputSchema: listLaunchDarklyFlagsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        projectKey: z.string(),
        totalFlags: z.number().int(),
        flags: z.array(launchDarklyFlagSummarySchema),
        flagsLink: z.string(),
        message: z.string()
    })
})

export const getLaunchDarklyFlagDetailsTool = defineTool({
    name: "getLaunchDarklyFlagDetails",
    inputSchema: getLaunchDarklyFlagDetailsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        projectKey: z.string(),
        flag: launchDarklyFlagMetadataSchema,
        environments: z.record(z.string(), launchDarklyEnvironmentConfigSchema),
        url: z.string(),
        history: launchDarklyHistoryResultSchema.optional(),
        message: z.string()
    })
})

export const snowflakeExecuteQueryTool = defineTool({
    name: "snowflakeExecuteQuery",
    inputSchema: snowflakeExecuteQueryInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        rows: z.array(snowflakeQueryRowSchema),
        columns: z.array(z.string()),
        rowCount: z.number().int()
    })
})

export const snowflakeExplainQueryTool = defineTool({
    name: "snowflakeExplainQuery",
    inputSchema: snowflakeExplainQueryInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        explainPlan: z.array(snowflakeQueryRowSchema),
        columns: z.array(z.string()),
        rowCount: z.number().int()
    })
})

export const webSearchTool = defineTool({
    name: "web_search",
    inputSchema: z.object({
        query: z.string().describe("The search query"),
        max_results: z.number().int().min(1).max(10).nullable().describe("Number of results to return (default 5)"),
        search_depth: z.enum(["basic", "advanced"]).nullable().describe("'basic' is faster, 'advanced' is more thorough (default 'basic')"),
        include_answer: z.boolean().nullable().describe("Include an LLM-generated answer summarizing the results (default false)"),
        topic: z.enum(["general", "news"]).nullable().describe("'news' for recent news articles, 'general' for all web content (default 'general')"),
        time_range: z.enum(["day", "week", "month", "year"]).nullable().describe("Filter results by recency"),
        include_domains: z.array(z.string()).nullable().describe("Restrict results to these domains (e.g. ['example.com']). Required when web access is limited to an allowed list of domains.")
    }),
    outputSchema: webSearchOutputSchema
})

export const memoryViewCommandSchema = z.object({
    op: z.literal("view"),
    path: z.string().nullable().optional().describe("Path under /memories to view; omit to list the memory root"),
    view_range: z.array(z.number().int()).nullable().optional().describe("Optional [startLine, endLine] (1-indexed) to view a slice of a file")
})

export const memoryCreateCommandSchema = z.object({
    op: z.literal("create"),
    path: z.string().describe("Path under /memories to create (e.g. '/memories/notes.md')"),
    file_text: z.string().nullable().optional().describe("Full file contents; defaults to empty")
})

export const memoryStrReplaceCommandSchema = z.object({
    op: z.literal("str_replace"),
    path: z.string().describe("Path under /memories to edit"),
    old_str: z.string().describe("Exact text to replace (must appear verbatim exactly once)"),
    new_str: z.string().nullable().optional().describe("Replacement text; omit to delete the matched text")
})

export const memoryInsertCommandSchema = z.object({
    op: z.literal("insert"),
    path: z.string().describe("Path under /memories to edit"),
    insert_line: z.number().int().describe("Line number after which to insert (0 = beginning of file)"),
    insert_text: z.string().nullable().optional().describe("Text to insert; defaults to empty")
})

export const memoryDeleteCommandSchema = z.object({
    op: z.literal("delete"),
    path: z.string().describe("Path under /memories to delete")
})

export const memoryRenameCommandSchema = z.object({
    op: z.literal("rename"),
    old_path: z.string().describe("Source path under /memories"),
    new_path: z.string().describe("Destination path under /memories")
})

export const memoryCommandSchema = z.discriminatedUnion("op", [
    memoryViewCommandSchema,
    memoryCreateCommandSchema,
    memoryStrReplaceCommandSchema,
    memoryInsertCommandSchema,
    memoryDeleteCommandSchema,
    memoryRenameCommandSchema
])

export const memoryInputSchema = z.object({
    command: memoryCommandSchema.describe("The memory operation to perform and its arguments")
})

export type MemoryViewCommand = z.infer<typeof memoryViewCommandSchema>
export type MemoryCreateCommand = z.infer<typeof memoryCreateCommandSchema>
export type MemoryStrReplaceCommand = z.infer<typeof memoryStrReplaceCommandSchema>
export type MemoryInsertCommand = z.infer<typeof memoryInsertCommandSchema>
export type MemoryDeleteCommand = z.infer<typeof memoryDeleteCommandSchema>
export type MemoryRenameCommand = z.infer<typeof memoryRenameCommandSchema>
export type MemoryCommand = z.infer<typeof memoryCommandSchema>
export type MemoryInput = z.infer<typeof memoryInputSchema>

export const memoryOutputSchema = toolOutputBaseSchema.extend({
    result: z.string()
})

export const memoryTool = defineTool({
    name: "memory",
    inputSchema: memoryInputSchema,
    outputSchema: memoryOutputSchema
})

export const ToolDefinitions = {
    [linearCreateTicketTool.name]: linearCreateTicketTool,
    [linearUpdateTicketTool.name]: linearUpdateTicketTool,
    [linearAddCommentTool.name]: linearAddCommentTool,
    [linearSearchTicketTool.name]: linearSearchTicketTool,
    [linearReadTicketTool.name]: linearReadTicketTool,
    [linearGetStatesTool.name]: linearGetStatesTool,
    [linearGetLabelsTool.name]: linearGetLabelsTool,
    [linearGetProjectsTool.name]: linearGetProjectsTool,
    [linearGetTeamsTool.name]: linearGetTeamsTool,
    [linearGetUsersTool.name]: linearGetUsersTool,
    [slackSendMessageTool.name]: slackSendMessageTool,
    [slackListChannelsTool.name]: slackListChannelsTool,
    [slackListUsersTool.name]: slackListUsersTool,
    [slackReadConversationTool.name]: slackReadConversationTool,
    [searchGitHubCodeTool.name]: searchGitHubCodeTool,
    [grepGitHubCodeTool.name]: grepGitHubCodeTool,
    [readGitHubFileTool.name]: readGitHubFileTool,
    [listGitHubDirectoryTool.name]: listGitHubDirectoryTool,
    [listGitHubPullRequestsTool.name]: listGitHubPullRequestsTool,
    [listGitHubCommitsTool.name]: listGitHubCommitsTool,
    [summarizeGitHubPullRequestDiffTool.name]: summarizeGitHubPullRequestDiffTool,
    [notionCreateOrUpdatePageTool.name]: notionCreateOrUpdatePageTool,
    [notionCreateOrUpdateDatabaseRowTool.name]: notionCreateOrUpdateDatabaseRowTool,
    [notionModifyBlocksTool.name]: notionModifyBlocksTool,
    [notionQueryPageTool.name]: notionQueryPageTool,
    [notionQueryDatabaseTool.name]: notionQueryDatabaseTool,
    [notionGetSchemaTool.name]: notionGetSchemaTool,
    [notionListUsersTool.name]: notionListUsersTool,
    [gmailSendEmailTool.name]: gmailSendEmailTool,
    [gmailCreateDraftTool.name]: gmailCreateDraftTool,
    [searchPosthogSessionsTool.name]: searchPosthogSessionsTool,
    [searchPosthogLogsTool.name]: searchPosthogLogsTool,
    [getPosthogSessionEventsTool.name]: getPosthogSessionEventsTool,
    [listPosthogEventNamesTool.name]: listPosthogEventNamesTool,
    [searchPosthogEventsTool.name]: searchPosthogEventsTool,
    [attioRecordsTool.name]: attioRecordsTool,
    [attioWorkspaceMembersTool.name]: attioWorkspaceMembersTool,
    [attioTasksTool.name]: attioTasksTool,
    [attioNotesTool.name]: attioNotesTool,
    [attioCommentsTool.name]: attioCommentsTool,
    [attioListsTool.name]: attioListsTool,
    [attioMeetingsTool.name]: attioMeetingsTool,
    [attioFilesTool.name]: attioFilesTool,
    [attioSchemaTool.name]: attioSchemaTool,
    [listWorkOSUsersTool.name]: listWorkOSUsersTool,
    [listWorkOSOrganizationsTool.name]: listWorkOSOrganizationsTool,
    [getWorkOSUserTool.name]: getWorkOSUserTool,
    [listLaunchDarklyFlagsTool.name]: listLaunchDarklyFlagsTool,
    [getLaunchDarklyFlagDetailsTool.name]: getLaunchDarklyFlagDetailsTool,
    [snowflakeExecuteQueryTool.name]: snowflakeExecuteQueryTool,
    [snowflakeExplainQueryTool.name]: snowflakeExplainQueryTool,
    [searchDatadogLogsTool.name]: searchDatadogLogsTool,
    [searchRumEventsTool.name]: searchRumEventsTool,
    [listRumEventsTool.name]: listRumEventsTool,
    [aggregateRumEventsTool.name]: aggregateRumEventsTool,
    [webSearchTool.name]: webSearchTool,
    [webExtractTool.name]: webExtractTool,
    [webResearchTool.name]: webResearchTool,
    [imageEditTool.name]: imageEditTool,
    [memoryTool.name]: memoryTool
} as const

export type ToolName = keyof typeof ToolDefinitions

export type ToolDefinitionByName<TName extends ToolName> = (typeof ToolDefinitions)[TName]

export type ToolInputSchemaByName = {
    [K in ToolName]: ToolDefinitionByName<K>["inputSchema"]
}

export type ToolOutputSchemaByName = {
    [K in ToolName]: ToolDefinitionByName<K>["outputSchema"]
}

export type ToolInputByName = {
    [K in ToolName]: z.infer<ToolInputSchemaByName[K]>
}

export type DefinedToolOutputByName = {
    [K in ToolName]: z.infer<ToolOutputSchemaByName[K]>
}

export type ToolOutputByName = DefinedToolOutputByName

export const toolsWithIntegrationId: ReadonlySet<ToolName> = new Set(
    (Object.entries(ToolDefinitions) as [ToolName, (typeof ToolDefinitions)[ToolName]][])
        .filter(([, def]) => {
            const shape = def.inputSchema instanceof z.ZodObject ? (def.inputSchema as z.ZodObject<z.ZodRawShape>).shape : undefined
            return shape?.integrationId !== undefined
        })
        .map(([name]) => name)
)

export function isValidToolName(name: string): name is ToolName {
    return name in ToolDefinitions
}
