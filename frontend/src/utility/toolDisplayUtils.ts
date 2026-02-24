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

enum PolledRunStatus {
    SUCCESS = "success",
    FAILED = "failed",
    SKIPPED = "skipped",
    AWAITING_APPROVAL = "awaiting_approval",
    IN_PROGRESS = "in_progress"
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

function toPolledRunStatus(status: unknown): PolledRunStatus | null {
    switch (status) {
        case PolledRunStatus.SUCCESS:
            return PolledRunStatus.SUCCESS
        case PolledRunStatus.FAILED:
            return PolledRunStatus.FAILED
        case PolledRunStatus.SKIPPED:
            return PolledRunStatus.SKIPPED
        case PolledRunStatus.AWAITING_APPROVAL:
            return PolledRunStatus.AWAITING_APPROVAL
        case PolledRunStatus.IN_PROGRESS:
            return PolledRunStatus.IN_PROGRESS
        default:
            return null
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
        preparing: "Getting your workflow ready",
        executing: params => {
            const agent = params?.agent as Record<string, unknown> | undefined
            const name = agent?.name as string | undefined
            return name ? `Setting up "${truncate(name)}"` : "Setting up your workflow"
        },
        complete: params => {
            const agent = params?.agent as Record<string, unknown> | undefined
            const name = agent?.name as string | undefined
            return name ? `You're all set: "${truncate(name)}"` : "Your workflow is ready"
        }
    },
    promptForIntegration: {
        preparing: "Getting connection ready",
        executing: params => {
            const integration = getIntegrationName(params?.integration as string | undefined)
            return `Connecting ${integration}`
        },
        complete: params => {
            const integration = getIntegrationName(params?.integration as string | undefined)
            return `${integration} is connected`
        }
    },
    askSurveyQuestion: {
        preparing: "Quick question",
        executing: params => {
            const question = (params?.question as string) || "A quick question"
            return question.length > 40 ? `${question.slice(0, 40)}…` : question
        },
        complete: () => "Thanks for your answer"
    },
    fetchResourcesForIntegration: {
        preparing: "Looking things up",
        executing: params => {
            const integration = getIntegrationName(params?.integrationType as string | undefined)
            return `Checking what's available in ${integration}`
        },
        complete: params => {
            const integration = getIntegrationName(params?.integrationType as string | undefined)
            return `Found available options in ${integration}`
        }
    },
    getSampleEvents: {
        preparing: "Finding recent examples",
        executing: params => {
            const integration = getIntegrationName(params?.integrationType as string | undefined)
            return `Getting recent examples from ${integration}`
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const events = parsed?.events as unknown[] | undefined
            const count = events?.length
            const integration = getIntegrationName(params?.integrationType as string | undefined)
            if (count !== undefined && integration) return `Found ${count} recent example${count !== 1 ? "s" : ""} from ${integration}`
            if (count !== undefined) return `Found ${count} recent example${count !== 1 ? "s" : ""}`
            return `Found recent examples from ${integration}`
        }
    },
    triggerAgentRun: {
        preparing: "Starting a run",
        executing: () => "Starting a run",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const name = parsed?.agentName as string | undefined
            if (name) return `Started "${truncate(name)}"`
            return "Run started"
        }
    },
    pollTriggeredRunStatus: {
        preparing: "Getting the latest progress",
        executing: () => "Checking progress",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const status = toPolledRunStatus(parsed?.status)
            const timedOut = parsed?.timedOut as boolean | undefined
            const name = parsed?.agentName as string | undefined

            if (timedOut) {
                return name ? `"${truncate(name)}" is still running` : "Still running"
            }

            switch (status) {
                case PolledRunStatus.SUCCESS:
                    return name ? `"${truncate(name)}" finished` : "Finished"
                case PolledRunStatus.FAILED:
                    return name ? `"${truncate(name)}" could not finish` : "Could not finish"
                case PolledRunStatus.SKIPPED:
                    return name ? `"${truncate(name)}" was skipped` : "Skipped"
                case PolledRunStatus.AWAITING_APPROVAL:
                    return name ? `"${truncate(name)}" needs approval` : "Needs approval"
                case PolledRunStatus.IN_PROGRESS:
                    return name ? `"${truncate(name)}" is still running` : "Still running"
                default:
                    return "Checked progress"
            }
        }
    },

    // ===================
    // Linear Tools
    // ===================
    linear_create_ticket: {
        preparing: "Getting a task ready",
        executing: params => {
            const ticket = params?.ticket as Record<string, unknown> | undefined
            const title = ticket?.title as string | undefined
            return title ? `Creating task: "${truncate(title)}"` : "Creating task"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const issue = parsed?.issue as Record<string, unknown> | undefined
            const identifier = issue?.identifier as string | undefined
            const ticketParams = params?.ticket as Record<string, unknown> | undefined
            const title = (ticketParams?.title as string) || (issue?.title as string)
            if (identifier && title) return `Created task ${identifier}: "${truncate(title, 30)}"`
            if (identifier) return `Created task ${identifier}`
            if (title) return `Created task "${truncate(title)}"`
            return "Task created"
        }
    },
    linear_update_ticket: {
        preparing: "Getting your updates ready",
        executing: params => {
            const issueId = params?.issueId as string | undefined
            return issueId ? `Updating task ${issueId}` : "Updating task"
        },
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const issue = parsed?.issue as Record<string, unknown> | undefined
            const identifier = issue?.identifier as string | undefined
            return identifier ? `Updated task ${identifier}` : "Task updated"
        }
    },
    linear_add_comment: {
        preparing: "Getting your note ready",
        executing: params => {
            const issueId = params?.issueId as string | undefined
            return issueId ? `Adding a note to ${issueId}` : "Adding a note"
        },
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const actions = parsed?.actions as Array<{ target?: string }> | undefined
            const target = actions?.[0]?.target
            return target ? `Added a note to ${target}` : "Note added"
        }
    },
    linear_search_ticket: {
        preparing: "Looking for tasks",
        executing: params => {
            const query = params?.searchTerm as string | undefined
            return query ? `Looking for tasks about "${truncate(query)}"` : "Looking for tasks"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const count = parsed?.count as number | undefined
            const query = params?.searchTerm as string | undefined
            if (count !== undefined && query) return `Found ${count} task${count !== 1 ? "s" : ""} about "${truncate(query, 25)}"`
            if (count !== undefined) return `Found ${count} task${count !== 1 ? "s" : ""}`
            if (query) return `Looked for "${truncate(query)}"`
            return "Search complete"
        }
    },
    linear_get_states: {
        preparing: "Loading status options",
        executing: () => "Loading status options",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const states = parsed?.states as unknown[] | undefined
            const n = Array.isArray(states) ? states.length : undefined
            if (n !== undefined) return `Found ${n} status option${n !== 1 ? "s" : ""}`
            return "Status options loaded"
        }
    },
    linear_get_labels: {
        preparing: "Loading tags",
        executing: () => "Loading tags",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const labels = parsed?.labels as unknown[] | undefined
            const n = Array.isArray(labels) ? labels.length : undefined
            if (n !== undefined) return `Found ${n} tag${n !== 1 ? "s" : ""}`
            return "Tags loaded"
        }
    },
    linear_get_teams: {
        preparing: "Loading teams",
        executing: () => "Loading teams",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const teams = parsed?.teams as unknown[] | undefined
            const n = Array.isArray(teams) ? teams.length : undefined
            if (n !== undefined) return `Found ${n} team${n !== 1 ? "s" : ""}`
            return "Teams loaded"
        }
    },
    linear_get_projects: {
        preparing: "Loading projects",
        executing: () => "Loading projects",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const projects = parsed?.projects as unknown[] | undefined
            const n = Array.isArray(projects) ? projects.length : undefined
            if (n !== undefined) return `Found ${n} project${n !== 1 ? "s" : ""}`
            return "Projects loaded"
        }
    },
    linear_get_users: {
        preparing: "Loading people",
        executing: () => "Loading people",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const users = parsed?.users as unknown[] | undefined
            const n = Array.isArray(users) ? users.length : undefined
            if (n !== undefined) return `Found ${n} person${n !== 1 ? "s" : ""}`
            return "People loaded"
        }
    },

    // ===================
    // Jira Tools
    // ===================
    jira_create_ticket: {
        preparing: "Getting a task ready",
        executing: params => {
            const title = params?.title as string | undefined
            return title ? `Creating task: "${truncate(title)}"` : "Creating task"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const issue = parsed?.issue as Record<string, unknown> | undefined
            const key = issue?.key as string | undefined
            const title = (params?.title as string) || (issue?.title as string)
            if (key && title) return `Created task ${key}: "${truncate(title, 30)}"`
            if (key) return `Created task ${key}`
            if (title) return `Created task "${truncate(title)}"`
            return "Task created"
        }
    },
    jira_update_ticket: {
        preparing: "Getting your updates ready",
        executing: params => {
            const issueKey = params?.issueKey as string | undefined
            return issueKey ? `Updating task ${issueKey}` : "Updating task"
        },
        complete: params => {
            const issueKey = params?.issueKey as string | undefined
            return issueKey ? `Updated task ${issueKey}` : "Task updated"
        }
    },
    jira_search_ticket: {
        preparing: "Looking for tasks",
        executing: params => {
            const text = params?.text as string | undefined
            return text ? `Looking for tasks about "${truncate(text)}"` : "Looking for tasks"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const count = parsed?.count as number | undefined
            const text = params?.text as string | undefined
            if (count !== undefined && text) return `Found ${count} task${count !== 1 ? "s" : ""} about "${truncate(text, 25)}"`
            if (count !== undefined) return `Found ${count} task${count !== 1 ? "s" : ""}`
            if (text) return `Looked for "${truncate(text)}"`
            return "Search complete"
        }
    },

    // ===================
    // Notion Tools
    // ===================
    notion_create_or_update_database_row: {
        preparing: "Getting your update ready",
        executing: () => "Saving your update",
        complete: () => "Your update was saved"
    },
    notion_create_or_update_page: {
        preparing: "Getting page changes ready",
        executing: () => "Saving page changes",
        complete: () => "Page updated"
    },
    notion_modify_blocks: {
        preparing: "Getting changes ready",
        executing: () => "Updating page content",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const operation = parsed?.operation as string | undefined
            if (operation === "append") return "Added to page"
            if (operation === "update") return "Updated page"
            if (operation === "delete") return "Removed from page"
            return "Page updated"
        }
    },
    notion_query_page: {
        preparing: "Finding page",
        executing: () => "Loading page",
        complete: () => "Page loaded"
    },
    notion_query_database: {
        preparing: "Searching your workspace",
        executing: () => "Looking through your workspace",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.total_returned as number | undefined
            return total !== undefined ? `Found ${total} match${total !== 1 ? "es" : ""}` : "Search complete"
        }
    },
    notion_get_schema: {
        preparing: "Checking how this is organized",
        executing: () => "Loading layout details",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const name = parsed?.database_name as string | undefined
            return name ? `Loaded layout for "${truncate(name)}"` : "Layout loaded"
        }
    },
    notion_fetch_related_events: {
        preparing: "Looking for related activity",
        executing: () => "Loading related activity",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const count = parsed?.events_count as number | undefined
            return count !== undefined ? `Found ${count} related update${count !== 1 ? "s" : ""}` : "Related activity loaded"
        }
    },

    // ===================
    // Gmail Tools
    // ===================
    gmail_send_email: {
        preparing: "Getting your email ready",
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
    gmail_create_draft: {
        preparing: "Getting your draft ready",
        executing: params => {
            const to = params?.to as string | undefined
            return to ? `Creating draft for ${truncate(to, 30)}` : "Creating draft"
        },
        complete: params => {
            const to = params?.to as string | undefined
            const subject = params?.subject as string | undefined
            if (subject && to) return `Draft created: "${truncate(subject, 25)}" to ${truncate(to, 20)}`
            if (to) return `Draft created for ${truncate(to, 30)}`
            return "Draft created"
        }
    },

    // ===================
    // Slack Tools
    // ===================
    slack_send_message: {
        preparing: "Getting your message ready",
        executing: () => "Sending your message",
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
        preparing: "Finding page",
        executing: () => "Loading page",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const title = parsed?.title as string | undefined
            return title ? `Opened "${truncate(title)}"` : "Page loaded"
        }
    },
    confluence_add_comment: {
        preparing: "Getting your note ready",
        executing: () => "Adding your note",
        complete: () => "Note added"
    },

    // ===================
    // GitHub Tools
    // ===================
    searchGitHubCode: {
        preparing: "Looking through code",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Looking for "${truncate(query)}" in code` : "Looking through code"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalCount as number | undefined
            const query = params?.query as string | undefined
            if (total !== undefined && query) return `Found ${total} match${total !== 1 ? "es" : ""} for "${truncate(query, 25)}"`
            if (query) return `Looked for "${truncate(query)}"`
            return "Search complete"
        }
    },
    readGitHubFile: {
        preparing: "Finding file",
        executing: params => {
            const path = params?.path as string | undefined
            return path ? `Opening ${truncate(path, 40)}` : "Opening file"
        },
        complete: params => {
            const path = params?.path as string | undefined
            return path ? `Opened ${truncate(path, 40)}` : "Done"
        }
    },
    listGitHubPullRequests: {
        preparing: "Loading change requests",
        executing: params => {
            const repo = params?.repository as string | undefined
            return repo ? `Loading change requests from ${repo}` : "Loading change requests"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const summary = parsed?.summary as Record<string, unknown> | undefined
            const total = summary?.total as number | undefined
            const repo = params?.repository as string | undefined
            if (total !== undefined && repo) return `Found ${total} change request${total !== 1 ? "s" : ""} in ${repo}`
            if (total !== undefined) return `Found ${total} change request${total !== 1 ? "s" : ""}`
            if (repo) return `Loaded change requests from ${repo}`
            return "Change requests loaded"
        }
    },
    listGitHubDirectory: {
        preparing: "Finding folder",
        executing: params => {
            const path = params?.path as string | undefined
            return path ? `Opening ${truncate(path, 40)}` : "Opening folder"
        },
        complete: params => {
            const path = params?.path as string | undefined
            return path ? `Opened ${truncate(path, 40)}` : "Done"
        }
    },
    listGitHubCommits: {
        preparing: "Loading recent updates",
        executing: params => {
            const repo = params?.repository as string | undefined
            return repo ? `Loading recent updates from ${repo}` : "Loading recent updates"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const summary = parsed?.summary as Record<string, unknown> | undefined
            const total = summary?.total as number | undefined
            const repo = params?.repository as string | undefined
            if (total !== undefined && repo) return `Found ${total} update${total !== 1 ? "s" : ""} in ${repo}`
            if (total !== undefined) return `Found ${total} update${total !== 1 ? "s" : ""}`
            if (repo) return `Loaded recent updates from ${repo}`
            return "Recent updates loaded"
        }
    },
    grepGitHubCode: {
        preparing: "Looking through code",
        executing: params => {
            const pattern = params?.pattern as string | undefined
            return pattern ? `Looking for "${truncate(pattern)}"` : "Looking through code"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalCount as number | undefined
            const pattern = params?.pattern as string | undefined
            if (total !== undefined && pattern) return `Found ${total} match${total !== 1 ? "es" : ""} for "${truncate(pattern, 25)}"`
            if (pattern) return `Looked for "${truncate(pattern)}"`
            return "Search complete"
        }
    },
    summarizeGitHubPullRequestDiff: {
        preparing: "Reviewing changes",
        executing: params => {
            const prNumber = params?.pullNumber as number | undefined
            return prNumber ? `Summarizing change request #${prNumber}` : "Summarizing changes"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const pr = parsed?.pullRequest as Record<string, unknown> | undefined
            const title = pr?.title as string | undefined
            const prNumber = (params?.pullNumber as number) || (pr?.number as number)
            if (prNumber && title) return `Summarized change request #${prNumber}: "${truncate(title, 30)}"`
            if (prNumber) return `Summarized change request #${prNumber}`
            return "Summary ready"
        }
    },

    // ===================
    // PostHog Tools
    // ===================
    searchPosthogSessions: {
        preparing: "Looking through visits",
        executing: params => {
            const email = params?.userEmail as string | undefined
            return email ? `Looking for visits from ${email}` : "Looking through visits"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalSessions as number | undefined
            const email = params?.userEmail as string | undefined
            if (total !== undefined && email) return `Found ${total} visit${total !== 1 ? "s" : ""} for ${truncate(email, 25)}`
            if (total !== undefined) return `Found ${total} visit${total !== 1 ? "s" : ""}`
            if (email) return `Looked up visits for ${truncate(email, 25)}`
            return "Visits found"
        }
    },
    searchPosthogLogs: {
        preparing: "Looking through activity logs",
        executing: params => {
            const search = params?.messageSearch as string | undefined
            return search ? `Looking through logs for "${truncate(search)}"` : "Looking through activity logs"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalLogs as number | undefined
            const search = params?.messageSearch as string | undefined
            if (total !== undefined && search) return `Found ${total} log${total !== 1 ? "s" : ""} for "${truncate(search, 25)}"`
            if (total !== undefined) return `Found ${total} log${total !== 1 ? "s" : ""}`
            if (search) return `Looked through logs for "${truncate(search)}"`
            return "Log search complete"
        }
    },
    getPosthogSessionEvents: {
        preparing: "Loading visit details",
        executing: () => "Loading visit details",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const summary = parsed?.summary as Record<string, unknown> | undefined
            const total = summary?.meaningfulEventsReturned as number | undefined
            return total !== undefined ? `Loaded ${total} visit update${total !== 1 ? "s" : ""}` : "Visit details loaded"
        }
    },

    // ===================
    // LaunchDarkly Tools
    // ===================
    listLaunchDarklyFlags: {
        preparing: "Loading feature settings",
        executing: params => {
            const project = params?.projectKey as string | undefined
            return project ? `Loading feature settings from ${project}` : "Loading feature settings"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalFlags as number | undefined
            const project = params?.projectKey as string | undefined
            if (total !== undefined && project) return `Found ${total} feature setting${total !== 1 ? "s" : ""} in ${project}`
            if (total !== undefined) return `Found ${total} feature setting${total !== 1 ? "s" : ""}`
            if (project) return `Loaded feature settings from ${project}`
            return "Feature settings loaded"
        }
    },
    getLaunchDarklyFlagDetails: {
        preparing: "Loading setting details",
        executing: params => {
            const flagKey = params?.flagKey as string | undefined
            return flagKey ? `Loading "${flagKey}"` : "Loading setting details"
        },
        complete: params => {
            const flagKey = params?.flagKey as string | undefined
            return flagKey ? `Loaded "${flagKey}"` : "Loaded details"
        }
    },

    // ===================
    // Datadog Tools
    // ===================
    searchDatadogLogs: {
        preparing: "Looking through logs",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Looking through logs for "${truncate(query)}"` : "Looking through logs"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalLogs as number | undefined
            const query = params?.query as string | undefined
            if (total !== undefined && query) return `Found ${total} log${total !== 1 ? "s" : ""} for "${truncate(query, 25)}"`
            if (total !== undefined) return `Found ${total} log${total !== 1 ? "s" : ""}`
            if (query) return `Looked through logs for "${truncate(query)}"`
            return "Log search complete"
        }
    },
    searchRumEvents: {
        preparing: "Looking at app activity",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Looking for "${truncate(query)}"` : "Loading app activity"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalEvents as number | undefined
            const query = params?.query as string | undefined
            if (total !== undefined && query) return `Found ${total} result${total !== 1 ? "s" : ""} for "${truncate(query, 25)}"`
            if (total !== undefined) return `Found ${total} result${total !== 1 ? "s" : ""}`
            return "Search complete"
        }
    },
    listRumEvents: {
        preparing: "Loading app activity",
        executing: () => "Loading app activity",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalEvents as number | undefined
            return total !== undefined ? `Loaded ${total} activity item${total !== 1 ? "s" : ""}` : "Loaded activity"
        }
    },
    aggregateRumEvents: {
        preparing: "Summarizing app activity",
        executing: () => "Summarizing app activity",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const total = parsed?.totalBuckets as number | undefined
            return total !== undefined ? `Summarized ${total} group${total !== 1 ? "s" : ""}` : "Summary ready"
        }
    },

    // ===================
    // Terse Tools
    // ===================
    web_search: {
        preparing: "Looking on the web",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Looking on the web for "${truncate(query)}"` : "Looking on the web"
        },
        complete: params => {
            const query = params?.query as string | undefined
            return query ? `Found web results for "${truncate(query)}"` : "Web search complete"
        }
    },
    image_edit: {
        preparing: "Getting image ready",
        executing: params => {
            const prompt = params?.prompt as string | undefined
            return prompt ? `Editing image: "${truncate(prompt)}"` : "Editing image"
        },
        complete: params => {
            const prompt = params?.prompt as string | undefined
            return prompt ? `Image edited: "${truncate(prompt)}"` : "Image edited"
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
                return `Getting ready: ${readableName}`
            case "executing":
                return `Working on ${readableName}`
            case "complete":
                return "Done"
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
