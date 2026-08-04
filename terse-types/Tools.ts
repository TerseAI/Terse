import { z } from "zod"

import { googleSearchConsoleSiteSchema } from "./Integrations"
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

export function defineTool<const TName extends string, TInput extends AnySchema, TOutput extends AnySchema>(def: { name: TName; description: string; inputSchema: TInput; outputSchema: TOutput }) {
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
    name: z.string(),
    email: z.string().optional()
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
}> = z
    .lazy(() =>
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
    .meta({ id: "NotionBlock" })

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
    query: z.string().nullable().optional().describe("Optional search query to filter users by name or email. Case-insensitive partial match.")
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
    description: "Create a new Linear issue/ticket.",
    inputSchema: linearCreateTicketInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        issue: linearIssueHandleSchema
    })
})

export const linearUpdateTicketTool = defineTool({
    name: "linear_update_ticket",
    description: `Update an existing Linear issue/ticket. Use linear_search_ticket to find the issue ID, and linear_get_states, linear_get_users, linear_get_projects, linear_get_teams to find valid IDs for each field.`,
    inputSchema: linearUpdateTicketInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        issue: linearIssueHandleSchema
    })
})

export const linearAddCommentTool = defineTool({
    name: "linear_add_comment",
    description: `Add a comment to an existing Linear issue. Use linear_search_ticket to find the issue ID.`,
    inputSchema: linearAddCommentInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        comment: linearCommentHandleSchema
    })
})

export const linearSearchTicketTool = defineTool({
    name: "linear_search_ticket",
    description: `Searches Linear issues by keyword, state filter, and/or date range filters. Use this before reading individual tickets. Results are ordered by most recently updated first. Use 'after' cursor to paginate.`,
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
    description: `Read detailed information about a Linear issue/ticket including title, description, state, assignee, and optionally all comments.
Use the issue ID (UUID) or the issue identifier (e.g. "TEAM-123"). Use this after searching for tickets to get full details.`,
    inputSchema: linearReadTicketInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        issue: linearIssueDetailSchema,
        comments: z.array(linearReadTicketCommentSchema).optional()
    })
})

export const linearGetStatesTool = defineTool({
    name: "linear_get_states",
    description: `List workflow states for the Linear workspace or a specific team. Use when creating or updating issues to pick a valid stateId (e.g. "Todo", "In Progress", "Done").`,
    inputSchema: linearGetStatesInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        states: z.array(linearStateSummarySchema)
    })
})

export const linearGetLabelsTool = defineTool({
    name: "linear_get_labels",
    description: `List issue labels for the Linear workspace or a specific team. Use to pick labelIds for linear_create_ticket or linear_update_ticket.`,
    inputSchema: linearGetLabelsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        labels: z.array(linearLabelSummarySchema)
    })
})

export const linearGetProjectsTool = defineTool({
    name: "linear_get_projects",
    description: `List projects for the Linear workspace or a specific team. Use to pick projectId when creating or updating issues.`,
    inputSchema: linearGetProjectsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        projects: z.array(linearProjectSummarySchema)
    })
})

export const linearGetTeamsTool = defineTool({
    name: "linear_get_teams",
    description: `List teams in the Linear workspace. Use to pick teamId when creating tickets or when calling linear_get_states, linear_get_labels, or linear_get_projects for a specific team.`,
    inputSchema: linearGetTeamsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        teams: z.array(linearTeamSchema)
    })
})

export const linearGetUsersTool = defineTool({
    name: "linear_get_users",
    description: `List users in the Linear workspace. Use to pick assigneeId or subscriberIds when creating or updating issues.`,
    inputSchema: linearGetUsersInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        users: z.array(linearUserSummarySchema)
    })
})

export const slackSendMessageTool = defineTool({
    name: "slack_send_message",
    description: `Send message to a Slack channel or DM. Provide channelId (C…/G…/D…) or slackUserId (U…) to open or reuse a 1:1 DM. Supports plain text (mrkdwn) or Block Kit (JSON blocks). If both are set, channelId is used.`,
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
    description: `List available Slack channels and conversations (public, private, DMs, multi-person DMs) that the integration can access.
Use this to discover channel IDs before reading conversation history.
Supports pagination: if the response includes nextCursor and hasMore, pass nextCursor as the cursor parameter on the next call to fetch more.`,
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
    description: `List Slack workspace users (id, name, email). Use this to resolve user IDs to names when needed.
Returns non-bot members. Optionally filter by name or email with the query parameter.`,
    inputSchema: slackListUsersInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        users: z.array(slackUserResponseSchema),
        count: z.number().int()
    })
})

export const slackReadConversationTool = defineTool({
    name: "slack_read_conversation",
    description: `Read message history from a Slack channel or DM.
Use the channel ID from slack_list_channels. Supports public channels, private channels, and DMs.
Supports pagination: if the response includes nextCursor and hasMore, pass nextCursor as the cursor parameter on the next call to fetch more messages.`,
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
    description: `Search GitHub repositories for code by SEMANTIC MEANING (conceptual search). Use this when you DON'T know the exact code text.

Use searchGitHubCode for:
- Concepts and patterns: "authentication", "error handling", "database connections"
- Unknown implementations: "how is validation done?", "where are API routes?"
- Exploring codebases: "logging implementations", "payment processing"
- Finding code by what it DOES, not what it's CALLED

Use grepGitHubCode instead when you KNOW the exact text string (function name, import, etc.)

Examples:
- ✅ "authentication middleware" (finds login, auth, verifyToken, etc.)
- ✅ "error handling patterns" (finds try/catch, error handlers, etc.)
- ✅ "database queries" (finds prisma, mysql, query builders)
- ❌ "getUserById(" → Use grepGitHubCode for exact matches

Tips:
- Start with broad searches, then narrow down
- Use natural language or domain terms
- Combine multiple terms for more specific results`,
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
    description: `Search GitHub repositories for EXACT TEXT MATCHES (like grep). Use this when you KNOW the exact string you're looking for.

Use grepGitHubCode for:
- Exact function calls: "getUserById(", "processPayment()"
- Exact imports: "from '@prisma/client'", "import React from"
- Exact strings: "API_KEY", "TODO:", "FIXME:"
- Known identifiers: class names, constants, variable names you know exist

Use searchGitHubCode instead when you DON'T know the exact text (looking for concepts/patterns).

Examples:
- ✅ "getUserById(" (exact function call)
- ✅ "from '@prisma/client'" (exact import statement)
- ✅ "TODO: refactor" (exact comment)
- ✅ "useState" (exact React hook name)
- ❌ "state management" → Use searchGitHubCode for concepts

This is more precise than semantic search - use it when you know exactly what text to find.`,
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
    description: `Read the full contents of a file from a GitHub repository. Use this after finding relevant files via search to:
- Understand the complete implementation of a function or class
- See imports and dependencies
- Review the full context around a code snippet
- Understand file structure and organization

Note: This reads from the default branch (main/master). Large files may be truncated.`,
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
    description: `List files and directories in a GitHub repository. Use this to:
- Explore the repository structure
- Find where specific types of files are located
- Understand the project organization
- Navigate to specific directories before reading files

Start with the root directory (empty path) to see the top-level structure, then drill down into interesting directories.`,
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
    description: `List pull requests in GitHub repositories within a time window. Use this to:
- Find recently merged PRs to understand recent changes
- Review what work has been completed in a given period
- Track PR activity for specific repositories
- Understand the development history and velocity

The tool returns PR details including title, description, author, merge status, and dates.
Dates are specified in YYYY-MM-DD format (e.g., "2024-01-15"). The since date is interpreted as the start of that day (00:00:00), and the until date is interpreted as the end of that day (23:59:59).`,
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
    description: `List commits in GitHub repositories within a time window. Use this to:
- Review recent changes and development activity
- Track what code was modified in a specific period
- Find commits by a specific author
- See commit history for a specific file or directory
- Understand the pace and nature of development

The tool returns commit details including message, author, date, and SHA.`,
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
    description: `Summarize the diff of a pull request from a GitHub repository using an intelligent sub-agent. Use this to:
- Understand what changes were made in a specific PR without loading the full diff into context
- Get a concise summary of code changes before merging
- Analyze the impact of a PR on the codebase efficiently
- See file-by-file changes with key insights

The tool launches a sub-agent that:
- Reads the full PR diff from GitHub
- Analyzes the changes using a compact model
- Provides a structured summary including:
  - Overview of changes
  - Key files modified
  - Notable additions/removals
  - Impact assessment

You can optionally provide high-level context about what you're looking for in the PR, which will help the sub-agent focus its analysis.`,
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
    description: `Create or update a **standalone page**. Not for database entries — use notion_create_or_update_database_row for those.

**Create**: Omit page_id (or pass null). Supply parentPageId (allowed page ID from config), title. Creates a new empty subpage under the parent. Use notion_modify_blocks on the returned page_id to add content.
**Update**: Pass page_id of an existing page to update its title. parentPageId is ignored when updating. Use notion_modify_blocks to change page content.`,
    inputSchema: notionCreateOrUpdatePageInputSchema,
    outputSchema: notionDatabaseRowMutationResultSchema
})

export const notionCreateOrUpdateDatabaseRowTool = defineTool({
    name: "notion_create_or_update_database_row",
    description: `Create or update a **row** (entry) in a Notion database. Use with databaseId and properties_json. Not for standalone pages — use notion_create_or_update_page for those.

Use notion_get_schema first to understand property names and types. Use notion_query_database to find page_id for updates. Provide page_id null to create a new row, or a valid page_id to update. Property format: Title, Rich Text, Select, Status, etc. per notion_get_schema.`,
    inputSchema: notionCreateOrUpdateDatabaseRowInputSchema,
    outputSchema: notionDatabaseRowMutationResultSchema
})

export const notionModifyBlocksTool = defineTool({
    name: "notion_modify_blocks",
    description: `Add, update, or delete blocks in page content. Use this to modify page content (paragraphs, headings, lists, etc.).

Accepts a single operation object (backwards compatible) OR an array of operation objects executed sequentially. One approval covers the whole batch.

Operations:
- append: Add new blocks to the page (or to a parent block if parent_block_id is provided). Use optional after_block_id to insert after a specific block instead of at the end. Get block IDs from notion_query_page.
- update: Update an existing block by block_id
- delete: Delete (archive) a block by block_id

Positional insertion: Use after_block_id with append to insert blocks after a specific block instead of at the end.

Moving blocks within a page:
1. Retrieve the block content with notion_query_page.
2. Append the block at the desired position (use after_block_id for position, or parent_block_id for container).
3. Delete the original block with the "delete" operation.

Examples — single operation:
- Append: {"operation": "append", "blocks": [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Hello world"}}]}}]}
- Append after a block: {"operation": "append", "after_block_id": "xyz789", "blocks": [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": "Inserted here"}}]}}]}
- Update: {"operation": "update", "block_id": "abc123", "block": {"paragraph": {"rich_text": [{"type": "text", "text": {"content": "Updated text"}}]}}}
- Delete: {"operation": "delete", "block_id": "abc123"}

Examples — batch (array):
[{"operation": "append", "blocks": [...]}, {"operation": "update", "block_id": "abc", "block": {...}}, {"operation": "delete", "block_id": "def"}]

Error recovery: If Notion returns an error that suggests JSON/body/validation incompatibility, retry. First fix the specific issue mentioned in the error; if that is unclear or still failing, retry with a simpler payload (fewer blocks, simpler block types like plain paragraphs).`,
    inputSchema: notionModifyBlocksInputSchema,
    outputSchema: z.union([notionModifyBlocksSuccessSchema, notionModifyBlocksFailureSchema])
})

export const notionQueryPageTool = defineTool({
    name: "notion_query_page",
    description: `Call this tool ONCE at the beginning of your run to get the page state. After calling it once, remember and reuse the results - DO NOT call it multiple times in the same run.

This tool returns the current state of the page including all properties, metadata, and content blocks.`,
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
    description: `Query a Notion data source (database) to retrieve pages that match specific criteria.

WHEN TO USE THIS TOOL:
- Verify if the database contains any existing records and avoid creating duplicates.
- When you need to find specific pages matching certain criteria (e.g., status, date ranges, property values)
- When you need to retrieve a subset of pages rather than all pages in the database
- When working with large databases and need pagination to retrieve results in batches
- When you only need specific properties from pages (use filter_properties for efficiency)

WHAT THIS TOOL DOES:
1. Filters pages at the Notion API level (not client-side) for maximum efficiency
2. Supports complex filtering with AND/OR logic, property filters, and timestamp filters
3. Supports pagination - use start_cursor from previous responses to get next page
4. Supports filter_properties to only fetch needed fields, reducing response size and improving speed

FILTERING:
- Property filters: Filter by any database property (title, number, date, select, status, checkbox, etc.)
- Timestamp filters: Filter by created_time or last_edited_time (these are SYSTEM FIELDS, not database properties)
- Compound filters: Combine filters with AND/OR logic
- All filtering happens server-side at Notion for efficiency

SYSTEM FIELDS (available on ALL pages, not shown in schema):
- created_time: When the page was created. Use timestamp filter format (NO "property" field).
- last_edited_time: When the page was last edited. Use timestamp filter format (NO "property" field).
- created_by: User who created the page. Use people filter WITH "property" field.
- last_edited_by: User who last edited the page. Use people filter WITH "property" field.

IMPORTANT: Timestamp filters (created_time, last_edited_time) use a DIFFERENT format than property filters:
- CORRECT: {"timestamp": "created_time", "created_time": {"on_or_after": "2024-01-01"}}
- WRONG: {"property": "created_time", "date": {"on_or_after": "2024-01-01"}}

PAGINATION:
- Use page_size to control how many results per page (default: all results)
- Use start_cursor from the response to fetch the next page
- The response includes has_more and next_cursor when more pages are available

FILTER_PROPERTIES:
- Specify only the properties you need to reduce response size and improve performance
- Especially important for databases with many properties or complex formulas/rollups
- You can fetch additional properties later using Retrieve page property item API

NOTE: This tool does NOT return the database schema. Use notion_get_schema if you need schema information.`,
    inputSchema: notionQueryDatabaseInputSchema,
    outputSchema: z.discriminatedUnion("success", [notionQueryDatabaseSuccessSchema, notionQueryDatabaseFailureSchema])
})

