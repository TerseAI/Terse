import { z } from "zod"

/**
 * Options for fetchResourcesForOrganization.
 * Integration-specific options are nested under the integration key.
 *
 * The Zod schema is the source of truth - the type is inferred from it.
 * When adding options for a new integration, add a new nested schema here.
 */

// Notion-specific fetch options
const NotionFetchOptionsSchema = z.object({
    objectType: z.enum(["page", "database"]).nullable().describe("Filter by resource type. 'database' for structured data tables, 'page' for documents.")
})

// Slack-specific fetch options
const SlackFetchOptionsSchema = z.object({
    objectType: z.enum(["channels", "users"]).nullable().describe("'channels' for channel list (default). 'users' for workspace users and their Slack user IDs (use when configuring DMs).")
})

// Combined fetch options schema for all integrations.
// Use .nullable() for optional keys so OpenAI's strict schema (required array) is satisfied.
export const FetchResourcesOptionsSchema = z
    .object({
        notion: NotionFetchOptionsSchema.nullable(),
        slack: SlackFetchOptionsSchema.nullable()
    })
    .nullable()
    .describe("Optional integration-specific filtering options")

// Type inferred from schema - always stays in sync
export type FetchResourcesOptions = z.infer<typeof FetchResourcesOptionsSchema>
