import { INTEGRATION_METADATA, IntegrationType } from "../shared/Integrations"

/**
 * Configuration for displaying tool calls in different phases.
 */
interface ToolDisplayConfig {
    /** Static string shown when preparing to call the tool */
    preparing: string
    /** Function that returns display string during execution (can use params) */
    executing: (params?: Record<string, unknown>) => string
    /** Function that returns display string after completion (can use params and result) */
    complete: (params?: Record<string, unknown>, result?: string) => string
}

/**
 * Helper to get a friendly integration name from params
 */
function getIntegrationName(integrationType?: string): string {
    if (!integrationType) return "integration"
    const meta = INTEGRATION_METADATA[integrationType as IntegrationType]
    return meta?.name || integrationType
}

/** Truncate a string to maxLen characters with an ellipsis */
function truncate(text: string, maxLen = 35): string {
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}

/** Safely parse a JSON result string into an object */
function safeParseResult(result?: string): Record<string, unknown> | undefined {
    if (!result) return undefined
    try {
        const parsed = JSON.parse(result)
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined
    } catch {
        return undefined
    }
}

/**
 * Display configurations for all tools.
 * Each tool defines how it should be displayed in preparing, executing, and complete phases.
 *
 * Phase meanings:
 * - preparing: The AI is generating parameters for the tool call (thinking/planning)
 * - executing: The tool is actively running (performing the action)
 * - complete: The tool has finished — params and result are both available
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
            return name ? `Creating "${truncate(name)}"` : "Creating automation"
        },
        complete: params => {
            const agent = params?.agent as Record<string, unknown> | undefined
            const name = agent?.name as string | undefined
            return name ? `Created "${truncate(name)}"` : "Automation created"
        }
    },
    promptForIntegration: {
        preparing: "Setting up integration",
        executing: params => {
            const integration = getIntegrationName(params?.integration as string | undefined)
            return `Configuring ${integration}`
        },
        complete: params => {
            const integration = getIntegrationName(params?.integration as string | undefined)
            return `Integrated ${integration}`
        }
    },
    askSurveyQuestion: {
        preparing: "Asking a question",
        executing: params => {
            const question = (params?.question as string) || "Setup question"
            return question.length > 40 ? `${question.slice(0, 40)}…` : question
        },
        complete: () => "Answer received"
    },
    fetchResourcesForIntegration: {
        preparing: "Looking up resources",
        executing: params => {
            const integration = getIntegrationName(params?.integrationType as string | undefined)
            return `Fetching resources from ${integration}`
        },
        complete: params => {
            const integration = getIntegrationName(params?.integrationType as string | undefined)
            return `Fetched ${integration} resources`
        }
    },
    getSampleEvents: {
        preparing: "Looking up sample events",
        executing: params => {
            const integration = getIntegrationName(params?.integrationType as string | undefined)
            return `Fetching sample events from ${integration}`
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const events = parsed?.events as unknown[] | undefined
            const count = events?.length
            const integration = getIntegrationName(params?.integrationType as string | undefined)
            if (count !== undefined && integration) return `Fetched ${count} sample event${count !== 1 ? "s" : ""} from ${integration}`
            if (count !== undefined) return `Fetched ${count} sample event${count !== 1 ? "s" : ""}`
            return `Fetched sample events from ${integration}`
        }
    },
    triggerAgentRun: {
        preparing: "Preparing test run",
        executing: () => "Running agent on event",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const results = parsed?.results as Array<Record<string, unknown>> | undefined
            if (results && results.length > 0) {
                const first = results[0]
                const name = first?.agentName as string | undefined
                const success = first?.success as boolean | undefined
                if (name && success) return `Ran "${truncate(name)}" successfully`
                if (name && success === false) return `Ran "${truncate(name)}" — failed`
                if (name) return `Triggered "${truncate(name)}"`
            }
            return parsed?.processed ? "Agent run complete" : "Agent triggered"
        }
    },

    // ===================
    // Linear Tools
    // ===================
    linear_create_ticket: {
        preparing: "Drafting ticket",
        executing: params => {
            const title = params?.title as string | undefined
            return title ? `Creating ticket: "${truncate(title)}"` : "Creating ticket"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const issue = parsed?.issue as Record<string, unknown> | undefined
            const identifier = issue?.identifier as string | undefined
            const title = (params?.title as string) || (issue?.title as string)
            if (identifier && title) return `Created ${identifier}: "${truncate(title, 30)}"`
            if (identifier) return `Created ${identifier}`
            if (title) return `Created "${truncate(title)}"`
            return "Ticket created"
        }
    },
    linear_update_ticket: {
        preparing: "Planning ticket update",
        executing: params => {
            const ticketId = params?.ticketId as string | undefined
            return ticketId ? `Updating ticket ${ticketId}` : "Updating ticket"
        },
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const issue = parsed?.issue as Record<string, unknown> | undefined
            const identifier = issue?.identifier as string | undefined
            return identifier ? `Updated ${identifier}` : "Ticket updated"
        }
    },
    linear_search_ticket: {
        preparing: "Building search query",
        executing: params => {
            const query = params?.issueDescription as string | undefined
            return query ? `Searching issues for "${truncate(query)}"` : "Searching issues"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const count = parsed?.count as number | undefined
            const query = params?.issueDescription as string | undefined
            if (count !== undefined && query) return `Found ${count} issue${count !== 1 ? "s" : ""} for "${truncate(query, 25)}"`
            if (count !== undefined) return `Found ${count} issue${count !== 1 ? "s" : ""}`
            if (query) return `Searched issues for "${truncate(query)}"`
            return "Search complete"
        }
    },

    // ===================
    // Jira Tools
    // ===================
    jira_create_ticket: {
        preparing: "Drafting ticket",
        executing: params => {
            const title = params?.title as string | undefined
            return title ? `Creating ticket: "${truncate(title)}"` : "Creating ticket"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const issue = parsed?.issue as Record<string, unknown> | undefined
            const key = issue?.key as string | undefined
            const title = (params?.title as string) || (issue?.title as string)
            if (key && title) return `Created ${key}: "${truncate(title, 30)}"`
            if (key) return `Created ${key}`
            if (title) return `Created "${truncate(title)}"`
            return "Ticket created"
        }
    },
    jira_update_ticket: {
        preparing: "Planning ticket update",
        executing: params => {
            const issueKey = params?.issueKey as string | undefined
            return issueKey ? `Updating ${issueKey}` : "Updating ticket"
        },
        complete: params => {
            const issueKey = params?.issueKey as string | undefined
            return issueKey ? `Updated ${issueKey}` : "Ticket updated"
        }
    },
    jira_search_ticket: {
        preparing: "Building search query",
        executing: params => {
            const text = params?.text as string | undefined
            return text ? `Searching issues for "${truncate(text)}"` : "Searching issues"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const count = parsed?.count as number | undefined
            const text = params?.text as string | undefined
            if (count !== undefined && text) return `Found ${count} issue${count !== 1 ? "s" : ""} for "${truncate(text, 25)}"`
            if (count !== undefined) return `Found ${count} issue${count !== 1 ? "s" : ""}`
            if (text) return `Searched issues for "${truncate(text)}"`
            return "Search complete"
        }
    },

    // ===================
    // Notion Tools
    // ===================
    notion_modify_page: {
        preparing: "Planning page changes",
        executing: () => "Modifying page",
        complete: params => {
            const pageId = params?.page_id as string | undefined
            return pageId ? "Updated Notion page" : "Created Notion page"
        }
    },
    notion_modify_blocks: {
        preparing: "Planning block changes",
        executing: () => "Modifying blocks",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const operation = parsed?.operation as string | undefined
            if (operation === "append") return "Added blocks to page"
            if (operation === "update") return "Updated page block"
            if (operation === "delete") return "Deleted page block"
            return "Blocks modified"
        }
    },
    notion_query_page: {
        preparing: "Building page query",
        executing: () => "Reading Notion page",
        complete: () => "Read Notion page"
    },
    notion_query_database: {
        preparing: "Building database query",
        executing: () => "Querying database",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.total_returned as number | undefined
            return total !== undefined ? `Queried database — ${total} result${total !== 1 ? "s" : ""}` : "Queried database"
        }
    },
    notion_get_schema: {
        preparing: "Looking up schema",
        executing: () => "Fetching schema",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const name = parsed?.database_name as string | undefined
            return name ? `Fetched schema for "${truncate(name)}"` : "Fetched database schema"
        }
    },
    notion_fetch_related_events: {
        preparing: "Looking up related events",
        executing: () => "Fetching related events",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const count = parsed?.events_count as number | undefined
            return count !== undefined ? `Found ${count} related event${count !== 1 ? "s" : ""}` : "Fetched related events"
        }
    },

    // ===================
    // Gmail Tools
    // ===================
    gmail_send_email: {
        preparing: "Composing email",
        executing: params => {
            const to = params?.to as string | undefined
            return to ? `Sending email to ${truncate(to, 30)}` : "Sending email"
        },
        complete: params => {
            const to = params?.to as string | undefined
            const subject = params?.subject as string | undefined
            if (subject && to) return `Sent "${truncate(subject, 25)}" to ${truncate(to, 20)}`
            if (to) return `Sent email to ${truncate(to, 30)}`
            return "Email sent"
        }
    },

    // ===================
    // Slack Tools
    // ===================
    slack_send_message: {
        preparing: "Composing message",
        executing: () => "Sending Slack message",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const channel = parsed?.channel as string | undefined
            return channel ? `Sent message to ${channel}` : "Slack message sent"
        }
    },

    // ===================
    // Confluence Tools
    // ===================
    confluence_query_page: {
        preparing: "Building page query",
        executing: () => "Reading Confluence page",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const title = parsed?.title as string | undefined
            return title ? `Read "${truncate(title)}"` : "Read Confluence page"
        }
    },
    confluence_add_comment: {
        preparing: "Composing comment",
        executing: () => "Adding comment",
        complete: () => "Added comment to page"
    },

    // ===================
    // GitHub Tools
    // ===================
    searchGitHubCode: {
        preparing: "Building code search",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Searching code for "${truncate(query)}"` : "Searching code"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalCount as number | undefined
            const query = params?.query as string | undefined
            if (total !== undefined && query) return `Found ${total} result${total !== 1 ? "s" : ""} for "${truncate(query, 25)}"`
            if (query) return `Searched code for "${truncate(query)}"`
            return "Code search complete"
        }
    },
    readGitHubFile: {
        preparing: "Locating file",
        executing: params => {
            const path = params?.path as string | undefined
            return path ? `Reading ${truncate(path, 40)}` : "Reading file"
        },
        complete: params => {
            const path = params?.path as string | undefined
            return path ? `Read ${truncate(path, 40)}` : "File read"
        }
    },
    listGitHubPullRequests: {
        preparing: "Looking up pull requests",
        executing: params => {
            const repo = params?.repository as string | undefined
            return repo ? `Listing PRs in ${repo}` : "Listing pull requests"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const summary = parsed?.summary as Record<string, unknown> | undefined
            const total = summary?.total as number | undefined
            const repo = params?.repository as string | undefined
            if (total !== undefined && repo) return `Found ${total} PR${total !== 1 ? "s" : ""} in ${repo}`
            if (total !== undefined) return `Found ${total} PR${total !== 1 ? "s" : ""}`
            if (repo) return `Listed PRs in ${repo}`
            return "Pull requests listed"
        }
    },
    listGitHubDirectory: {
        preparing: "Locating directory",
        executing: params => {
            const path = params?.path as string | undefined
            return path ? `Listing ${truncate(path, 40)}` : "Listing directory"
        },
        complete: params => {
            const path = params?.path as string | undefined
            return path ? `Listed ${truncate(path, 40)}` : "Directory listed"
        }
    },
    listGitHubCommits: {
        preparing: "Looking up commits",
        executing: params => {
            const repo = params?.repository as string | undefined
            return repo ? `Listing commits in ${repo}` : "Listing commits"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const summary = parsed?.summary as Record<string, unknown> | undefined
            const total = summary?.total as number | undefined
            const repo = params?.repository as string | undefined
            if (total !== undefined && repo) return `Found ${total} commit${total !== 1 ? "s" : ""} in ${repo}`
            if (total !== undefined) return `Found ${total} commit${total !== 1 ? "s" : ""}`
            if (repo) return `Listed commits in ${repo}`
            return "Commits listed"
        }
    },
    grepGitHubCode: {
        preparing: "Building search pattern",
        executing: params => {
            const pattern = params?.pattern as string | undefined
            return pattern ? `Searching for "${truncate(pattern)}"` : "Searching code"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalCount as number | undefined
            const pattern = params?.pattern as string | undefined
            if (total !== undefined && pattern) return `Found ${total} match${total !== 1 ? "es" : ""} for "${truncate(pattern, 25)}"`
            if (pattern) return `Searched for "${truncate(pattern)}"`
            return "Search complete"
        }
    },
    summarizeGitHubPullRequestDiff: {
        preparing: "Analyzing PR",
        executing: params => {
            const prNumber = params?.pullNumber as number | undefined
            return prNumber ? `Summarizing PR #${prNumber}` : "Summarizing PR diff"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const pr = parsed?.pullRequest as Record<string, unknown> | undefined
            const title = pr?.title as string | undefined
            const prNumber = (params?.pullNumber as number) || (pr?.number as number)
            if (prNumber && title) return `Summarized PR #${prNumber}: "${truncate(title, 30)}"`
            if (prNumber) return `Summarized PR #${prNumber}`
            return "PR summarized"
        }
    },

    // ===================
    // PostHog Tools
    // ===================
    searchPosthogSessions: {
        preparing: "Building session query",
        executing: params => {
            const email = params?.userEmail as string | undefined
            return email ? `Searching sessions for ${email}` : "Searching sessions"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalSessions as number | undefined
            const email = params?.userEmail as string | undefined
            if (total !== undefined && email) return `Found ${total} session${total !== 1 ? "s" : ""} for ${truncate(email, 25)}`
            if (total !== undefined) return `Found ${total} session${total !== 1 ? "s" : ""}`
            if (email) return `Searched sessions for ${truncate(email, 25)}`
            return "Sessions found"
        }
    },
    searchPosthogLogs: {
        preparing: "Building log query",
        executing: params => {
            const search = params?.messageSearch as string | undefined
            return search ? `Searching logs for "${truncate(search)}"` : "Searching logs"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalLogs as number | undefined
            const search = params?.messageSearch as string | undefined
            if (total !== undefined && search) return `Found ${total} log${total !== 1 ? "s" : ""} for "${truncate(search, 25)}"`
            if (total !== undefined) return `Found ${total} log${total !== 1 ? "s" : ""}`
            if (search) return `Searched logs for "${truncate(search)}"`
            return "Logs searched"
        }
    },
    getPosthogSessionEvents: {
        preparing: "Looking up session events",
        executing: () => "Fetching session events",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const summary = parsed?.summary as Record<string, unknown> | undefined
            const total = summary?.meaningfulEventsReturned as number | undefined
            return total !== undefined ? `Fetched ${total} session event${total !== 1 ? "s" : ""}` : "Fetched session events"
        }
    },

    // ===================
    // LaunchDarkly Tools
    // ===================
    listLaunchDarklyFlags: {
        preparing: "Looking up feature flags",
        executing: params => {
            const project = params?.projectKey as string | undefined
            return project ? `Listing flags in ${project}` : "Listing feature flags"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalFlags as number | undefined
            const project = params?.projectKey as string | undefined
            if (total !== undefined && project) return `Found ${total} flag${total !== 1 ? "s" : ""} in ${project}`
            if (total !== undefined) return `Found ${total} flag${total !== 1 ? "s" : ""}`
            if (project) return `Listed flags in ${project}`
            return "Flags listed"
        }
    },
    getLaunchDarklyFlagDetails: {
        preparing: "Looking up flag details",
        executing: params => {
            const flagKey = params?.flagKey as string | undefined
            return flagKey ? `Fetching flag "${flagKey}"` : "Fetching flag details"
        },
        complete: params => {
            const flagKey = params?.flagKey as string | undefined
            return flagKey ? `Fetched flag "${flagKey}"` : "Flag details fetched"
        }
    },

    // ===================
    // Datadog Tools
    // ===================
    searchDatadogLogs: {
        preparing: "Building log query",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Searching logs for "${truncate(query)}"` : "Searching logs"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalLogs as number | undefined
            const query = params?.query as string | undefined
            if (total !== undefined && query) return `Found ${total} log${total !== 1 ? "s" : ""} for "${truncate(query, 25)}"`
            if (total !== undefined) return `Found ${total} log${total !== 1 ? "s" : ""}`
            if (query) return `Searched logs for "${truncate(query)}"`
            return "Logs searched"
        }
    },
    searchRumEvents: {
        preparing: "Building RUM query",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Searching RUM for "${truncate(query)}"` : "Searching RUM events"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalEvents as number | undefined
            const query = params?.query as string | undefined
            if (total !== undefined && query) return `Found ${total} RUM event${total !== 1 ? "s" : ""} for "${truncate(query, 25)}"`
            if (total !== undefined) return `Found ${total} RUM event${total !== 1 ? "s" : ""}`
            return "RUM events searched"
        }
    },
    listRumEvents: {
        preparing: "Looking up RUM events",
        executing: () => "Listing RUM events",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalEvents as number | undefined
            return total !== undefined ? `Listed ${total} RUM event${total !== 1 ? "s" : ""}` : "RUM events listed"
        }
    },
    aggregateRumEvents: {
        preparing: "Building RUM aggregation",
        executing: () => "Aggregating RUM events",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalBuckets as number | undefined
            return total !== undefined ? `Aggregated ${total} bucket${total !== 1 ? "s" : ""}` : "RUM events aggregated"
        }
    },

    // ===================
    // Terse Tools
    // ===================
    web_search: {
        preparing: "Building search query",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Searching web for "${truncate(query)}"` : "Searching the web"
        },
        complete: params => {
            const query = params?.query as string | undefined
            return query ? `Searched web for "${truncate(query)}"` : "Web search complete"
        }
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
                return "Complete"
        }
    }

    switch (phase) {
        case "preparing":
            return config.preparing
        case "executing":
            return config.executing(params)
        case "complete":
            return config.complete(params, result)
    }
}

/**
 * Convenience function that parses parameters JSON and gets the display string.
 */
export function getToolDisplayFromCall(toolName: string, phase: "preparing" | "executing" | "complete", parametersJson?: string, result?: string): string {
    const params = parseToolParams(parametersJson)
    return getToolDisplayForPhase(toolName, phase, { params, result })
}