export const notionGetSchemaTool = defineTool({
    name: "notion_get_schema",
    description: `Gets the schema/structure of the Notion data source. This tool retrieves all property definitions including property names, types, valid options for select/status fields, and exact format examples for how to construct each property when writing to the database.

Use this tool:
- Before writing any data to determine available properties and their correct formats
- To understand what property names exist and their data types
- To get valid option values for select, multi_select, and status properties
- To see exact format examples for constructing properties in the Notion API format
- To determine how to write to the Notion database by understanding its structure

The schema information returned by this tool should be used to properly format properties when calling notion_create_or_update_database_row to create or update rows in the database.`,
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
    description: `List users in the Notion workspace. Use this to resolve user names to Notion user IDs
for populating People properties (e.g., Assignee, Owner) when creating or updating database pages.

Returns workspace members (not bots). Optionally filter by name with the query parameter.

Use the returned user IDs in people property format:
{"Assignee": {"people": [{"object": "user", "id": "<user_id>"}]}}`,
    inputSchema: notionListUsersInputSchema,
    outputSchema: toolOutputSuccessSchema.extend({
        users: z.array(notionWorkspaceUserSchema),
        count: z.number().int()
    })
})

export const gmailSendEmailTool = defineTool({
    name: "gmail_send_email",
    description: `Send email or reply to an existing email thread via Gmail. Use thread_id (the Gmail Thread ID, not the Message-ID) to reply to an existing thread, or omit it to send a new email. IMPORTANT: Never put image URLs directly in html_body — remote URLs expire and will result in broken images. Always use image_urls to embed images as base64-encoded inline MIME parts (CID attachments), then reference them in html_body with <img src="cid:image-1.png">. image_urls must be signed URLs from our internal GCS image bucket.`,
    inputSchema: gmailSendEmailInputSchema,
    outputSchema: toolOutputSuccessSchema.merge(gmailSendSummarySchema)
})

export const gmailCreateDraftTool = defineTool({
    name: "gmail_create_draft",
    description: `Create a draft email in Gmail. Use thread_id (the Gmail Thread ID, not the Message-ID) to create a draft reply to an existing thread, or omit it to create a new draft email. The draft will appear in the user's Gmail Drafts folder for review before sending. IMPORTANT: Never put image URLs directly in html_body — remote URLs expire and will result in broken images. Always use image_urls to embed images as base64-encoded inline MIME parts (CID attachments), then reference them in html_body with <img src="cid:image-1.png">. image_urls must be signed URLs from our internal GCS image bucket.`,
    inputSchema: gmailCreateDraftInputSchema,
    outputSchema: toolOutputSuccessSchema.merge(gmailDraftSummarySchema)
})

export const searchPosthogSessionsTool = defineTool({
    name: "searchPosthogSessions",
    description:
        "Query PostHog session recordings for a specific user by their email address. Returns session recordings data and links to view sessions in PostHog. Use this when you need to replay user sessions, investigate user behavior, or understand how users interact with the application. Returns the most recent session recordings first.",
    inputSchema: searchPosthogSessionsInputSchema,
    outputSchema: z.union([posthogSearchSessionsFoundSchema, posthogSearchSessionsNotFoundSchema])
})

export const searchPosthogLogsTool = defineTool({
    name: "searchPosthogLogs",
    description:
        "Query PostHog logs with flexible filtering. Returns logs data and a link to view logs in PostHog. You can filter by user email, log severity levels (error, warn, info, debug), message text search, or combinations. At least one filter (user email, severity levels, or message search) should be provided to avoid overly broad queries. Use this when you need to investigate user activity, errors, or events in PostHog logs.",
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
    description:
        "Fetch and decode session replay events from PostHog. Returns summarized meaningful events (clicks, inputs, scroll, console logs, network errors, navigation) within a specified time window. Use this to investigate what a user did during a session - what they clicked, what they typed, any errors that occurred, etc. The events are decoded and summarized for easy analysis.",
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
    description:
        "List PostHog event names with how often each occurred, most frequent first (US PostHog Cloud only). Scope with distinctId to profile a single user's activity, or with event/person propertyFilters and a date range.",
    inputSchema: listPosthogEventNamesInputSchema,
    outputSchema: toolOutputSuccessSchema.extend({
        eventCounts: z.array(posthogEventCountSchema),
        totalEventTypes: z.number().int(),
        eventsLink: z.string()
    })
})

export const searchPosthogEventsTool = defineTool({
    name: "searchPosthogEvents",
    description:
        "Fetch PostHog analytics events, newest first (US PostHog Cloud only). Filter by eventName, distinctId, and event/person propertyFilters. Use listPosthogEventNames first to discover which event names exist.",
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
    description: "Query Datadog logs. Filter by query string, indexes, time range. Returns logs with timestamps, status, messages, hosts, services, tags.",
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
    description: "Query Datadog RUM events. Filter by query string, time range. Returns sessions, views, actions, errors, resources, long tasks.",
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
    description: "List recent Datadog RUM events. Use for discovery when unsure what to query. Returns sessions, views, actions, errors, resources, long tasks.",
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
    description: "Aggregate Datadog RUM events into metrics. Compute percentiles, averages, sums, etc. Group by facets for breakdowns. Use for performance trends and error rates.",
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
    description: "Extract the full text content from one or more web page URLs. Use this when you need to read the complete contents of a specific page.",
    inputSchema: webExtractInputSchema,
    outputSchema: webExtractOutputSchema
})

export const webResearchTool = defineTool({
    name: "web_research",
    description:
        "Conduct deep, multi-source research on a topic. Autonomously searches across many sources and returns a comprehensive report with citations. Best for complex questions requiring synthesis across multiple sources. Takes longer than a regular search (up to 2 minutes).",
    inputSchema: webResearchInputSchema,
    outputSchema: webResearchOutputSchema
})

export const imageEditTool = defineTool({
    name: "image_edit",
    description:
        "Edit or transform an image from a URL using a natural language prompt. Supports crops, style changes, object removal/addition, color adjustments, and other visual edits. The edited image is automatically sent to the chat UI for the user to see.",
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
        description: z.string().nullable().optional(),
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
    objectSlug: attioObjectSlugField,
    values: z.string().describe('A JSON object string mapping attribute slugs to values (e.g. \'{"name":"Acme","domains":["acme.com"]}\'). For multi-value attributes, pass an array.')
})

export const attioUpdateRecordRequestSchema = z.object({
    objectSlug: attioObjectSlugField,
    recordId: attioRecordIdField,
    values: z.string().describe("A JSON object string mapping the attribute slugs to update to their new values."),
    multiselectMode: z
        .enum(["overwrite", "append"])
        .nullable()
        .describe("'overwrite' (the default) replaces the values of multi-value attributes; 'append' adds to them without removing existing values. Pass null for the default.")
})

export const attioUpsertRecordsRequestSchema = z.object({
    objectSlug: attioObjectSlugField,
    matchingAttribute: z.string().describe("The unique, writable attribute slug to match on (e.g. 'email_addresses' for people, 'domains' for companies)."),
    records: z
        .string()
        .describe(
            'A JSON string representing a list of records to upsert. Each record maps attribute slugs to values; for multi-value attributes pass an array. Example: \'[{"email_addresses":["test@example.com"],"name":"John"}]\'.'
        )
})

export const attioDeleteRecordRequestSchema = z.object({
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

export const attioReadRecordsRequestSchema = z.discriminatedUnion("action", [
    attioQueryRecordsRequestSchema,
    attioSearchRecordsRequestSchema,
    attioGetRecordRequestSchema,
    attioGetAttributeHistoryRequestSchema
])

export type AttioQueryRecordsRequest = z.infer<typeof attioQueryRecordsRequestSchema>
export type AttioSearchRecordsRequest = z.infer<typeof attioSearchRecordsRequestSchema>
export type AttioGetRecordRequest = z.infer<typeof attioGetRecordRequestSchema>
export type AttioCreateRecordRequest = z.infer<typeof attioCreateRecordRequestSchema>
export type AttioUpdateRecordRequest = z.infer<typeof attioUpdateRecordRequestSchema>
export type AttioUpsertRecordsRequest = z.infer<typeof attioUpsertRecordsRequestSchema>
export type AttioDeleteRecordRequest = z.infer<typeof attioDeleteRecordRequestSchema>
export type AttioGetAttributeHistoryRequest = z.infer<typeof attioGetAttributeHistoryRequestSchema>
export type AttioReadRecordsRequest = z.infer<typeof attioReadRecordsRequestSchema>

const attioTargetRecordFields = {
    objectSlug: z.string().describe("The object type slug of the record (e.g. 'people', 'companies')."),
    recordId: z.string().describe("The record ID (UUID).")
}

export const attioReadTasksRequestSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("list").describe("List tasks, optionally filtered by linked record, assignee or completion state."),
        linkedObjectSlug: z.string().nullable().optional().describe("Filter to tasks linked to records of this object slug. Requires linkedRecordId."),
        linkedRecordId: z.string().nullable().optional().describe("Filter to tasks linked to this record ID."),
        isCompleted: z.boolean().nullable().optional().describe("Filter by completion state. Omit for all tasks."),
        limit: z.number().int().nullable().optional().describe("Maximum tasks to return."),
        offset: z.number().int().nullable().optional().describe("Number of tasks to skip, for pagination.")
    }),
    z.object({ action: z.literal("get").describe("Fetch a single task by ID."), taskId: z.string() })
])

export const attioCreateTaskRequestSchema = z.object({
    content: z.string().describe("The task text (plaintext, max 2000 chars)."),
    deadlineAt: z.string().nullable().optional().describe("Deadline as an ISO 8601 timestamp, or null for no deadline."),
    isCompleted: z.boolean().nullable().optional().describe("Whether the task starts completed. Defaults to false."),
    assignees: z.array(z.string()).nullable().optional().describe("Workspace member email addresses or member IDs (UUIDs) to assign."),
    linkedRecords: z.array(z.object(attioTargetRecordFields)).nullable().optional().describe("Records to link the task to.")
})

export const attioUpdateTaskRequestSchema = z.object({
    taskId: z.string(),
    deadlineAt: z.string().nullable().optional().describe("New deadline (ISO 8601), or null to clear."),
    isCompleted: z.boolean().nullable().optional().describe("New completion state. Omit to leave unchanged."),
    assignees: z.array(z.string()).nullable().optional().describe("Replacement assignee emails/IDs. Omit to leave unchanged."),
    linkedRecords: z.array(z.object(attioTargetRecordFields)).nullable().optional().describe("Replacement linked records. Omit to leave unchanged.")
})

export const attioDeleteTaskRequestSchema = z.object({ taskId: z.string() })

export const attioReadNotesRequestSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("list").describe("List notes, optionally scoped to one record."),
        parentObjectSlug: z.string().nullable().optional().describe("Filter to notes on records of this object slug. Requires parentRecordId."),
        parentRecordId: z.string().nullable().optional().describe("Filter to notes on this record ID."),
        limit: z.number().int().nullable().optional(),
        offset: z.number().int().nullable().optional()
    }),
    z.object({ action: z.literal("get").describe("Fetch a single note by ID."), noteId: z.string() })
])

export const attioCreateNoteRequestSchema = z.object({
    parentObjectSlug: z.string().describe("The object type slug of the record the note belongs to."),
    parentRecordId: z.string().describe("The record ID the note belongs to."),
    title: z.string().describe("The note title."),
    content: z.string().describe("The note body."),
    format: z.enum(["plaintext", "markdown"]).nullable().optional().describe("Content format. Defaults to markdown.")
})

export const attioDeleteNoteRequestSchema = z.object({ noteId: z.string() })

export const attioReadCommentsRequestSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("get").describe("Fetch a single comment by ID."), commentId: z.string() }),
    z.object({
        action: z.literal("list_threads").describe("List comment threads on a record."),
        objectSlug: z.string().nullable().optional().describe("With recordId: threads on this record."),
        recordId: z.string().nullable().optional(),
        limit: z.number().int().nullable().optional(),
        offset: z.number().int().nullable().optional()
    }),
    z.object({ action: z.literal("get_thread").describe("Fetch a thread with all of its comments."), threadId: z.string() })
])

