import type { ToolDefinition } from "terse-types"

import type { CodegenInput } from "../src/providers/codegenTypes.js"

export function emptyCodegenInput(): CodegenInput {
    return {
        availableIntegrations: ["slack", "github", "linear", "gmail", "notion", "posthog", "datadog", "launchdarkly", "workos", "attio", "snowflake", "hey_reach", "webhook"],
        github: [],
        slack: [],
        gmail: [],
        linear: [],
        notion: [],
        posthog: [],
        datadog: [],
        launchdarkly: [],
        workos: [],
        attio: [],
        snowflake: [],
        heyreach: [],
        tools: []
    }
}

export function terseOnlyCodegenInput(): CodegenInput {
    return {
        ...emptyCodegenInput(),
        tools: [
            tool("web_search", "Web Search", "Search the web for up-to-date information.", "terse"),
            tool("web_extract", "Web Extract", "Extract the readable content of a web page.", "terse"),
            tool("web_research", "Web Research", "Research a topic across multiple sources.", "terse"),
            tool("image_edit", "Image Edit", "Edit or generate an image.", "terse"),
            tool("memory", "Memory", "Read and write persistent memory files.", "terse")
        ]
    }
}

export function fullWorkspaceCodegenInput(): CodegenInput {
    return {
        ...emptyCodegenInput(),
        github: [
            {
                integration: { id: "github-int-1", installation_id: 42, account_name: "terse-inc" },
                repositories: [
                    { id: 1, name: "terse", owner: "terse-inc" },
                    { id: 2, name: "docs", owner: "terse-inc" }
                ]
            }
        ],
        slack: [
            {
                id: "slack-int-1",
                displayName: "Terse Workspace",
                channels: [
                    { id: "C001", name: "general" },
                    { id: "C002", name: "eng-alerts" }
                ],
                users: [{ id: "U001", name: "olivier" }]
            }
        ],
        gmail: [{ id: "gmail-int-1", displayName: "ops@useterse.ai" }],
        linear: [
            {
                id: "linear-int-1",
                displayName: "Terse",
                teams: [{ id: "team-1", name: "Engineering", key: "ENG" }],
                projects: [{ id: "proj-1", name: "Launch", description: "Launch work", teamId: "team-1" }]
            }
        ],
        notion: [
            {
                id: "notion-int-1",
                displayName: "Terse Notion",
                databases: [{ id: "db-1", title: "Roadmap", type: "database" }],
                pages: [{ id: "page-1", title: "Handbook", type: "page" }]
            }
        ],
        posthog: [{ id: "posthog-int-1", displayName: "Terse PostHog", projects: [{ id: "1", name: "Terse Cloud" }] }],
        datadog: [{ id: "datadog-int-1", displayName: "Terse Datadog", indexes: [{ name: "main" }] }],
        launchdarkly: [{ id: "ld-int-1", displayName: "Terse LD", projects: [{ key: "default", name: "Default" }] }],
        workos: [{ id: "workos-int-1", displayName: "Terse WorkOS" }],
        attio: [
            {
                id: "attio-int-1",
                displayName: "Terse CRM",
                objects: [
                    {
                        id: { workspace_id: "ws-1", object_id: "obj-people" },
                        api_slug: "people",
                        singular_noun: "Person",
                        attributes: [
                            { api_slug: "name", title: "Name", type: "personal-name", is_required: true, is_unique: false },
                            { api_slug: "email_addresses", title: "Email addresses", type: "email-address", is_required: false, is_unique: true }
                        ]
                    }
                ]
            }
        ],
        snowflake: [{ id: "snowflake-int-1", name: "Terse Warehouse" }],
        heyreach: [{ id: "heyreach-int-1", displayName: "Terse Outreach", campaigns: [{ id: "42", name: "Founders" }] }],
        tools: [
            tool("slack_send_message", "Send Message", "Send a message to a Slack channel or user.", "slack"),
            tool("slack_read_conversation", "Read Conversation", "Read recent messages from a Slack conversation.", "slack"),
            tool("readGitHubFile", "Read GitHub File", "Read a file from a GitHub repository.", "github"),
            tool("searchGitHubCode", "Search GitHub Code", "Search code across repositories.", "github"),
            tool("linear_create_ticket", "Create Ticket", "Create a Linear issue.", "linear"),
            tool("linear_read_ticket", "Read Ticket", "Read a Linear issue with comments.", "linear"),
            tool("gmail_send_email", "Send Email", "Send an email through Gmail.", "gmail"),
            tool("notion_query_database", "Query Database", "Query a Notion database.", "notion"),
            tool("searchPosthogEvents", "Search PostHog Events", "Search PostHog events.", "posthog"),
            tool("searchDatadogLogs", "Search Datadog Logs", "Search Datadog logs.", "datadog"),
            tool("listLaunchDarklyFlags", "List LaunchDarkly Flags", "List feature flags.", "launchdarkly"),
            tool("listWorkOSUsers", "List WorkOS Users", "List users in WorkOS.", "workos"),
            tool("attio_list_objects", "List Objects", "List Attio objects.", "attio"),
            tool("attio_query_records", "Query Records", "Query Attio records.", "attio"),
            tool("attio_upsert_record", "Upsert Record", "Upsert an Attio record.", "attio"),
            tool("snowflakeExecuteQuery", "Execute Query", "Run a read-only Snowflake query.", "snowflake"),
            tool("web_search", "Web Search", "Search the web for up-to-date information.", "terse"),
            tool("memory", "Memory", "Read and write persistent memory files.", "terse")
        ]
    }
}

function tool(name: string, displayName: string, description: string, integration: string): ToolDefinition {
    return { name, displayName, description, integration, isReadOnly: false, supportsApproval: true }
}
