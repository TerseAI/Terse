import { INTEGRATION_METADATA, IntegrationType } from "../shared/Integrations"

/**
 * Configuration for displaying tool calls in different phases.
 */
interface ToolDisplayConfig {
    /** Static string shown when preparing to call the tool */
    preparing: string
    /** Function that returns display string during execution (can use params) */
    executing: (params?: Record<string, unknown>) => string
    /** Function that returns display string after completion (can use result) */
    complete: (result?: string) => string
}

/**
 * Helper to get a friendly integration name from params
 */
function getIntegrationName(integrationType?: string): string {
    if (!integrationType) return "integration"
    const meta = INTEGRATION_METADATA[integrationType as IntegrationType]
    return meta?.name || integrationType
}

/**
 * Display configurations for all tools.
 * Each tool defines how it should be displayed in preparing, executing, and complete phases.
 *
 * Phase meanings:
 * - preparing: The AI is generating parameters for the tool call (thinking/planning)
 * - executing: The tool is actively running (performing the action)
 * - complete: The tool has finished
 */
const TOOL_DISPLAY_CONFIG: Record<string, ToolDisplayConfig> = {
    // ===================
    // ChatAgent Tools
    // ===================
    applyAgent: {
        preparing: "Planning automation",
        executing: params => {
            const agent = params?.agent as Record<string, unknown> | undefined
            const name = agent?.name as string | undefined
            return name ? `Creating "${name}"` : "Creating automation"
        },
        complete: () => "Automation created"
    },
    promptForIntegration: {
        preparing: "Setting up integration",
        executing: params => {
            const integration = getIntegrationName(params?.integration as string | undefined)
            return `Configuring ${integration}`
        },
        complete: () => "Integration configured"
    },
    fetchResourcesForIntegration: {
        preparing: "Looking up resources",
        executing: params => {
            const integration = getIntegrationName(params?.integrationType as string | undefined)
            return `Fetching resources from ${integration}`
        },
        complete: result => result || "Resources fetched"
    },

    // ===================
    // Linear Tools
    // ===================
    linear_create_ticket: {
        preparing: "Drafting ticket",
        executing: params => {
            const title = params?.title as string | undefined
            return title ? `Creating ticket: "${title}"` : "Creating ticket"
        },
        complete: () => "Ticket created"
    },
    linear_update_ticket: {
        preparing: "Planning ticket update",
        executing: params => {
            const ticketId = params?.ticketId as string | undefined
            return ticketId ? `Updating ticket ${ticketId}` : "Updating ticket"
        },
        complete: () => "Ticket updated"
    },
    linear_search_ticket: {
        preparing: "Building search query",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Searching tickets for "${query}"` : "Searching tickets"
        },
        complete: result => result || "Search complete"
    },

    // ===================
    // Jira Tools
    // ===================
    jira_create_ticket: {
        preparing: "Drafting ticket",
        executing: params => {
            const summary = params?.summary as string | undefined
            return summary ? `Creating ticket: "${summary}"` : "Creating ticket"
        },
        complete: () => "Ticket created"
    },
    jira_update_ticket: {
        preparing: "Planning ticket update",
        executing: params => {
            const issueKey = params?.issueKey as string | undefined
            return issueKey ? `Updating ticket ${issueKey}` : "Updating ticket"
        },
        complete: () => "Ticket updated"
    },
    jira_search_ticket: {
        preparing: "Building search query",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Searching tickets for "${query}"` : "Searching tickets"
        },
        complete: result => result || "Search complete"
    },

    // ===================
    // Notion Tools
    // ===================
    notion_modify_page: {
        preparing: "Planning page changes",
        executing: () => "Modifying page",
        complete: () => "Page modified"
    },
    notion_modify_blocks: {
        preparing: "Planning block changes",
        executing: () => "Modifying blocks",
        complete: () => "Blocks modified"
    },
    notion_query_page: {
        preparing: "Building page query",
        executing: () => "Querying page",
        complete: result => result || "Query complete"
    },
    notion_query_database: {
        preparing: "Building database query",
        executing: () => "Querying database",
        complete: result => result || "Query complete"
    },
    notion_get_schema: {
        preparing: "Looking up schema",
        executing: () => "Fetching schema",
        complete: () => "Schema fetched"
    },
    notion_fetch_related_events: {
        preparing: "Looking up related events",
        executing: () => "Fetching related events",
        complete: result => result || "Events fetched"
    },

    // ===================
    // Gmail Tools
    // ===================
    gmail_send_email: {
        preparing: "Composing email",
        executing: params => {
            const to = params?.to as string | undefined
            return to ? `Sending email to ${to}` : "Sending email"
        },
        complete: () => "Email sent"
    },

    // ===================
    // Slack Tools
    // ===================
    slack_send_message: {
        preparing: "Composing message",
        executing: params => {
            const channel = params?.channel as string | undefined
            return channel ? `Sending message to ${channel}` : "Sending message"
        },
        complete: () => "Message sent"
    },

    // ===================
    // Confluence Tools
    // ===================
    confluence_query_page: {
        preparing: "Building page query",
        executing: () => "Querying page",
        complete: result => result || "Query complete"
    },
    confluence_add_comment: {
        preparing: "Composing comment",
        executing: () => "Adding comment",
        complete: () => "Comment added"
    },

    // ===================
    // GitHub Tools
    // ===================
    searchGitHubCode: {
        preparing: "Building code search",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Searching code for "${query}"` : "Searching code"
        },
        complete: result => result || "Search complete"
    },
    readGitHubFile: {
        preparing: "Locating file",
        executing: params => {
            const path = params?.path as string | undefined
            return path ? `Reading ${path}` : "Reading file"
        },
        complete: () => "File read"
    },
    listGitHubPullRequests: {
        preparing: "Looking up pull requests",
        executing: () => "Listing pull requests",
        complete: result => result || "Pull requests listed"
    },
    listGitHubDirectory: {
        preparing: "Locating directory",
        executing: params => {
            const path = params?.path as string | undefined
            return path ? `Listing ${path}` : "Listing directory"
        },
        complete: () => "Directory listed"
    },
    listGitHubCommits: {
        preparing: "Looking up commits",
        executing: () => "Listing commits",
        complete: result => result || "Commits listed"
    },
    grepGitHubCode: {
        preparing: "Building search pattern",
        executing: params => {
            const pattern = params?.pattern as string | undefined
            return pattern ? `Searching for "${pattern}"` : "Searching code"
        },
        complete: result => result || "Search complete"
    },
    summarizeGitHubPullRequestDiff: {
        preparing: "Analyzing PR",
        executing: params => {
            const prNumber = params?.prNumber as number | undefined
            return prNumber ? `Summarizing PR #${prNumber}` : "Summarizing PR diff"
        },
        complete: () => "PR summarized"
    },

    // ===================
    // PostHog Tools
    // ===================
    searchPosthogSessions: {
        preparing: "Building session query",
        executing: () => "Searching sessions",
        complete: result => result || "Sessions found"
    },
    searchPosthogLogs: {
        preparing: "Building log query",
        executing: () => "Searching logs",
        complete: result => result || "Logs found"
    },
    getPosthogSessionEvents: {
        preparing: "Looking up session events",
        executing: () => "Fetching session events",
        complete: result => result || "Events fetched"
    },

    // ===================
    // LaunchDarkly Tools
    // ===================
    listLaunchDarklyFlags: {
        preparing: "Looking up feature flags",
        executing: () => "Listing feature flags",
        complete: result => result || "Flags listed"
    },
    getLaunchDarklyFlagDetails: {
        preparing: "Looking up flag details",
        executing: params => {
            const flagKey = params?.flagKey as string | undefined
            return flagKey ? `Fetching flag "${flagKey}"` : "Fetching flag details"
        },
        complete: () => "Flag details fetched"
    },

    // ===================
    // Datadog Tools
    // ===================
    searchDatadogLogs: {
        preparing: "Building log query",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Searching logs for "${query}"` : "Searching logs"
        },
        complete: result => result || "Logs found"
    },
    searchRumEvents: {
        preparing: "Building RUM query",
        executing: () => "Searching RUM events",
        complete: result => result || "RUM events found"
    },
    listRumEvents: {
        preparing: "Looking up RUM events",
        executing: () => "Listing RUM events",
        complete: result => result || "RUM events listed"
    },
    aggregateRumEvents: {
        preparing: "Building RUM aggregation",
        executing: () => "Aggregating RUM events",
        complete: result => result || "RUM events aggregated"
    },

    // ===================
    // Terse Tools
    // ===================
    web_search: {
        preparing: "Building search query",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Searching web for "${query}"` : "Searching the web"
        },
        complete: result => result || "Search complete"
    }
}