export const attioCreateCommentRequestSchema = z.object({
    content: z.string().describe("The comment text (plaintext)."),
    authorWorkspaceMemberId: z.string().describe("The workspace member ID the comment is authored as. Use attio_workspace_members to find it."),
    threadId: z.string().nullable().optional().describe("Reply to this thread. Pass null/omit when commenting on a record."),
    objectSlug: z.string().nullable().optional().describe("With recordId: start a new comment thread on this record."),
    recordId: z.string().nullable().optional()
})

export const attioDeleteCommentRequestSchema = z.object({ commentId: z.string() })

export const attioReadListsRequestSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("list").describe("List all lists in the workspace.") }),
    z.object({ action: z.literal("get").describe("Fetch a list's configuration by ID or slug."), listIdOrSlug: z.string() })
])

export const attioCreateListRequestSchema = z.object({
    name: z.string().describe("Display name of the list."),
    apiSlug: z.string().describe("Unique slug for the list (snake_case)."),
    parentObjectSlug: z.string().describe("The object the list contains records of (e.g. 'companies')."),
    workspaceAccess: z.enum(["full-access", "read-and-write", "read-only"]).nullable().optional().describe("Workspace-wide access level. Defaults to full-access.")
})

export const attioUpdateListRequestSchema = z.object({ listIdOrSlug: z.string(), name: z.string() })

export const attioReadListEntriesRequestSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("query_entries").describe("List entries in a list, with optional filter, parent-record lookup, and limit/offset pagination."),
        listIdOrSlug: z.string(),
        filter: z.string().nullable().optional().describe("Optional Attio filter as a JSON string, matching entry attributes."),
        parentRecordId: z.string().nullable().optional().describe("Only return entries whose parent record has this ID. Requires parentObjectSlug."),
        parentObjectSlug: z.string().nullable().optional().describe("Object slug of the parent record (e.g. 'companies'); required with parentRecordId."),
        limit: z.number().int().nullable().optional().describe("Maximum entries to return (max 500)."),
        offset: z.number().int().nullable().optional()
    }),
    z.object({ action: z.literal("get_entry").describe("Fetch a single list entry."), listIdOrSlug: z.string(), entryId: z.string() })
])

export const attioAddListEntryRequestSchema = z.object({
    listIdOrSlug: z.string(),
    parentObjectSlug: z.string().describe("Object slug of the record being added."),
    parentRecordId: z.string().describe("Record ID being added."),
    entryValues: z.string().nullable().optional().describe("Optional JSON object string of entry attribute values (e.g. a stage).")
})

export const attioUpsertListEntryRequestSchema = z.object({
    listIdOrSlug: z.string(),
    parentObjectSlug: z.string(),
    parentRecordId: z.string(),
    entryValues: z.string().nullable().optional().describe("Optional JSON object string of entry attribute values.")
})

export const attioUpdateListEntryRequestSchema = z.object({
    listIdOrSlug: z.string(),
    entryId: z.string(),
    entryValues: z.string().describe("JSON object string mapping entry attribute slugs to new values."),
    multiselectMode: z.enum(["overwrite", "append"]).nullable().optional().describe("'overwrite' (default) replaces multi-value attribute values; 'append' adds to them.")
})

export const attioRemoveListEntryRequestSchema = z.object({ listIdOrSlug: z.string(), entryId: z.string() })

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

export const attioReadFilesRequestSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("list").describe("List files attached to a record."),
        objectSlug: z.string().describe("Object slug of the record."),
        recordId: z.string().describe("Record ID."),
        limit: z.number().int().nullable().optional(),
        cursor: z.string().nullable().optional()
    }),
    z.object({ action: z.literal("get").describe("Fetch a file's metadata by ID."), fileId: z.string() }),
    z.object({ action: z.literal("get_download_url").describe("Get a signed download URL for a file."), fileId: z.string() })
])

export const attioUploadFileRequestSchema = z.object({
    objectSlug: z.string(),
    recordId: z.string(),
    fileName: z.string().describe("File name including extension."),
    contentBase64: z.string().describe("The file content, base64-encoded."),
    contentType: z.string().nullable().optional().describe("MIME type. Defaults to application/octet-stream.")
})

export const attioDeleteFileRequestSchema = z.object({ fileId: z.string() })

const attioSchemaTargetFields = {
    target: z.enum(["objects", "lists"]).describe("Whether the attribute lives on an object or a list."),
    identifier: z.string().describe("The object slug (e.g. 'deals') or list ID/slug the attribute belongs to.")
}

export const attioReadSchemaRequestSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("list_objects").describe("List all object types in the workspace with their attributes and field definitions. Call this before creating or updating records.") }),
    z.object({ action: z.literal("get_object").describe("Fetch one object's configuration."), objectSlug: z.string() }),
    z.object({ action: z.literal("list_attributes").describe("List the attributes defined on an object or list."), ...attioSchemaTargetFields }),
    z.object({ action: z.literal("list_statuses").describe("List the statuses of a status attribute (e.g. deal stages)."), ...attioSchemaTargetFields, attributeSlug: z.string() }),
    z.object({ action: z.literal("list_select_options").describe("List the options of a select attribute."), ...attioSchemaTargetFields, attributeSlug: z.string() })
])

export const attioModifySchemaRequestSchema = z.discriminatedUnion("action", [
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
        description: z.string().nullable().optional().describe("Text description of the attribute, shown in the Attio UI."),
        isRequired: z.boolean().nullable().optional().describe("Whether a value is required. Defaults to false."),
        isUnique: z.boolean().nullable().optional().describe("Whether values must be unique. Defaults to false."),
        isMultiselect: z.boolean().nullable().optional().describe("Whether the attribute holds multiple values. Defaults to false."),
        defaultValue: z
            .string()
            .nullable()
            .optional()
            .describe('Optional JSON object string for a default value, e.g. \'{"type":"dynamic","template":"current-user"}\' or \'{"type":"static","template":[...]}\'.'),
        relationship: z
            .string()
            .nullable()
            .optional()
            .describe(
                'Optional JSON object string creating the paired attribute of a bidirectional record-reference, e.g. \'{"object":"companies","title":"Projects","api_slug":"projects","is_multiselect":true}\'.'
            ),
        config: z.string().nullable().optional().describe('Optional JSON object string for type-specific config, e.g. \'{"record_reference":{"allowed_objects":["people"]}}\'.')
    }),
    z.object({
        action: z.literal("update_attribute").describe("Update an attribute's title, description, slug, constraints, default value or config, or archive it."),
        ...attioSchemaTargetFields,
        attributeSlug: z.string(),
        title: z.string().nullable().optional(),
        newApiSlug: z.string().nullable().optional().describe("New unique attribute slug (snake_case)."),
        description: z.string().nullable().optional().describe("Text description of the attribute. Pass an empty string to clear it."),
        isRequired: z.boolean().nullable().optional(),
        isUnique: z.boolean().nullable().optional(),
        isArchived: z.boolean().nullable().optional().describe("Archive or restore the attribute."),
        defaultValue: z.string().nullable().optional().describe('Optional JSON object string for a default value, e.g. \'{"type":"dynamic","template":"current-user"}\'.'),
        config: z.string().nullable().optional().describe('Optional JSON object string for type-specific config, e.g. \'{"currency":{"default_currency_code":"USD","display_type":"symbol"}}\'.')
    }),
    z.object({
        action: z.literal("create_status").describe("Add a new status to a status attribute. Rerun terse generate afterwards to refresh generated constants."),
        ...attioSchemaTargetFields,
        attributeSlug: z.string(),
        title: z.string().describe("The status title."),
        celebrationEnabled: z.boolean().nullable().optional().describe("Whether arriving at this status triggers a celebration effect. Defaults to false."),
        targetTimeInStatus: z.string().nullable().optional().describe("Target time a record should spend in this status, as an ISO-8601 duration (e.g. 'P7D').")
    }),
    z.object({
        action: z.literal("update_status").describe("Rename, reconfigure or archive a status."),
        ...attioSchemaTargetFields,
        attributeSlug: z.string(),
        statusId: z.string().describe("The status ID (UUID)."),
        title: z.string().nullable().optional(),
        celebrationEnabled: z.boolean().nullable().optional().describe("Whether arriving at this status triggers a celebration effect."),
        targetTimeInStatus: z.string().nullable().optional().describe("Target time a record should spend in this status, as an ISO-8601 duration (e.g. 'P7D')."),
        isArchived: z.boolean().nullable().optional()
    }),
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

export type AttioReadTasksRequest = z.infer<typeof attioReadTasksRequestSchema>
export type AttioCreateTaskRequest = z.infer<typeof attioCreateTaskRequestSchema>
export type AttioUpdateTaskRequest = z.infer<typeof attioUpdateTaskRequestSchema>
export type AttioDeleteTaskRequest = z.infer<typeof attioDeleteTaskRequestSchema>
export type AttioReadNotesRequest = z.infer<typeof attioReadNotesRequestSchema>
export type AttioCreateNoteRequest = z.infer<typeof attioCreateNoteRequestSchema>
export type AttioDeleteNoteRequest = z.infer<typeof attioDeleteNoteRequestSchema>
export type AttioReadCommentsRequest = z.infer<typeof attioReadCommentsRequestSchema>
export type AttioCreateCommentRequest = z.infer<typeof attioCreateCommentRequestSchema>
export type AttioDeleteCommentRequest = z.infer<typeof attioDeleteCommentRequestSchema>
export type AttioReadListsRequest = z.infer<typeof attioReadListsRequestSchema>
export type AttioCreateListRequest = z.infer<typeof attioCreateListRequestSchema>
export type AttioUpdateListRequest = z.infer<typeof attioUpdateListRequestSchema>
export type AttioReadListEntriesRequest = z.infer<typeof attioReadListEntriesRequestSchema>
export type AttioAddListEntryRequest = z.infer<typeof attioAddListEntryRequestSchema>
export type AttioUpsertListEntryRequest = z.infer<typeof attioUpsertListEntryRequestSchema>
export type AttioUpdateListEntryRequest = z.infer<typeof attioUpdateListEntryRequestSchema>
export type AttioRemoveListEntryRequest = z.infer<typeof attioRemoveListEntryRequestSchema>
export type AttioMeetingsRequest = z.infer<typeof attioMeetingsRequestSchema>
export type AttioReadFilesRequest = z.infer<typeof attioReadFilesRequestSchema>
export type AttioUploadFileRequest = z.infer<typeof attioUploadFileRequestSchema>
export type AttioDeleteFileRequest = z.infer<typeof attioDeleteFileRequestSchema>
export type AttioReadSchemaRequest = z.infer<typeof attioReadSchemaRequestSchema>
export type AttioModifySchemaRequest = z.infer<typeof attioModifySchemaRequestSchema>

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

export const attioReadRecordsInputSchema = attioToolInput(attioReadRecordsRequestSchema)
export const attioCreateRecordInputSchema = attioToolInput(attioCreateRecordRequestSchema)
export const attioUpdateRecordInputSchema = attioToolInput(attioUpdateRecordRequestSchema)
export const attioUpsertRecordsInputSchema = attioToolInput(attioUpsertRecordsRequestSchema)
export const attioDeleteRecordInputSchema = attioToolInput(attioDeleteRecordRequestSchema)
export const attioReadTasksInputSchema = attioToolInput(attioReadTasksRequestSchema)
export const attioCreateTaskInputSchema = attioToolInput(attioCreateTaskRequestSchema)
export const attioUpdateTaskInputSchema = attioToolInput(attioUpdateTaskRequestSchema)
export const attioDeleteTaskInputSchema = attioToolInput(attioDeleteTaskRequestSchema)
export const attioReadNotesInputSchema = attioToolInput(attioReadNotesRequestSchema)
export const attioCreateNoteInputSchema = attioToolInput(attioCreateNoteRequestSchema)
export const attioDeleteNoteInputSchema = attioToolInput(attioDeleteNoteRequestSchema)
export const attioReadCommentsInputSchema = attioToolInput(attioReadCommentsRequestSchema)
export const attioCreateCommentInputSchema = attioToolInput(attioCreateCommentRequestSchema)
export const attioDeleteCommentInputSchema = attioToolInput(attioDeleteCommentRequestSchema)
export const attioReadListsInputSchema = attioToolInput(attioReadListsRequestSchema)
export const attioCreateListInputSchema = attioToolInput(attioCreateListRequestSchema)
export const attioUpdateListInputSchema = attioToolInput(attioUpdateListRequestSchema)
export const attioReadListEntriesInputSchema = attioToolInput(attioReadListEntriesRequestSchema)
export const attioAddListEntryInputSchema = attioToolInput(attioAddListEntryRequestSchema)
export const attioUpsertListEntryInputSchema = attioToolInput(attioUpsertListEntryRequestSchema)
export const attioUpdateListEntryInputSchema = attioToolInput(attioUpdateListEntryRequestSchema)
export const attioRemoveListEntryInputSchema = attioToolInput(attioRemoveListEntryRequestSchema)
export const attioMeetingsInputSchema = attioToolInput(attioMeetingsRequestSchema)
export const attioReadFilesInputSchema = attioToolInput(attioReadFilesRequestSchema)
export const attioUploadFileInputSchema = attioToolInput(attioUploadFileRequestSchema)
export const attioDeleteFileInputSchema = attioToolInput(attioDeleteFileRequestSchema)
export const attioReadSchemaInputSchema = attioToolInput(attioReadSchemaRequestSchema)
export const attioModifySchemaInputSchema = attioToolInput(attioModifySchemaRequestSchema)

