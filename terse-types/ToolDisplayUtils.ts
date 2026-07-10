import type { AttioRecordsRequest, MemoryCommand } from "./Tools"

/**
 * The phases a tool call can be in for display purposes.
 */
export type ToolDisplayPhase = "preparing" | "executing" | "complete" | "approval"

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
    /** Optional function that returns a contextual prompt when waiting for user approval. Falls back to executing if not defined. */
    approval?: (params?: Record<string, unknown>) => string
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

function memoryCommand(params?: Record<string, unknown>): MemoryCommand | undefined {
    const command = params?.command
    return command && typeof command === "object" && "op" in command ? (command as MemoryCommand) : undefined
}

function memoryTarget(command: MemoryCommand): string | undefined {
    return command.op === "rename" ? command.old_path : (command.path ?? undefined)
}

function memoryLabel(command: MemoryCommand | undefined, done: boolean): string {
    if (!command) return done ? "Updated memory" : "Accessing memory"
    const target = memoryTarget(command)
    const suffix = target ? ` ${truncate(target, 40)}` : ""
    switch (command.op) {
        case "view":
            return (done ? "Read memory" : "Reading memory") + suffix
        case "create":
            return (done ? "Saved memory" : "Saving memory") + suffix
        case "str_replace":
        case "insert":
            return (done ? "Updated memory" : "Updating memory") + suffix
        case "delete":
            return (done ? "Deleted memory" : "Deleting memory") + suffix
        case "rename":
            return done ? "Renamed memory file" : "Reorganizing memory"
    }
}

function attioRecordsRequest(params?: Record<string, unknown>): AttioRecordsRequest | undefined {
    const request = params?.request
    return request && typeof request === "object" && "action" in request ? (request as AttioRecordsRequest) : undefined
}