/**
 * Safely parse JSON parameters string into an object.
 */
export function parseToolParams(parametersJson?: string): Record<string, unknown> | undefined {
    if (!parametersJson) return undefined
    try {
        return JSON.parse(parametersJson) as Record<string, unknown>
    } catch {
        return undefined
    }
}

/**
 * Get display string for a tool call based on its current phase.
 *
 * @param toolName - The internal tool name (e.g., 'linear_create_ticket')
 * @param phase - The current phase: 'preparing', 'executing', or 'complete'
 * @param options - Optional params, integration, and result for dynamic display
 * @returns Human-readable display string
 *
 * @example
 * getToolDisplayForPhase('fetchResourcesForIntegration', 'executing', { params: { integrationType: 'notion' } })
 * // Returns: "Fetching resources from Notion"
 */
export function getToolDisplayForPhase(
    toolName: string,
    phase: "preparing" | "executing" | "complete",
    options?: {
        params?: Record<string, unknown>
        result?: string
    }
): string {
    const config = TOOL_DISPLAY_CONFIG[toolName]
    const { params, result } = options || {}

    if (!config) {
        // Fallback for unknown tools - use the tool name in a readable format
        const readableName = toolName
            .replace(/_/g, " ")
            .replace(/([A-Z])/g, " $1")
            .toLowerCase()
            .trim()

        switch (phase) {
            case "preparing":
                // Use action-oriented language that indicates planning/thinking phase
                return `Planning ${readableName}`
            case "executing":
                return readableName.charAt(0).toUpperCase() + readableName.slice(1)
            case "complete":
                return result || "Complete"
        }
    }

    switch (phase) {
        case "preparing":
            return config.preparing
        case "executing":
            return config.executing(params)
        case "complete":
            return config.complete(result)
    }
}

/**
 * Convenience function that parses parameters JSON and gets the display string.
 */
export function getToolDisplayFromCall(toolName: string, phase: "preparing" | "executing" | "complete", parametersJson?: string, result?: string): string {
    const params = parseToolParams(parametersJson)
    return getToolDisplayForPhase(toolName, phase, { params, result })
}