const attioToolOutputBaseSchema = toolOutputBaseSchema.omit({ success: true })

const attioTasksOutputSchema = attioToolOutputBaseSchema.extend({
    tasks: z.array(attioTaskSchema).optional(),
    task: attioTaskSchema.optional(),
    count: z.number().int().optional()
})

export const attioReadTasksTool = defineTool({
    name: "attio_read_tasks",
    description: `Read Attio tasks. Actions: 'list' (filter by linked record or completion state; limit/offset pagination) and 'get' (fetch by task ID). Tasks are follow-ups and reminders tied to CRM records.`,
    inputSchema: attioReadTasksInputSchema,
    outputSchema: attioTasksOutputSchema
})
export const attioCreateTaskTool = defineTool({
    name: "attio_create_task",
    description: `Create an Attio task: content (plaintext) plus optional deadline, assignees (workspace-member emails or IDs) and linked records.`,
    inputSchema: attioCreateTaskInputSchema,
    outputSchema: attioTasksOutputSchema
})
export const attioUpdateTaskTool = defineTool({
    name: "attio_update_task",
    description: `Update an Attio task's deadline, completion state, assignees or linked records. Task content cannot be changed.`,
    inputSchema: attioUpdateTaskInputSchema,
    outputSchema: attioTasksOutputSchema
})
export const attioDeleteTaskTool = defineTool({
    name: "attio_delete_task",
    description: `Permanently delete an Attio task.`,
    inputSchema: attioDeleteTaskInputSchema,
    outputSchema: attioTasksOutputSchema
})

const attioNotesOutputSchema = attioToolOutputBaseSchema.extend({
    notes: z.array(attioNoteSchema).optional(),
    note: attioNoteSchema.optional(),
    count: z.number().int().optional()
})

export const attioReadNotesTool = defineTool({
    name: "attio_read_notes",
    description: `Read Attio notes on records. Actions: 'list' (optionally scoped to one record; limit/offset pagination) and 'get' (fetch by note ID).`,
    inputSchema: attioReadNotesInputSchema,
    outputSchema: attioNotesOutputSchema
})
export const attioCreateNoteTool = defineTool({
    name: "attio_create_note",
    description: `Create a note on an Attio record: title + markdown or plaintext content. Use for logging research, call summaries or context onto CRM records.`,
    inputSchema: attioCreateNoteInputSchema,
    outputSchema: attioNotesOutputSchema
})
export const attioDeleteNoteTool = defineTool({
    name: "attio_delete_note",
    description: `Permanently delete an Attio note.`,
    inputSchema: attioDeleteNoteInputSchema,
    outputSchema: attioNotesOutputSchema
})

const attioCommentsOutputSchema = attioToolOutputBaseSchema.extend({
    comment: attioCommentSchema.optional(),
    threads: z.array(attioThreadSchema).optional(),
    thread: attioThreadSchema.optional(),
    count: z.number().int().optional()
})

export const attioReadCommentsTool = defineTool({
    name: "attio_read_comments",
    description: `Read Attio comments and threads on records. Actions: 'get' (a single comment), 'list_threads' (threads on a record), 'get_thread' (a thread with all its comments).`,
    inputSchema: attioReadCommentsInputSchema,
    outputSchema: attioCommentsOutputSchema
})
export const attioCreateCommentTool = defineTool({
    name: "attio_create_comment",
    description: `Create an Attio comment: reply to a thread via threadId, or start a new thread on a record via objectSlug + recordId. Requires an author workspace member ID (use attio_workspace_members to find it).`,
    inputSchema: attioCreateCommentInputSchema,
    outputSchema: attioCommentsOutputSchema
})
export const attioDeleteCommentTool = defineTool({
    name: "attio_delete_comment",
    description: `Permanently delete an Attio comment.`,
    inputSchema: attioDeleteCommentInputSchema,
    outputSchema: attioCommentsOutputSchema
})

const attioListsOutputSchema = attioToolOutputBaseSchema.extend({
    lists: z.array(attioListSchema).optional(),
    list: attioListSchema.optional(),
    entries: z.array(attioListEntrySchema).optional(),
    entry: attioListEntrySchema.optional(),
    count: z.number().int().optional(),
    offset: z.number().int().optional()
})

export const attioReadListsTool = defineTool({
    name: "attio_read_lists",
    description: `Read Attio lists. Actions: 'list' (all lists in the workspace) and 'get' (a list's configuration by ID or slug). List entries have their own tools (attio_read_list_entries and the entry write tools).`,
    inputSchema: attioReadListsInputSchema,
    outputSchema: attioListsOutputSchema
})
export const attioCreateListTool = defineTool({
    name: "attio_create_list",
    description: `Create a new Attio list over an object. This changes the workspace for every user.`,
    inputSchema: attioCreateListInputSchema,
    outputSchema: attioListsOutputSchema
})
export const attioUpdateListTool = defineTool({ name: "attio_update_list", description: `Rename an Attio list.`, inputSchema: attioUpdateListInputSchema, outputSchema: attioListsOutputSchema })
export const attioReadListEntriesTool = defineTool({
    name: "attio_read_list_entries",
    description: `Read entries of an Attio list. Actions: 'query_entries' (filter by entry attributes and/or parentRecordId; limit/offset pagination) and 'get_entry' (a single entry by ID).`,
    inputSchema: attioReadListEntriesInputSchema,
    outputSchema: attioListsOutputSchema
})
export const attioAddListEntryTool = defineTool({
    name: "attio_add_list_entry",
    description: `Add a record to an Attio list as a new entry, with optional entry attribute values (e.g. a stage). Throws on unique-attribute conflicts; the same record may appear in multiple entries.`,
    inputSchema: attioAddListEntryInputSchema,
    outputSchema: attioListsOutputSchema
})
export const attioUpsertListEntryTool = defineTool({
    name: "attio_upsert_list_entry",
    description: `Create or update an Attio list entry keyed by its parent record (idempotent membership): updates the existing entry if the record is already in the list, otherwise adds it.`,
    inputSchema: attioUpsertListEntryInputSchema,
    outputSchema: attioListsOutputSchema
})
export const attioUpdateListEntryTool = defineTool({
    name: "attio_update_list_entry",
    description: `Update an Attio list entry's attribute values (e.g. move its stage). multiselectMode 'append' adds to multi-value attributes instead of overwriting.`,
    inputSchema: attioUpdateListEntryInputSchema,
    outputSchema: attioListsOutputSchema
})
export const attioRemoveListEntryTool = defineTool({
    name: "attio_remove_list_entry",
    description: `Remove an entry from an Attio list. The parent record itself is untouched.`,
    inputSchema: attioRemoveListEntryInputSchema,
    outputSchema: attioListsOutputSchema
})

export const attioMeetingsTool = defineTool({
    name: "attio_meetings",
    description: `Read Attio meetings, call recordings and transcripts (read-only). Actions: 'list' (filter by linked record, participant emails or time range; cursor pagination via nextCursor), 'get', 'list_recordings' (recordings for a meeting), 'get_transcript' (transcript of a call recording). Use for call-summary and meeting-activity workflows.`,
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

const attioFilesOutputSchema = attioToolOutputBaseSchema.extend({
    files: z.array(attioFileSchema).optional(),
    file: attioFileSchema.optional(),
    downloadUrl: z.string().optional(),
    count: z.number().int().optional(),
    nextCursor: z.string().nullable().optional()
})

export const attioReadFilesTool = defineTool({
    name: "attio_read_files",
    description: `Read files attached to Attio records. Actions: 'list' (files on a record; cursor pagination), 'get' (file metadata), 'get_download_url' (signed URL for a file).`,
    inputSchema: attioReadFilesInputSchema,
    outputSchema: attioFilesOutputSchema
})
export const attioUploadFileTool = defineTool({
    name: "attio_upload_file",
    description: `Upload a file to an Attio record from base64 content (native Attio storage, max 50 MB).`,
    inputSchema: attioUploadFileInputSchema,
    outputSchema: attioFilesOutputSchema
})
export const attioDeleteFileTool = defineTool({
    name: "attio_delete_file",
    description: `Permanently delete a file from Attio (deleting a folder deletes its descendants).`,
    inputSchema: attioDeleteFileInputSchema,
    outputSchema: attioFilesOutputSchema
})

const attioSchemaOutputSchema = attioToolOutputBaseSchema.extend({
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

export const attioReadSchemaTool = defineTool({
    name: "attio_read_schema",
    description: `Read the Attio workspace schema. Actions: 'list_objects' (all object types with attributes — call before creating/updating records), 'get_object', 'list_attributes', 'list_statuses' (e.g. deal stages), 'list_select_options'. Attributes on lists use target 'lists'; on objects, target 'objects'.`,
    inputSchema: attioReadSchemaInputSchema,
    outputSchema: attioSchemaOutputSchema
})
export const attioModifySchemaTool = defineTool({
    name: "attio_modify_schema",
    description: `Change the Attio workspace schema — these writes affect every user of the workspace. Actions: 'create_object', 'update_object', 'create_attribute', 'update_attribute', 'create_status', 'update_status', 'create_select_option', 'update_select_option'. Attributes on lists use target 'lists'; on objects, target 'objects'. After schema writes, rerun terse generate to refresh generated types/constants.`,
    inputSchema: attioModifySchemaInputSchema,
    outputSchema: attioSchemaOutputSchema
})

export const attioWorkspaceMembersTool = defineTool({
    name: "attio_workspace_members",
    description: `Look up Attio workspace members (the people who use the CRM, not CRM records). Actions: 'list' returns every member with name, email address and access level; 'get' fetches one member by ID. Use this to resolve a record's owner (an actor reference holding a workspace member ID) to a person, e.g. to find the email address for a Slack DM, or to find the member ID/email to write into an owner attribute.`,
    inputSchema: attioWorkspaceMembersInputSchema,
    outputSchema: attioToolOutputBaseSchema.extend({
        members: z.array(attioWorkspaceMemberSchema).optional(),
        member: attioWorkspaceMemberSchema.optional(),
        count: z.number().int().optional()
    })
})

const attioRecordsOutputSchema = attioToolOutputBaseSchema.extend({
    records: z.array(attioRecordSchema).optional(),
    record: attioRecordSchema.optional(),
    matches: z.array(attioSearchMatchSchema).optional(),
    history: z.array(attioAttributeHistoryEntrySchema).optional(),
    count: z.number().int().optional(),
    offset: z.number().int().optional()
})

export const attioReadRecordsTool = defineTool({
    name: "attio_read_records",
    description: `Read records in Attio. Actions: 'query' (filtered listing with limit/offset pagination), 'search' (fuzzy match by name/email/domain; eventually consistent — use 'query' for read-after-write), 'get' (fetch by record ID), and 'get_attribute_history' (historic values of one attribute, e.g. every stage a deal has been in). Use attio_read_schema with the 'list_objects' action first to discover objects and their attributes.`,
    inputSchema: attioReadRecordsInputSchema,
    outputSchema: attioRecordsOutputSchema
})
export const attioCreateRecordTool = defineTool({
    name: "attio_create_record",
    description: `Create a new record in Attio. Unlike attio_upsert_record, no matching attribute is needed, so this works for objects without a unique writable attribute (e.g. deals).`,
    inputSchema: attioCreateRecordInputSchema,
    outputSchema: attioRecordsOutputSchema
})
export const attioUpdateRecordTool = defineTool({
    name: "attio_update_record",
    description: `Update an existing Attio record by its ID. Only the attributes present in 'values' are touched; multiselectMode 'append' adds to multi-value attributes instead of overwriting them.`,
    inputSchema: attioUpdateRecordInputSchema,
    outputSchema: attioRecordsOutputSchema
})
export const attioUpsertRecordsTool = defineTool({
    name: "attio_upsert_record",
    description: `Create or update one or more Attio records, matched on a unique writable attribute (e.g. 'email_addresses' for people, 'domains' for companies). If a match is found the record is updated, otherwise a new one is created. Throws if ANY record in the batch fails, naming each failure; earlier records may already be written (upserts are safe to retry).`,
    inputSchema: attioUpsertRecordsInputSchema,
    outputSchema: attioRecordsOutputSchema
})
export const attioDeleteRecordTool = defineTool({
    name: "attio_delete_record",
    description: `Permanently delete an Attio record by its ID. This cannot be undone.`,
    inputSchema: attioDeleteRecordInputSchema,
    outputSchema: attioRecordsOutputSchema
})

export const listWorkOSUsersTool = defineTool({
    name: "listWorkOSUsers",
    description:
        "List users from the customer's WorkOS account. Supports filtering by email and organization ID. Returns user profiles including email, name, and creation date. Use pagination (after cursor) for large user sets.",
    inputSchema: listWorkOSUsersInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        users: z.array(workOSUserSummarySchema),
        pagination: workOSPaginationSchema,
        message: z.string()
    })
})

export const listWorkOSOrganizationsTool = defineTool({
    name: "listWorkOSOrganizations",
    description: "List organizations from the customer's WorkOS account. Returns organization names, domains, external IDs, and timestamps. Use pagination (after cursor) for large organization sets.",
    inputSchema: listWorkOSOrganizationsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        organizations: z.array(workOSOrganizationSummarySchema),
        pagination: workOSPaginationSchema,
        message: z.string()
    })
})

