import { z } from "zod"

/**
 * Centralized definition of all tool names used in the system.
 *
 * This enum ensures type safety and prevents typos when referencing tool names.
 * All tool definitions must use values from this enum, and the validation
 * function will enforce that all tool names are present here.
 */

export const ToolName = {
    // Linear Tools
    LINEAR_CREATE_TICKET: "linear_create_ticket",
    LINEAR_UPDATE_TICKET: "linear_update_ticket",
    LINEAR_SEARCH_TICKET: "linear_search_ticket",
    LINEAR_READ_TICKET: "linear_read_ticket",
    LINEAR_GET_STATES: "linear_get_states",
    LINEAR_GET_LABELS: "linear_get_labels",
    LINEAR_GET_PROJECTS: "linear_get_projects",
    LINEAR_GET_TEAMS: "linear_get_teams",
    LINEAR_GET_USERS: "linear_get_users",

    // Jira Tools
    JIRA_CREATE_TICKET: "jira_create_ticket",
    JIRA_UPDATE_TICKET: "jira_update_ticket",
    JIRA_SEARCH_TICKET: "jira_search_ticket",

    // Notion Tools
    NOTION_CREATE_OR_UPDATE_PAGE: "notion_create_or_update_page",
    NOTION_CREATE_OR_UPDATE_DATABASE_ROW: "notion_create_or_update_database_row",
    NOTION_MODIFY_BLOCKS: "notion_modify_blocks",
    NOTION_QUERY_PAGE: "notion_query_page",
    NOTION_QUERY_DATABASE: "notion_query_database",
    NOTION_GET_SCHEMA: "notion_get_schema",
    NOTION_FETCH_RELATED_EVENTS: "notion_fetch_related_events",
    NOTION_LIST_USERS: "notion_list_users",

    // Gmail Tools
    GMAIL_SEND_EMAIL: "gmail_send_email",

    // Slack Tools
    SLACK_SEND_MESSAGE: "slack_send_message",
    SLACK_LIST_CHANNELS: "slack_list_channels",
    SLACK_LIST_USERS: "slack_list_users",
    SLACK_READ_CONVERSATION: "slack_read_conversation",

    // Confluence Tools
    CONFLUENCE_QUERY_PAGE: "confluence_query_page",
    CONFLUENCE_ADD_COMMENT: "confluence_add_comment",

    // GitHub Knowledge Base Tools
    GITHUB_SEARCH_CODE: "searchGitHubCode",
    GITHUB_READ_FILE: "readGitHubFile",
    GITHUB_LIST_PULL_REQUESTS: "listGitHubPullRequests",
    GITHUB_LIST_DIRECTORY: "listGitHubDirectory",
    GITHUB_LIST_COMMITS: "listGitHubCommits",
    GITHUB_GREP_CODE: "grepGitHubCode",
    GITHUB_SUMMARIZE_PULL_REQUEST_DIFF: "summarizeGitHubPullRequestDiff",

    // PostHog Knowledge Base Tools
    POSTHOG_SEARCH_SESSIONS: "searchPosthogSessions",
    POSTHOG_SEARCH_LOGS: "searchPosthogLogs",
    POSTHOG_GET_SESSION_EVENTS: "getPosthogSessionEvents",
    POSTHOG_SEARCH_EVENTS: "searchPosthogEvents",

    // LaunchDarkly Knowledge Base Tools
    LAUNCHDARKLY_LIST_FEATURE_FLAGS: "listLaunchDarklyFlags",
    LAUNCHDARKLY_GET_FEATURE_FLAG_DETAILS: "getLaunchDarklyFlagDetails",

    // Datadog Knowledge Base Tools
    DATADOG_SEARCH_LOGS: "searchDatadogLogs",
    DATADOG_SEARCH_RUM_EVENTS: "searchRumEvents",
    DATADOG_LIST_RUM_EVENTS: "listRumEvents",
    DATADOG_AGGREGATE_RUM_EVENTS: "aggregateRumEvents",

    // Terse
    WEB_SEARCH: "web_search"
} as const

/**
 * Type for all valid tool names
 */
export type ToolName = (typeof ToolName)[keyof typeof ToolName]

/**
 * Array of all valid tool names for runtime validation
 */
export const ALL_TOOL_NAMES: readonly string[] = Object.values(ToolName)

/**
 * Zod schema for a single tool name. Use for validating toolApprovals and API request bodies.
 */
export const ToolNameSchema = z.enum(ALL_TOOL_NAMES as [string, ...string[]])

/**
 * Set of all valid tool names for O(1) lookup
 */
export const VALID_TOOL_NAMES_SET = new Set(ALL_TOOL_NAMES)

/**
 * Type guard to check if a string is a valid tool name
 */
export function isValidToolName(name: string): name is ToolName {
    return VALID_TOOL_NAMES_SET.has(name)
}
