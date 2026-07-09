import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, PosthogConfig } from "terse-types"

import logger from "../../../common/logger"
import { defineSessionTool } from "../../../tools/toolUtils"
import { buildPosthogEventsWhere, posthogEventsLink, runPosthogHogqlQuery } from "../../../utility/posthog"
import { ToolACLValidator } from "../../abstract/acl"
import { getPosthogApiKeyByIntegrationId } from "../posthogApiClient"

import { validatePosthogArgs } from "./searchLogs"

export const listEventNamesTool = defineSessionTool({
    name: "listPosthogEventNames",
    description:
        "List PostHog event names with how often each occurred, most frequent first (US PostHog Cloud only). Scope with distinctId to profile a single user's activity, or with event/person propertyFilters and a date range.",
    execute: async ({ integrationId, projectId, customEventsOnly = true, distinctId, propertyFilters, dateFrom, dateTo }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const posthogApiKey = await getPosthogApiKeyByIntegrationId(integrationId, runContext.context.user)
        if (!posthogApiKey) {
            throw new Error(`PostHog integration not found or access denied for integrationId: ${integrationId}`)
        }

        logger.info("Listing PostHog event names", { projectId, customEventsOnly, distinctId, propertyFilterCount: propertyFilters?.length ?? 0, dateFrom, dateTo })

        const { whereClause, values } = buildPosthogEventsWhere({ customEventsOnly, distinctId, propertyFilters, dateFrom, dateTo })
        const hogql = `SELECT event, count() AS count FROM events${whereClause} GROUP BY event ORDER BY count DESC LIMIT 500`
        const rows = await runPosthogHogqlQuery(projectId, posthogApiKey, hogql, values)

        const eventCounts = rows.map(row => ({ eventName: String(row[0] ?? "unknown"), count: Number(row[1] ?? 0) }))
        const eventsLink = posthogEventsLink(projectId)

        const action = {
            action: "Listed PostHog event names",
            integration: IntegrationType.POSTHOG,
            target: projectId,
            details: `Event types: ${eventCounts.length}${distinctId ? ` for user ${distinctId}` : ""}`,
            url: eventsLink,
            type: RunHistoryActionType.read,
            isReadOnly: true
        }

        return {
            success: true as const,
            eventCounts,
            totalEventTypes: eventCounts.length,
            eventsLink,
            actions: [action]
        }
    }
})

export const validateListPosthogEventNames: ToolACLValidator<"listPosthogEventNames", PosthogConfig> = ({ args, configs }) => validatePosthogArgs(args.integrationId, args.projectId, configs)