export const getWorkOSUserTool = defineTool({
    name: "getWorkOSUser",
    description: "Get detailed information about a specific WorkOS user by their user ID. Returns profile data including email, name, verification status, and timestamps.",
    inputSchema: getWorkOSUserInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        user: workOSUserSummarySchema,
        message: z.string()
    })
})

export const listLaunchDarklyFlagsTool = defineTool({
    name: "listLaunchDarklyFlags",
    description: "List all feature flags with enabled/disabled states per environment. Use summary=true for quick overview, summary=false for full details.",
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
    description:
        "Get detailed information about a specific feature flag including targeting rules, rollout strategies, variations, and per-environment configuration. Optionally includes change history when includeHistory=true.",
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
    description:
        "Execute a read-only SQL query against a Snowflake data warehouse. Returns rows and column metadata. SQL safety is enforced by the Snowflake role configured for the integration — use a read-only role.",
    inputSchema: snowflakeExecuteQueryInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        rows: z.array(snowflakeQueryRowSchema),
        columns: z.array(z.string()),
        rowCount: z.number().int()
    })
})

export const snowflakeExplainQueryTool = defineTool({
    name: "snowflakeExplainQuery",
    description: "Get the query execution plan for a Snowflake SQL query using EXPLAIN. Use this to understand how Snowflake will execute a query before running it.",
    inputSchema: snowflakeExplainQueryInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        explainPlan: z.array(snowflakeQueryRowSchema),
        columns: z.array(z.string()),
        rowCount: z.number().int()
    })
})

export const webSearchTool = defineTool({
    name: "web_search",
    description:
        "Search the web for up-to-date information. Returns ranked results with titles, URLs, and content snippets. Use for questions about current events, facts, or topics requiring web sources.",
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
    description:
        "Persistent memory stored under /memories that survives across runs. Commands: view (read a file or list a directory), create, str_replace, insert, delete, rename. Always view /memories before starting a task, and record durable progress and learnings as you work.",
    inputSchema: memoryInputSchema,
    outputSchema: memoryOutputSchema
})

export const resendSendTemplateInputSchema = z.object({
    integrationId: z.string().describe("Connected Resend integration ID"),
    templateId: z.string().describe("Published template ID or alias"),
    to: z.array(z.email()).min(1).max(50).describe("Recipient email addresses"),
    variables: z.record(z.string(), z.union([z.string(), z.number()])).describe("Template variables keyed exactly as defined by the template"),
    from: z.string().nullable().optional().describe("Optional sender override; omit when the template defines one"),
    subject: z.string().nullable().optional().describe("Optional subject override; omit when the template defines one"),
    replyTo: z.email().nullable().optional().describe("Optional reply-to override"),
    cc: z.array(z.email()).nullable().optional().describe("Optional CC recipients"),
    bcc: z.array(z.email()).nullable().optional().describe("Optional BCC recipients"),
    idempotencyKey: z.string().max(256).nullable().optional().describe("Optional idempotency key, retained by Resend for 24 hours")
})

export const resendSendTemplateOutputSchema = toolOutputBaseSchema.extend({
    emailId: z.string(),
    templateId: z.string(),
    to: z.array(z.string()),
    summary: z.string()
})

export const resendSendTemplateTool = defineTool({
    name: "resend_send_template",
    description: "Send a published Resend email template. Supply every required template variable without a fallback value.",
    inputSchema: resendSendTemplateInputSchema,
    outputSchema: resendSendTemplateOutputSchema
})

// Apollo schemas — projections of Apollo.io's large payloads down to the fields GTM workflows need
export const apolloOrganizationSummarySchema = z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    primaryDomain: z.string().nullable(),
    industry: z.string().nullable(),
    estimatedNumEmployees: z.number().int().nullable()
})

export const apolloEnrichedPersonSchema = z.object({
    id: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    name: z.string().nullable(),
    title: z.string().nullable(),
    seniority: z.string().nullable(),
    email: z.string().nullable(),
    emailStatus: z.string().nullable(),
    linkedinUrl: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable(),
    organization: apolloOrganizationSummarySchema.nullable()
})

export const apolloOrganizationSchema = apolloOrganizationSummarySchema.extend({
    keywords: z.array(z.string()),
    annualRevenuePrinted: z.string().nullable(),
    totalFundingPrinted: z.string().nullable(),
    latestFundingStage: z.string().nullable(),
    foundedYear: z.number().int().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable(),
    linkedinUrl: z.string().nullable(),
    shortDescription: z.string().nullable(),
    technologyNames: z.array(z.string())
})

export const apolloSearchPersonSchema = z.object({
    id: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    name: z.string().nullable(),
    title: z.string().nullable(),
    hasEmail: z.boolean().nullable(),
    linkedinUrl: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable(),
    organization: apolloOrganizationSummarySchema.nullable()
})

// Apollo input schemas
const apolloPersonMatchFields = {
    id: z.string().nullable().optional().describe("Apollo person ID, e.g. from apollo_search_people results. The most reliable match key."),
    email: z.string().nullable().optional().describe("The person's email address."),
    firstName: z.string().nullable().optional().describe("The person's first name."),
    lastName: z.string().nullable().optional().describe("The person's last name."),
    name: z.string().nullable().optional().describe("The person's full name, if first/last are not known separately."),
    domain: z.string().nullable().optional().describe("The person's employer domain, without www or @ (e.g. acme.com)."),
    organizationName: z.string().nullable().optional().describe("The person's employer name."),
    linkedinUrl: z.string().nullable().optional().describe("The person's LinkedIn profile URL.")
}

export const apolloEnrichPersonInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Apollo connection to use."),
    ...apolloPersonMatchFields,
    revealPersonalEmails: z.boolean().nullable().optional().describe("Also return personal emails (may consume extra credits; suppressed for people in GDPR regions). Default false.")
})

export const apolloBulkEnrichPeopleInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Apollo connection to use."),
    people: z.array(z.object(apolloPersonMatchFields)).describe("Up to 10 people to enrich (Apollo's bulk_match limit). Each entry needs at least one match key (id, email, or name + domain)."),
    revealPersonalEmails: z.boolean().nullable().optional().describe("Also return personal emails (may consume extra credits; suppressed for people in GDPR regions). Default false.")
})

export const apolloEnrichOrganizationInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Apollo connection to use."),
    domain: z.string().describe("The company domain to enrich, without www or @ (e.g. acme.com).")
})

export const apolloSearchPeopleInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Apollo connection to use."),
    personTitles: z.array(z.string()).nullable().optional().describe('Job titles to match, e.g. ["Head of Marketing", "DevRel"].'),
    includeSimilarTitles: z.boolean().nullable().optional().describe("Whether to also match titles similar to personTitles. Default true."),
    personSeniorities: z.array(z.string()).nullable().optional().describe("Seniorities to match: owner, founder, c_suite, partner, vp, head, director, manager, senior, entry, intern."),
    personLocations: z.array(z.string()).nullable().optional().describe('Person locations, e.g. ["New York, US", "Germany"].'),
    organizationLocations: z.array(z.string()).nullable().optional().describe("Company HQ locations."),
    organizationDomains: z.array(z.string()).nullable().optional().describe("Company domains to search within, without www or @."),
    organizationNumEmployeesRanges: z.array(z.string()).nullable().optional().describe('Headcount ranges as "min,max" strings, e.g. ["11,50", "51,200"].'),
    keywords: z.string().nullable().optional().describe("Free-text keywords to narrow results."),
    contactEmailStatus: z.array(z.string()).nullable().optional().describe("Filter by email status: verified, unverified, likely to engage, unavailable."),
    page: z.number().int().min(1).nullable().optional().describe("Result page to fetch. Default 1."),
    perPage: z.number().int().min(1).max(100).nullable().optional().describe("Results per page, 1-100. Default 25.")
})

export const apolloEnrichPersonTool = defineTool({
    name: "apollo_enrich_person",
    description:
        "Enrich a person via Apollo.io by Apollo ID, email, or name plus company domain. Returns contact details, seniority, location, and employer firmographics. Consumes one Apollo export credit per successful match.",
    inputSchema: apolloEnrichPersonInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        found: z.boolean(),
        person: apolloEnrichedPersonSchema.nullable()
    })
})

export const apolloBulkEnrichPeopleTool = defineTool({
    name: "apollo_bulk_enrich_people",
    description:
        "Enrich up to 10 people in a single Apollo.io call, using the same match keys as apollo_enrich_person. Consumes one Apollo export credit per matched person. Prefer this over repeated apollo_enrich_person calls for lists.",
    inputSchema: apolloBulkEnrichPeopleInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        matches: z.array(apolloEnrichedPersonSchema),
        matchedCount: z.number().int(),
        requestedCount: z.number().int()
    })
})

export const apolloEnrichOrganizationTool = defineTool({
    name: "apollo_enrich_organization",
    description:
        "Enrich a company via Apollo.io by domain. Returns firmographics: industry, headcount, revenue, funding, location, keywords, and technologies. Consumes one Apollo export credit per matched company.",
    inputSchema: apolloEnrichOrganizationInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        found: z.boolean(),
        organization: apolloOrganizationSchema.nullable()
    })
})

export const apolloSearchPeopleTool = defineTool({
    name: "apollo_search_people",
    description:
        "Search Apollo.io for people by title, seniority, location, company domain, and headcount filters to build prospect lists. Consumes no credits but requires the connected key to be an Apollo master API key. Results never include emails — pass result ids to apollo_bulk_enrich_people to unlock contact data.",
    inputSchema: apolloSearchPeopleInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        people: z.array(apolloSearchPersonSchema),
        totalEntries: z.number().int(),
        page: z.number().int(),
        perPage: z.number().int()
    })
})

export const apolloJobPostingSchema = z.object({
    id: z.string(),
    title: z.string().nullable(),
    url: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable(),
    postedAt: z.string().nullable(),
    lastSeenAt: z.string().nullable()
})

export const apolloListJobPostingsInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Apollo connection to use."),
    organizationId: z.string().describe("The Apollo organization ID to list job postings for, e.g. the id returned by apollo_enrich_organization or in apollo_search_people results."),
    page: z.number().int().min(1).nullable().optional().describe("Result page to fetch. Default 1."),
    perPage: z.number().int().min(1).max(500).nullable().optional().describe("Results per page, 1-500. Default 100. Apollo charges per page returned, so prefer one large page over many small ones.")
})

export const apolloListJobPostingsTool = defineTool({
    name: "apollo_list_job_postings",
    description:
        "List active job postings at a company via Apollo.io, as a hiring signal (open roles, titles, locations, posted dates). Takes the Apollo organization ID from apollo_enrich_organization. Works with any Apollo key (no master key needed) but consumes Apollo credits per page of results returned — fetch one large page instead of paging in small steps. Postings include title/url/location metadata only, not full descriptions; assess role fit from the title.",
    inputSchema: apolloListJobPostingsInputSchema,
    outputSchema: toolOutputBaseSchema.extend({
        postings: z.array(apolloJobPostingSchema),
        totalPostings: z.number().int(),
        page: z.number().int(),
        perPage: z.number().int()
    })
})

const SITE_URL_DESCRIPTION =
    'The Search Console property to operate on. Either a URL-prefix property including the trailing slash ("https://example.com/") or a Domain property ("sc-domain:example.com"). Must be within the properties this agent is allowed to use.'

export const googleSearchConsoleIntegrationIdSchema = z.string().describe("The integration ID of the Google Search Console connection to use.")

export const googleSearchConsoleListSitesTool = defineTool({
    name: "google_search_console_list_sites",
    description:
        "List every Search Console property the connected Google account can access, with the account's permission level on each. Use this to discover the exact property identifier (URL-prefix or sc-domain form) to pass to the other Search Console tools. Note that the account may be able to see properties this agent is not allowed to act on.",
    inputSchema: z.object({
        integrationId: googleSearchConsoleIntegrationIdSchema
    }),
    outputSchema: toolOutputBaseSchema.extend({
        sites: z.array(googleSearchConsoleSiteSchema)
    })
})

export const googleSearchConsoleGetSiteTool = defineTool({
    name: "google_search_console_get_site",
    description: "Retrieve one Search Console property and the connected account's permission level on it. Fails if the account has no access to the property.",
    inputSchema: z.object({
        integrationId: googleSearchConsoleIntegrationIdSchema,
        siteUrl: z.string().describe(SITE_URL_DESCRIPTION)
    }),
    outputSchema: toolOutputBaseSchema.extend({
        site: googleSearchConsoleSiteSchema
    })
})

