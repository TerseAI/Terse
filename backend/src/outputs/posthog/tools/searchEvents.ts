import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, PosthogConfig } from "terse-types"

import logger from "../../../common/logger"
import { defineSessionTool } from "../../../tools/toolUtils"
import { buildPosthogEventsWhere, posthogEventsLink, runPosthogHogqlQuery } from "../../../utility/posthog"
import { ToolACLValidator } from "../../abstract/acl"
import { getPosthogApiKeyByIntegrationId } from "../posthogApiClient"

import { validatePosthogArgs } from "./searchLogs"

export const searchEventsTool = defineSessionTool({
    name: "searchPosthogEvents",
    execute: async ({ integrationId, projectId, eventName, customEventsOnly = true, distinctId, propertyFilters, limit = 50, cursor, dateFrom, dateTo }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const posthogApiKey = await getPosthogApiKeyByIntegrationId(integrationId, runContext.context.user)
        if (!posthogApiKey) {
            throw new Error(`PostHog integration not found or access denied for integrationId: ${integrationId}`)
        }

        logger.info("Searching PostHog events", { projectId, eventName, distinctId, propertyFilterCount: propertyFilters?.length ?? 0, cursor, dateFrom, dateTo })

        // PostHog forbids OFFSET on personal API keys, so pagination is keyset on timestamp via cursor
        const { whereClause, values } = buildPosthogEventsWhere({ eventName, customEventsOnly, distinctId, propertyFilters, dateFrom, dateTo, beforeTimestamp: cursor })
        const cappedLimit = Math.min(Math.max(limit, 1), 100)
        // Fetch one extra row to know whether more results exist beyond this page
        const hogql = `SELECT uuid, event, timestamp, distinct_id, properties['$current_url'] FROM events${whereClause} ORDER BY timestamp DESC LIMIT ${cappedLimit + 1}`
        const rows = await runPosthogHogqlQuery(projectId, posthogApiKey, hogql, values)

        const hasMore = rows.length > cappedLimit
        const events = rows.slice(0, cappedLimit).map(row => ({
            id: String(row[0] ?? ""),
            event: String(row[1] ?? ""),
            timestamp: row[2] == null ? undefined : String(row[2]),
            distinctId: row[3] == null ? undefined : String(row[3]),
            url: row[4] == null ? undefined : String(row[4])
        }))
        const eventsLink = posthogEventsLink(projectId)

        const action = {
            action: "Searched PostHog events",
            integration: IntegrationType.POSTHOG,
            target: projectId,
            details: `Found ${events.length} event(s)${eventName ? ` of type "${eventName}"` : ""}${distinctId ? ` for user ${distinctId}` : ""}`,
            url: eventsLink,
            type: RunHistoryActionType.read,
            isReadOnly: true
        }

        return {
            success: true as const,
            events,
            totalEvents: events.length,
            hasMore,
            nextCursor: hasMore ? (events[events.length - 1]?.timestamp ?? null) : null,
            eventsLink,
            actions: [action]
        }
    }
})

export const validateSearchPosthogEvents: ToolACLValidator<"searchPosthogEvents", PosthogConfig> = ({ args, configs }) => validatePosthogArgs(args.integrationId, args.projectId, configs)