function attioRecordsLabel(request: AttioRecordsRequest | undefined, done: boolean, count?: number): string {
    if (!request) return done ? "Updated records" : "Working with records"
    const target = `${request.objectSlug} record`
    switch (request.action) {
        case "query":
        case "search":
            if (done && count !== undefined) return `Found ${count} ${target}${count !== 1 ? "s" : ""}`
            return (done ? "Searched" : "Searching") + ` ${target}s`
        case "get":
            return (done ? "Loaded" : "Loading") + ` ${target}`
        case "get_attribute_history":
            return (done ? "Loaded" : "Loading") + ` ${target} history`
        case "create":
            return (done ? "Created" : "Creating") + ` ${target}`
        case "update":
            return (done ? "Updated" : "Updating") + ` ${target}`
        case "upsert":
            if (done && count !== undefined && count !== 1) return `Saved ${count} ${target}s`
            return (done ? "Saved" : "Saving") + ` ${target}`
        case "delete":
            return (done ? "Deleted" : "Deleting") + ` ${target}`
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
        },
        approval: params => {
            const ticket = params?.ticket as Record<string, unknown> | undefined
            const title = ticket?.title as string | undefined
            return title ? `Create task: "${truncate(title)}"?` : "Create this task?"
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
        },
        approval: () => "Update this task?"
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
        },
        approval: () => "Add this comment?"
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
    linear_read_ticket: {
        preparing: "Loading task details",
        executing: params => {
            const issueId = params?.issueId as string | undefined
            return issueId ? `Loading task ${issueId}` : "Loading task details"
        },
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const issue = parsed?.issue as Record<string, unknown> | undefined
            const identifier = issue?.identifier as string | undefined
            const title = issue?.title as string | undefined
            if (identifier && title) return `Loaded ${identifier}: "${truncate(title, 30)}"`
            if (identifier) return `Loaded task ${identifier}`
            return "Task loaded"
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
    // Notion Tools
    // ===================
    notion_create_or_update_database_row: {
        preparing: "Getting your update ready",
        executing: () => "Saving your update",
        complete: () => "Your update was saved",
        approval: () => "Save this database update?"
    },
    notion_create_or_update_page: {
        preparing: "Getting page changes ready",
        executing: () => "Saving page changes",
        complete: () => "Page updated",
        approval: () => "Save page changes?"
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
        },
        approval: () => "Modify page content?"
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

    notion_list_users: {
        preparing: "Loading workspace members",
        executing: () => "Loading workspace members",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const count = parsed?.count as number | undefined
            if (count !== undefined) return `Found ${count} workspace member${count !== 1 ? "s" : ""}`
            return "Workspace members loaded"
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
        },
        approval: params => {
            const to = params?.to as string | undefined
            const subject = params?.subject as string | undefined
            if (subject && to) return `Send "${truncate(subject, 25)}" to ${truncate(to, 20)}?`
            if (to) return `Send email to ${truncate(to, 30)}?`
            return "Send this email?"
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
        },
        approval: params => {
            const to = params?.to as string | undefined
            return to ? `Create draft for ${truncate(to, 30)}?` : "Create this draft?"
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
        },
        approval: () => "Send this Slack message?"
    },

    slack_list_channels: {
        preparing: "Loading channels",
        executing: () => "Loading channels",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const count = parsed?.count as number | undefined
            if (count !== undefined) return `Found ${count} channel${count !== 1 ? "s" : ""}`
            return "Channels loaded"
        }
    },
    slack_list_users: {
        preparing: "Loading people",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Looking for "${truncate(query)}"` : "Loading people"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const count = parsed?.count as number | undefined
            const query = params?.query as string | undefined
            if (count !== undefined && query) return `Found ${count} person${count !== 1 ? "s" : ""} matching "${truncate(query, 25)}"`
            if (count !== undefined) return `Found ${count} person${count !== 1 ? "s" : ""}`
            return "People loaded"
        }
    },
    slack_read_conversation: {
        preparing: "Loading conversation",
        executing: () => "Loading conversation",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const channelName = parsed?.channelName as string | undefined
            const count = parsed?.count as number | undefined
            if (channelName && count !== undefined) return `Loaded ${count} message${count !== 1 ? "s" : ""} from ${channelName}`
            if (channelName) return `Loaded conversation from ${channelName}`
            return "Conversation loaded"
        }
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
            return path ? `Listing files in ${truncate(path, 40)}` : "Opening folder"
        },
        complete: params => {
            const path = params?.path as string | undefined
            return path ? `Listed files in ${truncate(path, 40)}` : "Done"
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

    listPosthogEventNames: {
        preparing: "Listing event types",
        executing: params => {
            const distinctId = params?.distinctId as string | undefined
            if (distinctId) return `Listing event types for ${truncate(distinctId, 30)}`
            return "Listing event types"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const totalEventTypes = parsed?.totalEventTypes as number | undefined
            if (totalEventTypes !== undefined) return `Found ${totalEventTypes} event type${totalEventTypes !== 1 ? "s" : ""}`
            return "Event types listed"
        }
    },

    searchPosthogEvents: {
        preparing: "Looking through events",
        executing: params => {
            const eventName = params?.eventName as string | undefined
            const distinctId = params?.distinctId as string | undefined
            if (eventName) return `Looking for "${truncate(eventName)}" events`
            if (distinctId) return `Looking for events from ${truncate(distinctId, 30)}`
            return "Looking through events"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const totalEvents = parsed?.totalEvents as number | undefined
            const eventName = params?.eventName as string | undefined
            if (totalEvents !== undefined && eventName) return `Found ${totalEvents} "${truncate(eventName, 25)}" event${totalEvents !== 1 ? "s" : ""}`
            if (totalEvents !== undefined) return `Found ${totalEvents} event${totalEvents !== 1 ? "s" : ""}`
            return "Event search complete"
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
    // Attio Tools
    // ===================
    attio_records: {
        preparing: "Getting records ready",
        executing: params => attioRecordsLabel(attioRecordsRequest(params), false),
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const count = parsed?.count as number | undefined
            return attioRecordsLabel(attioRecordsRequest(params), true, count)
        },
        approval: params => {
            const request = attioRecordsRequest(params)
            const target = request ? `${request.objectSlug} record` : "record"
            return request?.action === "delete" ? `Delete this ${target}? This cannot be undone.` : `Save ${target}?`
        }
    },
    attio_list_objects: {
        preparing: "Loading object types",
        executing: () => "Loading object types",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const count = parsed?.count as number | undefined
            if (count !== undefined) return `Found ${count} object type${count !== 1 ? "s" : ""}`
            return "Object types loaded"
        }
    },

    // ===================
    // WorkOS Tools
    // ===================
    listWorkOSUsers: {
        preparing: "Loading users",
        executing: params => {
            const email = params?.email as string | undefined
            return email ? `Looking up ${truncate(email, 30)}` : "Loading users"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const users = parsed?.users as unknown[] | undefined
            const count = Array.isArray(users) ? users.length : undefined
            const email = params?.email as string | undefined
            if (email && count !== undefined) return `Found ${count} user${count !== 1 ? "s" : ""} for ${truncate(email, 25)}`
            if (count !== undefined) return `Found ${count} user${count !== 1 ? "s" : ""}`
            return "Users loaded"
        }
    },
    listWorkOSOrganizations: {
        preparing: "Loading organizations",
        executing: () => "Loading organizations",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const organizations = parsed?.organizations as unknown[] | undefined
            const count = Array.isArray(organizations) ? organizations.length : undefined
            if (count !== undefined) return `Found ${count} organization${count !== 1 ? "s" : ""}`
            return "Organizations loaded"
        }
    },
    getWorkOSUser: {
        preparing: "Loading user details",
        executing: () => "Loading user details",
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const user = parsed?.user as Record<string, unknown> | undefined
            const email = user?.email as string | undefined
            const firstName = user?.firstName as string | undefined
            if (firstName && email) return `Loaded ${firstName} (${truncate(email, 25)})`
            if (email) return `Loaded user ${truncate(email, 30)}`
            return "User loaded"
        }
    },

    // ===================
    // Terse Tools
    // ===================
    web_search: {
        preparing: "Looking on the web",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Searching the web for "${truncate(query)}"` : "Searching the web"
        },
        complete: (_params, result) => {
            const res = safeParseResult(result)
            const count = (res?.results as unknown[])?.length ?? 0
            return count ? `Found ${count} result${count !== 1 ? "s" : ""}` : "Web search complete"
        }
    },
    web_extract: {
        preparing: "Preparing to read page",
        executing: params => {
            const urls = params?.urls as string | string[] | undefined
            const firstUrl = Array.isArray(urls) ? urls[0] : urls
            return firstUrl ? `Reading ${truncate(firstUrl, 40)}` : "Reading page"
        },
        complete: (_params, result) => {
            const res = safeParseResult(result)
            const count = (res?.results as unknown[])?.length ?? 0
            return count ? `Read ${count} page${count !== 1 ? "s" : ""}` : "Page read complete"
        }
    },
    web_research: {
        preparing: "Starting research",
        executing: params => {
            const input = params?.input as string | undefined
            return input ? `Researching: "${truncate(input)}"` : "Conducting research"
        },
        complete: () => "Research complete"
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
    },
    memory: {
        preparing: "Checking memory",
        executing: params => memoryLabel(memoryCommand(params), false),
        complete: params => memoryLabel(memoryCommand(params), true)
    },

    // ===================
    // Snowflake Tools
    // ===================
    snowflakeExecuteQuery: {
        preparing: "Preparing Snowflake query",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Querying Snowflake: "${truncate(query, 40)}"` : "Querying Snowflake"
        },
        complete: (params, result) => {
            const parsed = safeParseResult(result)
            const rowCount = parsed?.rowCount as number | undefined
            const query = params?.query as string | undefined
            if (rowCount !== undefined) return `Query returned ${rowCount} row${rowCount !== 1 ? "s" : ""}`
            if (query) return `Queried Snowflake: "${truncate(query, 35)}"`
            return "Query complete"
        },
        approval: params => {
            const query = params?.query as string | undefined
            return query ? `Run query: "${truncate(query, 40)}"?` : "Run this Snowflake query?"
        }
    },
    snowflakeExplainQuery: {
        preparing: "Preparing query plan",
        executing: params => {
            const query = params?.query as string | undefined
            return query ? `Explaining query: "${truncate(query, 40)}"` : "Explaining Snowflake query"
        },
        complete: (_params, result) => {
            const parsed = safeParseResult(result)
            const rowCount = parsed?.rowCount as number | undefined
            if (rowCount !== undefined) return `Query plan retrieved (${rowCount} step${rowCount !== 1 ? "s" : ""})`
            return "Query plan retrieved"
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
    phase: ToolDisplayPhase,
    options?: {
        params?: Record<string, unknown>
        result?: string
    }
): string {
    const config = TOOL_DISPLAY_CONFIG[toolName]
    const { params, result } = options || {}

    if (!config) {
        // Fallback for unknown tools - use the tool name in a readable format
        const readableName = getReadableFallbackName(toolName)

        switch (phase) {
            case "preparing":
                return `Getting ready: ${readableName}`
            case "executing":
                return `Working on ${readableName}`
            case "approval":
                return `Approve: ${readableName}?`
            case "complete":
                return "Done"
        }
    }

    switch (phase) {
        case "preparing":
            return config.preparing
        case "executing":
            return config.executing(params)
        case "approval":
            return config.approval ? config.approval(params) : config.executing(params)
        case "complete":
            return config.complete(params, result)
    }
}

export function getReadableFallbackName(toolName: string) {
    return toolName
        .replace(/_/g, " ")
        .replace(/([A-Z])/g, " $1")
        .toLowerCase()
        .trim()
}

/**
 * Convenience function that parses parameters JSON and gets the display string.
 */
export function getToolDisplayFromCall(toolName: string, phase: ToolDisplayPhase, parametersJson?: string, result?: string): string {
    const params = parseToolParams(parametersJson)
    return getToolDisplayForPhase(toolName, phase, { params, result })
}