export const googleSearchConsoleAddSiteTool = defineTool({
    name: "google_search_console_add_site",
    description:
        "Add a property to the connected Google account's Search Console. The property starts unverified and returns no Search Analytics data until ownership is verified out of band. Adding a property is a real change to the user's Google account, so only do it when explicitly asked.",
    inputSchema: z.object({
        integrationId: googleSearchConsoleIntegrationIdSchema,
        siteUrl: z.string().describe(SITE_URL_DESCRIPTION)
    }),
    outputSchema: toolOutputBaseSchema.extend({
        siteUrl: z.string()
    })
})

export const googleSearchConsoleDeleteSiteTool = defineTool({
    name: "google_search_console_delete_site",
    description:
        "Remove a property from the connected Google account's Search Console. This unlinks the account from the property and its historical Search Analytics data becomes inaccessible to this account. Destructive: confirm the exact property before calling.",
    inputSchema: z.object({
        integrationId: googleSearchConsoleIntegrationIdSchema,
        siteUrl: z.string().describe(SITE_URL_DESCRIPTION)
    }),
    outputSchema: toolOutputBaseSchema.extend({
        siteUrl: z.string()
    })
})

export const googleSearchConsoleSitemapContentSchema = z.object({
    type: z.string().nullable(),
    submitted: z.number().nullable()
})

export const googleSearchConsoleSitemapSchema = z.object({
    path: z.string().nullable(),
    type: z.string().nullable(),
    isPending: z.boolean().nullable(),
    isSitemapsIndex: z.boolean().nullable(),
    lastSubmitted: z.string().nullable(),
    lastDownloaded: z.string().nullable(),
    errors: z.number().nullable(),
    warnings: z.number().nullable(),
    contents: z.array(googleSearchConsoleSitemapContentSchema)
})

export const googleSearchConsoleListSitemapsTool = defineTool({
    name: "google_search_console_list_sitemaps",
    description:
        "List the sitemaps Google knows about for a property, including submission time, last download time, and error and warning counts. Use this to check whether a sitemap was picked up and processed.",
    inputSchema: z.object({
        integrationId: googleSearchConsoleIntegrationIdSchema,
        siteUrl: z.string().describe(SITE_URL_DESCRIPTION),
        sitemapIndex: z
            .string()
            .nullable()
            .optional()
            .describe('Full URL of a sitemap index file. When set, only the sitemaps contained in that index are returned, e.g. "https://example.com/sitemap_index.xml".')
    }),
    outputSchema: toolOutputBaseSchema.extend({
        sitemaps: z.array(googleSearchConsoleSitemapSchema)
    })
})

export const googleSearchConsoleGetSitemapTool = defineTool({
    name: "google_search_console_get_sitemap",
    description: "Retrieve the processing details of a single sitemap: pending state, error and warning counts, and per-content-type URL counts.",
    inputSchema: z.object({
        integrationId: googleSearchConsoleIntegrationIdSchema,
        siteUrl: z.string().describe(SITE_URL_DESCRIPTION),
        feedpath: z.string().describe('Full URL of the sitemap, e.g. "https://example.com/sitemap.xml".')
    }),
    outputSchema: toolOutputBaseSchema.extend({
        sitemap: googleSearchConsoleSitemapSchema
    })
})

export const googleSearchConsoleSubmitSitemapTool = defineTool({
    name: "google_search_console_submit_sitemap",
    description:
        "Submit a sitemap to Google for a property. Submission only queues the sitemap for crawling; processing results appear later via google_search_console_get_sitemap. The property must be verified and the account needs full or owner permission.",
    inputSchema: z.object({
        integrationId: googleSearchConsoleIntegrationIdSchema,
        siteUrl: z.string().describe(SITE_URL_DESCRIPTION),
        feedpath: z.string().describe('Full URL of the sitemap to submit, e.g. "https://example.com/sitemap.xml". Must be hosted under the property.')
    }),
    outputSchema: toolOutputBaseSchema.extend({
        feedpath: z.string()
    })
})

export const googleSearchConsoleDeleteSitemapTool = defineTool({
    name: "google_search_console_delete_sitemap",
    description:
        "Remove a sitemap submission from a property. Google stops tracking the sitemap; already-indexed URLs are not removed from the index. Destructive: confirm the exact sitemap before calling.",
    inputSchema: z.object({
        integrationId: googleSearchConsoleIntegrationIdSchema,
        siteUrl: z.string().describe(SITE_URL_DESCRIPTION),
        feedpath: z.string().describe('Full URL of the sitemap to remove, e.g. "https://example.com/sitemap.xml".')
    }),
    outputSchema: toolOutputBaseSchema.extend({
        feedpath: z.string()
    })
})

export const googleSearchConsoleDimensionSchema = z.enum(["country", "device", "page", "query", "searchAppearance", "date"])

export const googleSearchConsoleDimensionFilterSchema = z.object({
    dimension: googleSearchConsoleDimensionSchema.describe("The dimension to filter on. You do not have to group by a dimension to filter on it."),
    operator: z
        .enum(["contains", "equals", "notContains", "notEquals", "includingRegex", "excludingRegex"])
        .nullable()
        .optional()
        .describe('How to compare. Defaults to "equals". Regex operators use RE2 syntax.'),
    expression: z.string().describe("The value to compare against. Comparisons are not case sensitive.")
})

export const googleSearchConsoleDimensionFilterGroupSchema = z.object({
    groupType: z.enum(["and"]).nullable().optional().describe('How filters inside this group combine. Google currently only supports "and".'),
    filters: z.array(googleSearchConsoleDimensionFilterSchema)
})

export const googleSearchConsoleSearchAnalyticsRowSchema = z.object({
    dimensions: z.partialRecord(googleSearchConsoleDimensionSchema, z.string()).describe("The requested dimensions, keyed by dimension name. Empty when no dimensions were requested."),
    clicks: z.number(),
    impressions: z.number(),
    ctr: z.number(),
    position: z.number()
})

export const googleSearchConsoleQuerySearchAnalyticsTool = defineTool({
    name: "google_search_console_query_search_analytics",
    description: `Query Search Analytics for a property: clicks, impressions, CTR, and average position, optionally grouped and filtered by dimension.

WHEN TO USE THIS TOOL:
- Top queries or top pages for a date range
- Comparing performance between two periods (run one query per period)
- Drilling into one page, country, or device using dimensionFilterGroups

IMPORTANT NOTES:
- Dates are inclusive, YYYY-MM-DD, in PST (UTC-8). Search Console data lags by roughly 2-3 days, so a range ending today usually returns nothing for the most recent days.
- Results are grouped in the order the dimensions are supplied, and each row's dimension values come back in the "dimensions" object keyed by dimension name.
- Grouping or filtering by page forbids aggregationType "byProperty".
- Google caps the result set at 25000 rows per request; page through larger result sets with startRow.
- Anonymized queries are omitted from query-grouped results, so summing clicks across query rows will not match the property total.`,
    inputSchema: z.object({
        integrationId: googleSearchConsoleIntegrationIdSchema,
        siteUrl: z.string().describe(SITE_URL_DESCRIPTION),
        startDate: z.string().describe("First day of the range, inclusive, as YYYY-MM-DD in PST."),
        endDate: z.string().describe("Last day of the range, inclusive, as YYYY-MM-DD in PST. Must be on or after startDate."),
        dimensions: z
            .array(googleSearchConsoleDimensionSchema)
            .nullable()
            .optional()
            .describe("Dimensions to group by, applied in the order given. Omit for a single totals row covering the whole range."),
        dimensionFilterGroups: z.array(googleSearchConsoleDimensionFilterGroupSchema).nullable().optional().describe("Filters to apply. All groups must pass for a row to be returned."),
        type: z.enum(["web", "image", "video", "news", "discover", "googleNews"]).nullable().optional().describe('Report type to query. Defaults to "web".'),
        aggregationType: z.enum(["auto", "byPage", "byProperty"]).nullable().optional().describe('How data is aggregated. Defaults to "auto". Use "auto" whenever grouping or filtering by page.'),
        rowLimit: z.number().int().min(1).max(25000).nullable().optional().describe("Maximum rows to return, 1 to 25000. Defaults to 1000."),
        startRow: z.number().int().min(0).nullable().optional().describe("Zero-based index of the first row to return. Use with rowLimit to page through large result sets."),
        dataState: z.enum(["final", "all"]).nullable().optional().describe('Whether to include incomplete recent data. "final" (the default) excludes it; "all" includes partial days.')
    }),
    outputSchema: toolOutputBaseSchema.extend({
        rows: z.array(googleSearchConsoleSearchAnalyticsRowSchema),
        responseAggregationType: z.string().nullable(),
        firstIncompleteDate: z
            .string()
            .nullable()
            .describe('First date whose data is still being collected, so values from it onward may change. Only populated when dataState is "all" and the results are grouped by date.')
    })
})

export const googleSearchConsoleIndexStatusSchema = z.object({
    verdict: z.string().nullable(),
    coverageState: z.string().nullable(),
    robotsTxtState: z.string().nullable(),
    indexingState: z.string().nullable(),
    pageFetchState: z.string().nullable(),
    lastCrawlTime: z.string().nullable(),
    crawledAs: z.string().nullable(),
    googleCanonical: z.string().nullable(),
    userCanonical: z.string().nullable(),
    referringUrls: z.array(z.string()),
    sitemap: z.array(z.string())
})

export const googleSearchConsoleInspectUrlTool = defineTool({
    name: "google_search_console_inspect_url",
    description:
        "Inspect Google's index status for one URL under a property: whether it is indexed, the canonical Google picked, robots.txt and fetch state, last crawl time, and which sitemaps reference it. Use this to diagnose why a specific page is not appearing in search. The URL must sit under the property being inspected.",
    inputSchema: z.object({
        integrationId: googleSearchConsoleIntegrationIdSchema,
        siteUrl: z.string().describe(SITE_URL_DESCRIPTION),
        inspectionUrl: z.string().describe("The fully-qualified URL to inspect. Must be under the property given in siteUrl."),
        languageCode: z.string().nullable().optional().describe('BCP-47 language code for issue messages, e.g. "en-US". Defaults to "en-US".')
    }),
    outputSchema: toolOutputBaseSchema.extend({
        inspectionResultLink: z.string().nullable().describe("Link to the same inspection in the Search Console UI."),
        indexStatus: googleSearchConsoleIndexStatusSchema.nullable(),
        mobileUsabilityVerdict: z.string().nullable(),
        richResultsVerdict: z.string().nullable(),
        ampVerdict: z.string().nullable()
    })
})

const metaAdsToolInput = <T extends z.ZodType>(request: T) =>
    z.object({
        integrationId: z.string().describe("The integration ID of the Meta Ads connection to use."),
        request: request.describe("The operation to perform and its arguments.")
    })

const metaAdsAdAccountIdField = z.string().describe("The Meta ad account ID, with or without the 'act_' prefix (e.g. 'act_1234567890').")

export const metaAdsAdAccountEntitySchema = z.object({
    id: z.string(),
    account_id: z.string(),
    name: z.string(),
    currency: z.string().optional(),
    account_status: z.number().optional()
})
export type MetaAdsAdAccountEntity = z.infer<typeof metaAdsAdAccountEntitySchema>

export const metaAdsCampaignSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    effective_status: z.string().optional(),
    objective: z.string().optional(),
    daily_budget: z.string().optional(),
    lifetime_budget: z.string().optional(),
    start_time: z.string().optional(),
    stop_time: z.string().optional()
})
export type MetaAdsCampaign = z.infer<typeof metaAdsCampaignSchema>

export const metaAdsAdSetSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    effective_status: z.string().optional(),
    campaign_id: z.string().optional(),
    daily_budget: z.string().optional(),
    lifetime_budget: z.string().optional(),
    optimization_goal: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional()
})
export type MetaAdsAdSet = z.infer<typeof metaAdsAdSetSchema>

export const metaAdsInsightsRowSchema = z.object({
    date_start: z.string().optional(),
    date_stop: z.string().optional(),
    campaign_id: z.string().optional(),
    campaign_name: z.string().optional(),
    adset_id: z.string().optional(),
    adset_name: z.string().optional(),
    ad_id: z.string().optional(),
    ad_name: z.string().optional(),
    age: z.string().optional(),
    gender: z.string().optional(),
    country: z.string().optional(),
    publisher_platform: z.string().optional(),
    platform_position: z.string().optional(),
    impression_device: z.string().optional(),
    spend: z.string().optional(),
    impressions: z.string().optional(),
    clicks: z.string().optional(),
    ctr: z.string().optional(),
    cpc: z.string().optional(),
    reach: z.string().optional(),
    actions: z.array(z.object({ action_type: z.string(), value: z.string() })).optional()
})
export type MetaAdsInsightsRow = z.infer<typeof metaAdsInsightsRowSchema>

export const metaAdsCustomAudienceSchema = z.object({
    id: z.string(),
    name: z.string(),
    subtype: z.string().optional(),
    approximate_count_lower_bound: z.number().optional(),
    approximate_count_upper_bound: z.number().optional(),
    delivery_status: z
        .object({
            code: z.number().optional(),
            description: z.string().optional()
        })
        .optional()
})
export type MetaAdsCustomAudience = z.infer<typeof metaAdsCustomAudienceSchema>

export const metaAdsListAdAccountsRequestSchema = z.object({
    action: z.literal("list_ad_accounts").describe("List the ad accounts accessible to the connected Meta user.")
})
export const metaAdsListCampaignsRequestSchema = z.object({
    action: z.literal("list_campaigns").describe("List campaigns in an ad account with status and budget."),
    adAccountId: metaAdsAdAccountIdField,
    effectiveStatuses: z.array(z.string()).nullable().optional().describe("Only campaigns whose effective status is in this list (e.g. ACTIVE, PAUSED)."),
    limit: z.number().int().min(1).max(500).nullable().optional().describe("Maximum number of campaigns to return (default 100).")
})
export const metaAdsListAdSetsRequestSchema = z.object({
    action: z.literal("list_adsets").describe("List ad sets in an ad account with status and budget."),
    adAccountId: metaAdsAdAccountIdField,
    campaignId: z.string().nullable().optional().describe("Only ad sets belonging to this campaign."),
    effectiveStatuses: z.array(z.string()).nullable().optional().describe("Only ad sets whose effective status is in this list (e.g. ACTIVE, PAUSED)."),
    limit: z.number().int().min(1).max(500).nullable().optional().describe("Maximum number of ad sets to return (default 100).")
})
export const metaAdsReadCampaignsRequestSchema = z.discriminatedUnion("action", [metaAdsListAdAccountsRequestSchema, metaAdsListCampaignsRequestSchema, metaAdsListAdSetsRequestSchema])

export type MetaAdsListAdAccountsRequest = z.infer<typeof metaAdsListAdAccountsRequestSchema>
export type MetaAdsListCampaignsRequest = z.infer<typeof metaAdsListCampaignsRequestSchema>
export type MetaAdsListAdSetsRequest = z.infer<typeof metaAdsListAdSetsRequestSchema>
export type MetaAdsReadCampaignsRequest = z.infer<typeof metaAdsReadCampaignsRequestSchema>

export const metaAdsDatePresetSchema = z.enum(["today", "yesterday", "last_7d", "last_14d", "last_28d", "last_30d", "last_90d", "this_month", "last_month", "this_quarter", "maximum"])
export type MetaAdsDatePreset = z.infer<typeof metaAdsDatePresetSchema>

export const metaAdsBreakdownSchema = z.enum(["age", "gender", "country", "publisher_platform", "platform_position", "impression_device"])
export type MetaAdsBreakdown = z.infer<typeof metaAdsBreakdownSchema>

export const metaAdsReadInsightsRequestSchema = z.object({
    adAccountId: metaAdsAdAccountIdField,
    level: z.enum(["campaign", "adset", "ad"]).describe("Aggregation level for insight rows. Use 'ad' to compare individual creatives against each other."),
    datePreset: metaAdsDatePresetSchema.nullable().optional().describe("Relative date range. Use either datePreset or since/until, not both."),
    since: z.string().nullable().optional().describe("Start date (YYYY-MM-DD). Use together with until instead of datePreset."),
    until: z.string().nullable().optional().describe("End date (YYYY-MM-DD), inclusive."),
    campaignIds: z.array(z.string()).nullable().optional().describe("Restrict results to these campaign IDs."),
    adsetIds: z.array(z.string()).nullable().optional().describe("Restrict results to these ad set IDs."),
    adIds: z.array(z.string()).nullable().optional().describe("Restrict results to these ad IDs."),
    breakdowns: z
        .array(metaAdsBreakdownSchema)
        .nullable()
        .optional()
        .describe("Split each row by these dimensions. Every breakdown multiplies the row count, so combine at most two and expect truncation."),
    timeIncrement: z.number().int().min(1).max(90).nullable().optional().describe("Split rows into N-day windows (1 = daily). Omit for a single aggregate row per entity.")
})
export type MetaAdsReadInsightsRequest = z.infer<typeof metaAdsReadInsightsRequestSchema>

export const metaAdsPixelSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    last_fired_time: z.string().optional()
})
export type MetaAdsPixel = z.infer<typeof metaAdsPixelSchema>

export const metaAdsListPixelsRequestSchema = z.object({
    adAccountId: metaAdsAdAccountIdField,
    limit: z.number().int().min(1).max(500).nullable().optional().describe("Maximum number of pixels to return (default 100).")
})
export type MetaAdsListPixelsRequest = z.infer<typeof metaAdsListPixelsRequestSchema>

export const metaAdsReadAudiencesRequestSchema = z.object({
    adAccountId: metaAdsAdAccountIdField,
    limit: z.number().int().min(1).max(500).nullable().optional().describe("Maximum number of audiences to return (default 100).")
})
export type MetaAdsReadAudiencesRequest = z.infer<typeof metaAdsReadAudiencesRequestSchema>

const metaAdsAudienceUserSchema = z.object({
    email: z.string().nullable().optional().describe("Email address. Normalized and SHA-256 hashed before upload; never sent in plain text."),
    phone: z.string().nullable().optional().describe("Phone number including country code. Normalized and SHA-256 hashed before upload."),
    externalId: z.string().nullable().optional().describe("Your CRM identifier for this person (sent as EXTERN_ID).")
})
export type MetaAdsAudienceUser = z.infer<typeof metaAdsAudienceUserSchema>

const metaAdsAudienceUsersFields = {
    audienceId: z.string().describe("The custom audience ID."),
    users: z.array(metaAdsAudienceUserSchema).min(1).max(500).describe("Users to match. Each entry needs at least one of email, phone, or externalId.")
}
export const metaAdsAddAudienceUsersRequestSchema = z.object({
    action: z.literal("add").describe("Add users to the custom audience."),
    ...metaAdsAudienceUsersFields
})
export const metaAdsRemoveAudienceUsersRequestSchema = z.object({
    action: z.literal("remove").describe("Remove users from the custom audience."),
    ...metaAdsAudienceUsersFields
})
export const metaAdsUpdateAudienceUsersRequestSchema = z.discriminatedUnion("action", [metaAdsAddAudienceUsersRequestSchema, metaAdsRemoveAudienceUsersRequestSchema])

export type MetaAdsAddAudienceUsersRequest = z.infer<typeof metaAdsAddAudienceUsersRequestSchema>
export type MetaAdsRemoveAudienceUsersRequest = z.infer<typeof metaAdsRemoveAudienceUsersRequestSchema>
export type MetaAdsUpdateAudienceUsersRequest = z.infer<typeof metaAdsUpdateAudienceUsersRequestSchema>

export const metaAdsConversionEventSchema = z.object({
    eventName: z.string().describe("Event name, e.g. 'Purchase', 'Lead', or a custom event name."),
    eventTime: z.number().int().describe("Unix timestamp in seconds when the conversion happened; must be within the last 7 days."),
    actionSource: z
        .enum(["website", "email", "phone_call", "chat", "physical_store", "system_generated", "app", "other"])
        .describe("Where the conversion happened. Use 'system_generated' for CRM-sourced conversions."),
    userData: metaAdsAudienceUserSchema
        .extend({
            clickId: z.string().nullable().optional().describe("Meta click ID (fbc) captured from the original ad click, for click-through matching."),
            browserId: z.string().nullable().optional().describe("Meta browser ID (fbp) cookie value.")
        })
        .describe("Match keys for the person who converted. Provide as many as available; emails and phones are hashed before upload."),
    eventId: z.string().nullable().optional().describe("Deduplication ID shared with any pixel event for the same conversion."),
    value: z.number().nullable().optional().describe("Monetary value of the conversion."),
    currency: z.string().nullable().optional().describe("ISO 4217 currency code; required when value is set."),
    eventSourceUrl: z.string().nullable().optional().describe("URL where the conversion happened, when actionSource is 'website'.")
})
export type MetaAdsConversionEvent = z.infer<typeof metaAdsConversionEventSchema>

export const metaAdsSendConversionsRequestSchema = z.object({
    datasetId: z.string().describe("The dataset (pixel) ID that receives Conversions API events."),
    events: z.array(metaAdsConversionEventSchema).min(1).max(1000).describe("Conversion events to send.")
})
export type MetaAdsSendConversionsRequest = z.infer<typeof metaAdsSendConversionsRequestSchema>

export const metaAdsPageSchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.string().optional()
})
export type MetaAdsPage = z.infer<typeof metaAdsPageSchema>

export const metaAdsReadPagesRequestSchema = z.object({
    limit: z.number().int().min(1).max(200).nullable().optional().describe("Maximum number of pages to return (default 100).")
})
export type MetaAdsReadPagesRequest = z.infer<typeof metaAdsReadPagesRequestSchema>

export const metaAdsAdCreativeSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    title: z.string().optional(),
    body: z.string().optional(),
    image_url: z.string().optional(),
    thumbnail_url: z.string().optional(),
    object_story_spec: z.unknown().optional()
})
export type MetaAdsAdCreative = z.infer<typeof metaAdsAdCreativeSchema>

export const metaAdsAdSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    effective_status: z.string().optional(),
    campaign_id: z.string().optional(),
    adset_id: z.string().optional(),
    created_time: z.string().optional(),
    creative: metaAdsAdCreativeSchema.optional()
})
export type MetaAdsAd = z.infer<typeof metaAdsAdSchema>

export const metaAdsReadAdsRequestSchema = z.object({
    adAccountId: metaAdsAdAccountIdField,
    adsetId: z.string().nullable().optional().describe("Only ads belonging to this ad set."),
    campaignId: z.string().nullable().optional().describe("Only ads belonging to this campaign. Ignored when adsetId is set."),
    effectiveStatuses: z.array(z.string()).nullable().optional().describe("Only ads whose effective status is in this list (e.g. ACTIVE, PAUSED, PENDING_REVIEW, DISAPPROVED)."),
    limit: z.number().int().min(1).max(500).nullable().optional().describe("Maximum number of ads to return (default 100).")
})
export type MetaAdsReadAdsRequest = z.infer<typeof metaAdsReadAdsRequestSchema>

export const metaAdsCallToActionSchema = z.enum(["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "SUBSCRIBE", "BOOK_TRAVEL", "DOWNLOAD", "GET_OFFER", "GET_QUOTE", "CONTACT_US", "APPLY_NOW", "NO_BUTTON"])
export type MetaAdsCallToAction = z.infer<typeof metaAdsCallToActionSchema>

export const metaAdsCreateAdRequestSchema = z.object({
    adAccountId: metaAdsAdAccountIdField,
    adsetId: z.string().describe("The ad set the new ad belongs to. Ad sets own targeting and budget, so the new ad inherits both."),
    pageId: z.string().describe("The Facebook Page the ad is published as. Discover candidates with meta_ads_read_pages."),
    name: z.string().describe("Internal name for the new ad, e.g. 'Spring promo - variant C'."),
    message: z.string().describe("Primary text shown above the creative."),
    linkUrl: z.string().describe("Destination URL for the click-through."),
    pictureUrl: z.string().describe("Publicly reachable image URL. Meta fetches it once at creation and copies it into the ad account's image library."),
    headline: z.string().nullable().optional().describe("Headline shown under the image."),
    description: z.string().nullable().optional().describe("Link description shown under the headline."),
    callToAction: metaAdsCallToActionSchema.nullable().optional().describe("Button label. Defaults to LEARN_MORE."),
    status: z.enum(["ACTIVE", "PAUSED"]).nullable().optional().describe("Status to request after Meta's review completes. Defaults to PAUSED so a human can switch it on.")
})
export type MetaAdsCreateAdRequest = z.infer<typeof metaAdsCreateAdRequestSchema>

export const metaAdsSetStatusRequestSchema = z.object({
    entityType: z.enum(["campaign", "adset", "ad"]).describe("Which kind of object to update."),
    entityId: z.string().describe("The ID of the campaign, ad set, or ad."),
    status: z.enum(["ACTIVE", "PAUSED"]).describe("PAUSED stops delivery and spend; ACTIVE resumes it.")
})
export type MetaAdsSetStatusRequest = z.infer<typeof metaAdsSetStatusRequestSchema>

export const metaAdsReadCampaignsInputSchema = metaAdsToolInput(metaAdsReadCampaignsRequestSchema)
export const metaAdsReadInsightsInputSchema = metaAdsToolInput(metaAdsReadInsightsRequestSchema)
export const metaAdsListPixelsInputSchema = metaAdsToolInput(metaAdsListPixelsRequestSchema)
export const metaAdsReadAudiencesInputSchema = metaAdsToolInput(metaAdsReadAudiencesRequestSchema)
export const metaAdsUpdateAudienceUsersInputSchema = metaAdsToolInput(metaAdsUpdateAudienceUsersRequestSchema)
export const metaAdsSendConversionsInputSchema = metaAdsToolInput(metaAdsSendConversionsRequestSchema)
export const metaAdsReadPagesInputSchema = metaAdsToolInput(metaAdsReadPagesRequestSchema)
export const metaAdsReadAdsInputSchema = metaAdsToolInput(metaAdsReadAdsRequestSchema)
export const metaAdsCreateAdInputSchema = metaAdsToolInput(metaAdsCreateAdRequestSchema)
export const metaAdsSetStatusInputSchema = metaAdsToolInput(metaAdsSetStatusRequestSchema)

export const metaAdsReadCampaignsOutputSchema = toolOutputBaseSchema.extend({
    adAccounts: z.array(metaAdsAdAccountEntitySchema).optional(),
    campaigns: z.array(metaAdsCampaignSchema).optional(),
    adsets: z.array(metaAdsAdSetSchema).optional(),
    count: z.number()
})

export const metaAdsReadInsightsOutputSchema = toolOutputBaseSchema.extend({
    rows: z.array(metaAdsInsightsRowSchema),
    count: z.number(),
    truncated: z.boolean()
})

export const metaAdsListPixelsOutputSchema = toolOutputBaseSchema.extend({
    pixels: z.array(metaAdsPixelSchema),
    count: z.number()
})

export const metaAdsReadAudiencesOutputSchema = toolOutputBaseSchema.extend({
    audiences: z.array(metaAdsCustomAudienceSchema),
    count: z.number()
})

export const metaAdsUpdateAudienceUsersOutputSchema = toolOutputBaseSchema.extend({
    audienceId: z.string(),
    numReceived: z.number(),
    numInvalidEntries: z.number()
})

export const metaAdsSendConversionsOutputSchema = toolOutputBaseSchema.extend({
    datasetId: z.string(),
    eventsReceived: z.number(),
    fbtraceId: z.string().optional()
})

export const metaAdsReadPagesOutputSchema = toolOutputBaseSchema.extend({
    pages: z.array(metaAdsPageSchema),
    count: z.number()
})

export const metaAdsReadAdsOutputSchema = toolOutputBaseSchema.extend({
    ads: z.array(metaAdsAdSchema),
    count: z.number()
})

export const metaAdsCreateAdOutputSchema = toolOutputBaseSchema.extend({
    adId: z.string(),
    creativeId: z.string(),
    adsetId: z.string(),
    requestedStatus: z.enum(["ACTIVE", "PAUSED"])
})

export const metaAdsSetStatusOutputSchema = toolOutputBaseSchema.extend({
    entityType: z.enum(["campaign", "adset", "ad"]),
    entityId: z.string(),
    status: z.enum(["ACTIVE", "PAUSED"])
})

export const metaAdsReadCampaignsTool = defineTool({
    name: "meta_ads_read_campaigns",
    description: "Read Meta Ads account structure: list ad accounts, or list campaigns / ad sets with status and budget.",
    inputSchema: metaAdsReadCampaignsInputSchema,
    outputSchema: metaAdsReadCampaignsOutputSchema
})
export const metaAdsReadInsightsTool = defineTool({
    name: "meta_ads_read_insights",
    description:
        "Read Meta Ads performance insights (spend, impressions, clicks, conversions) at campaign, ad set, or ad level for a date range, optionally split by breakdowns. Use level='ad' to judge individual creatives. Follows pagination up to 2000 rows; the result sets truncated=true when more rows exist, so narrow the date range or filter by campaign/ad set/ad IDs to fetch the rest.",
    inputSchema: metaAdsReadInsightsInputSchema,
    outputSchema: metaAdsReadInsightsOutputSchema
})
export const metaAdsListPixelsTool = defineTool({
    name: "meta_ads_list_pixels",
    description: "List the Meta pixels (Conversions API datasets) in an ad account. Use a pixel ID as the datasetId for meta_ads_send_conversions.",
    inputSchema: metaAdsListPixelsInputSchema,
    outputSchema: metaAdsListPixelsOutputSchema
})
export const metaAdsReadAudiencesTool = defineTool({
    name: "meta_ads_read_audiences",
    description: "List the custom audiences in a Meta ad account, with approximate sizes and delivery status.",
    inputSchema: metaAdsReadAudiencesInputSchema,
    outputSchema: metaAdsReadAudiencesOutputSchema
})
export const metaAdsUpdateAudienceUsersTool = defineTool({
    name: "meta_ads_update_audience_users",
    description: "Add or remove people on a Meta custom audience. Emails and phone numbers are normalized and SHA-256 hashed before upload.",
    inputSchema: metaAdsUpdateAudienceUsersInputSchema,
    outputSchema: metaAdsUpdateAudienceUsersOutputSchema
})
export const metaAdsSendConversionsTool = defineTool({
    name: "meta_ads_send_conversions",
    description: "Send offline conversion events to Meta via the Conversions API so campaign delivery can optimize on downstream outcomes (e.g. deals won).",
    inputSchema: metaAdsSendConversionsInputSchema,
    outputSchema: metaAdsSendConversionsOutputSchema
})
export const higgsfieldImageSizeSchema = z.enum([
    "2048x1152",
    "2048x1536",
    "2016x1344",
    "1696x960",
    "1632x1088",
    "1152x2048",
    "1536x2048",
    "1344x2016",
    "960x1696",
    "1088x1632",
    "1536x1536",
    "1728x1728",
    "1024x1024"
])
export type HiggsfieldImageSize = z.infer<typeof higgsfieldImageSizeSchema>

export const higgsfieldGeneratedImageSchema = z.object({
    jobId: z.string().describe("Higgsfield job that produced this image."),
    url: z.string().describe("Signed Terse-hosted URL for the full-quality image. Valid for 24 hours; pass it straight to meta_ads_create_ad as pictureUrl."),
    thumbnailUrl: z.string().nullable().describe("Signed URL for a smaller preview of the same image, when Higgsfield returned one.")
})
export type HiggsfieldGeneratedImage = z.infer<typeof higgsfieldGeneratedImageSchema>

export const higgsfieldGenerateImageInputSchema = z.object({
    integrationId: z.string().describe("The integration ID of the Higgsfield connection to use."),
    prompt: z.string().min(1).describe("What to generate. Describe the subject, setting, mood, and any on-image text."),
    size: higgsfieldImageSizeSchema.nullable().optional().describe("Output resolution and aspect ratio. Defaults to 1536x1536. Use a landscape size for feed ads."),
    quality: z.enum(["720p", "1080p"]).nullable().optional().describe("Render quality. Defaults to 1080p."),
    batchSize: z
        .union([z.literal(1), z.literal(4)])
        .nullable()
        .optional()
        .describe("Generate 1 or 4 variants in one call. Defaults to 1; use 4 when you want options to compare."),
    styleId: z.string().nullable().optional().describe("Optional Higgsfield style preset ID."),
    referenceImageUrls: z.array(z.string()).nullable().optional().describe("Publicly reachable reference images that steer style and subject consistency.")
})

export const higgsfieldGenerateImageOutputSchema = toolOutputBaseSchema.extend({
    images: z.array(higgsfieldGeneratedImageSchema),
    count: z.number()
})

export const higgsfieldGenerateImageTool = defineTool({
    name: "higgsfield_generate_image",
    description:
        "Generate ad creative images from a text prompt with Higgsfield. Each result is cached by Terse and returned as a signed URL valid for 24 hours, which can be shown to a human for approval and then handed to meta_ads_create_ad as pictureUrl. Generation is asynchronous and this waits for it to finish, so expect it to take a while.",
    inputSchema: higgsfieldGenerateImageInputSchema,
    outputSchema: higgsfieldGenerateImageOutputSchema
})

export const metaAdsReadPagesTool = defineTool({
    name: "meta_ads_read_pages",
    description: "List the Facebook Pages the connected user manages. Every ad creative is published as a Page, so a pageId from here is required by meta_ads_create_ad.",
    inputSchema: metaAdsReadPagesInputSchema,
    outputSchema: metaAdsReadPagesOutputSchema
})
export const metaAdsReadAdsTool = defineTool({
    name: "meta_ads_read_ads",
    description:
        "List ads with the creative attached to each one (primary text, headline, image). Pair with meta_ads_read_insights at level='ad' to attribute performance to a specific creative, and check effective_status for PENDING_REVIEW or DISAPPROVED.",
    inputSchema: metaAdsReadAdsInputSchema,
    outputSchema: metaAdsReadAdsOutputSchema
})
export const metaAdsCreateAdTool = defineTool({
    name: "meta_ads_create_ad",
    description:
        "Create a new ad creative and the ad that uses it inside an existing ad set. Meta fetches pictureUrl once at creation and stores its own copy, so a temporary signed URL is fine. Ad creatives are immutable, so improving a creative means creating a new ad here and pausing the old one with meta_ads_set_status. New ads enter PENDING_REVIEW before reaching the requested status.",
    inputSchema: metaAdsCreateAdInputSchema,
    outputSchema: metaAdsCreateAdOutputSchema
})
export const metaAdsSetStatusTool = defineTool({
    name: "meta_ads_set_status",
    description: "Pause or resume a campaign, ad set, or ad. PAUSED stops delivery and spend immediately and is reversible.",
    inputSchema: metaAdsSetStatusInputSchema,
    outputSchema: metaAdsSetStatusOutputSchema
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
    [attioReadRecordsTool.name]: attioReadRecordsTool,
    [attioCreateRecordTool.name]: attioCreateRecordTool,
    [attioUpdateRecordTool.name]: attioUpdateRecordTool,
    [attioUpsertRecordsTool.name]: attioUpsertRecordsTool,
    [attioDeleteRecordTool.name]: attioDeleteRecordTool,
    [attioWorkspaceMembersTool.name]: attioWorkspaceMembersTool,
    [attioReadTasksTool.name]: attioReadTasksTool,
    [attioCreateTaskTool.name]: attioCreateTaskTool,
    [attioUpdateTaskTool.name]: attioUpdateTaskTool,
    [attioDeleteTaskTool.name]: attioDeleteTaskTool,
    [attioReadNotesTool.name]: attioReadNotesTool,
    [attioCreateNoteTool.name]: attioCreateNoteTool,
    [attioDeleteNoteTool.name]: attioDeleteNoteTool,
    [attioReadCommentsTool.name]: attioReadCommentsTool,
    [attioCreateCommentTool.name]: attioCreateCommentTool,
    [attioDeleteCommentTool.name]: attioDeleteCommentTool,
    [attioReadListsTool.name]: attioReadListsTool,
    [attioCreateListTool.name]: attioCreateListTool,
    [attioUpdateListTool.name]: attioUpdateListTool,
    [attioReadListEntriesTool.name]: attioReadListEntriesTool,
    [attioAddListEntryTool.name]: attioAddListEntryTool,
    [attioUpsertListEntryTool.name]: attioUpsertListEntryTool,
    [attioUpdateListEntryTool.name]: attioUpdateListEntryTool,
    [attioRemoveListEntryTool.name]: attioRemoveListEntryTool,
    [attioMeetingsTool.name]: attioMeetingsTool,
    [attioReadFilesTool.name]: attioReadFilesTool,
    [attioUploadFileTool.name]: attioUploadFileTool,
    [attioDeleteFileTool.name]: attioDeleteFileTool,
    [attioReadSchemaTool.name]: attioReadSchemaTool,
    [attioModifySchemaTool.name]: attioModifySchemaTool,
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
    [memoryTool.name]: memoryTool,
    [resendSendTemplateTool.name]: resendSendTemplateTool,
    [apolloEnrichPersonTool.name]: apolloEnrichPersonTool,
    [apolloBulkEnrichPeopleTool.name]: apolloBulkEnrichPeopleTool,
    [apolloEnrichOrganizationTool.name]: apolloEnrichOrganizationTool,
    [apolloSearchPeopleTool.name]: apolloSearchPeopleTool,
    [apolloListJobPostingsTool.name]: apolloListJobPostingsTool,
    [googleSearchConsoleListSitesTool.name]: googleSearchConsoleListSitesTool,
    [googleSearchConsoleGetSiteTool.name]: googleSearchConsoleGetSiteTool,
    [googleSearchConsoleAddSiteTool.name]: googleSearchConsoleAddSiteTool,
    [googleSearchConsoleDeleteSiteTool.name]: googleSearchConsoleDeleteSiteTool,
    [googleSearchConsoleListSitemapsTool.name]: googleSearchConsoleListSitemapsTool,
    [googleSearchConsoleGetSitemapTool.name]: googleSearchConsoleGetSitemapTool,
    [googleSearchConsoleSubmitSitemapTool.name]: googleSearchConsoleSubmitSitemapTool,
    [googleSearchConsoleDeleteSitemapTool.name]: googleSearchConsoleDeleteSitemapTool,
    [googleSearchConsoleQuerySearchAnalyticsTool.name]: googleSearchConsoleQuerySearchAnalyticsTool,
    [googleSearchConsoleInspectUrlTool.name]: googleSearchConsoleInspectUrlTool,
    [metaAdsReadCampaignsTool.name]: metaAdsReadCampaignsTool,
    [metaAdsReadInsightsTool.name]: metaAdsReadInsightsTool,
    [metaAdsListPixelsTool.name]: metaAdsListPixelsTool,
    [metaAdsReadAudiencesTool.name]: metaAdsReadAudiencesTool,
    [metaAdsUpdateAudienceUsersTool.name]: metaAdsUpdateAudienceUsersTool,
    [metaAdsSendConversionsTool.name]: metaAdsSendConversionsTool,
    [metaAdsReadPagesTool.name]: metaAdsReadPagesTool,
    [metaAdsReadAdsTool.name]: metaAdsReadAdsTool,
    [metaAdsCreateAdTool.name]: metaAdsCreateAdTool,
    [metaAdsSetStatusTool.name]: metaAdsSetStatusTool,
    [higgsfieldGenerateImageTool.name]: higgsfieldGenerateImageTool
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
