import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, PosthogConfig } from "terse-types"

import logger from "../../../common/logger"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator, requireValueInAnyConfig } from "../../abstract/acl"
import { getPosthogApiKeyByIntegrationId } from "../posthogApiClient"

/**
 * Tool for querying PostHog logs with flexible filtering options.
 * This tool queries the PostHog Logs product API to find logs. You can filter by user, log level, message content, or combinations thereof.
 */
export const searchLogsTool = defineSessionTool({
    name: "searchPosthogLogs",
    execute: async ({ integrationId, projectId, userEmail, severityLevels, messageSearch, limit = 50, offset = 0, last7Days = false, dateFrom, dateTo }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        // Normalize null to undefined for easier handling
        const normalizedUserEmail = userEmail ?? undefined
        const normalizedSeverityLevels = severityLevels ?? undefined
        const normalizedMessageSearch = messageSearch ?? undefined

        // Validate that at least one filter is provided
        const hasUserFilter = normalizedUserEmail && normalizedUserEmail.trim().length > 0
        const hasSeverityFilter = normalizedSeverityLevels && normalizedSeverityLevels.length > 0
        const hasMessageFilter = normalizedMessageSearch && normalizedMessageSearch.trim().length > 0

        if (!hasUserFilter && !hasSeverityFilter && !hasMessageFilter) {
            throw new Error("At least one filter must be provided: userEmail, severityLevels, or messageSearch.")
        }
        const user = runContext.context.user
        const posthogApiKey = await getPosthogApiKeyByIntegrationId(integrationId, user)
        if (!posthogApiKey) {
            throw new Error(`PostHog integration not found or access denied for integrationId: ${integrationId}`)
        }

        const posthogHost = "https://us.posthog.com"

        try {
            // Calculate date filters - use PostHog relative format
            let dateFromValue: string | null = dateFrom ?? null

            // Default to last 7 days if last7Days is true and dateFrom is not provided
            if (last7Days && !dateFromValue) {
                dateFromValue = "-7d"
            }

            logger.info("Querying PostHog logs", {
                userEmail: normalizedUserEmail,
                severityLevels: normalizedSeverityLevels,
                messageSearch: normalizedMessageSearch,
                projectId,
                limit,
                offset,
                dateFrom: dateFromValue
            })

            // Query the Logs product API
            const logsQueryUrl = `${posthogHost}/api/projects/${projectId}/logs/query/`

            // Build filterGroup conditionally - all filters go into a single inner values array
            const filterConditions: any[] = []
            if (hasUserFilter && normalizedUserEmail) {
                filterConditions.push({
                    key: "userEmail",
                    value: [normalizedUserEmail],
                    operator: "exact",
                    type: "log_attribute"
                })
            }
            if (hasMessageFilter && normalizedMessageSearch) {
                filterConditions.push({
                    key: "message",
                    value: normalizedMessageSearch.trim(),
                    operator: "icontains",
                    type: "log"
                })
            }

            // Build the request body in the correct PostHog Logs API format
            const requestBody = {
                query: {
                    limit: Math.min(limit, 250), // PostHog max is 250
                    offset: offset,
                    orderBy: "latest",
                    dateRange: {
                        date_from: dateFromValue,
                        date_to: dateTo ?? null
                    },
                    searchTerm: "", // Not used - message filtering is done via filterGroup
                    filterGroup: {
                        type: "AND",
                        values: [
                            {
                                type: "AND",
                                values: filterConditions
                            }
                        ]
                    },
                    severityLevels: normalizedSeverityLevels && normalizedSeverityLevels.length > 0 ? normalizedSeverityLevels : [],
                    serviceNames: []
                }
            }

            const fetchResponse = await fetch(logsQueryUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${posthogApiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            })

            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text()
                logger.error("PostHog logs API error", {
                    status: fetchResponse.status,
                    error: errorText,
                    userEmail: normalizedUserEmail,
                    severityLevels: normalizedSeverityLevels,
                    messageSearch: normalizedMessageSearch,
                    projectId
                })

                if (fetchResponse.status === 401) {
                    throw new Error("PostHog API key is invalid or expired. Please update your PostHog integration.")
                } else if (fetchResponse.status === 403) {
                    throw new Error("PostHog API key does not have logs:read permission. Please ensure your API key has the correct scope.")
                } else if (fetchResponse.status === 404) {
                    throw new Error(`PostHog project ${projectId} not found. Please verify the project ID in your configuration.`)
                }

                throw new Error(`Failed to query PostHog logs: ${errorText}`)
            }

            const logsData = await fetchResponse.json()

            // Build link to logs UI
            const logsLink = `${posthogHost}/project/${projectId}/logs`

            // Extract and format log entries
            const logEntries = Array.isArray(logsData) ? logsData : logsData.results || logsData.data || logsData.logs || []

            // Get pagination metadata if available
            const totalCount = logsData.count || logsData.total || logEntries.length

            // Sort by timestamp descending (latest first) if not already sorted
            const sortedLogs = [...logEntries].sort((a: any, b: any) => {
                const timeA = new Date(a.timestamp || a.created_at || a.time || 0).getTime()
                const timeB = new Date(b.timestamp || b.created_at || b.time || 0).getTime()
                return timeB - timeA // Descending order
            })

            const formattedLogs = sortedLogs.map((log: any) => ({
                id: log.id || log.log_id || log.uuid,
                timestamp: log.timestamp || log.created_at || log.time,
                level: log.level || log.severity || log.severity_text || "info",
                message: log.body || log.message || log.content || log.text || "",
                service: log.service || log.service_name || log.source || log.resource_attributes?.["service.name"] || "unknown",
                attributes: log.attributes || log.properties || {}
            }))

            // Determine if there are more results available
            const hasMore = formattedLogs.length === Math.min(limit, 250)
            const nextOffset = hasMore ? offset + formattedLogs.length : null

            // Build filter description for the response message
            const filterDescriptions: string[] = []
            if (hasUserFilter && normalizedUserEmail) {
                filterDescriptions.push(`userEmail="${normalizedUserEmail}"`)
            }
            if (hasSeverityFilter && normalizedSeverityLevels) {
                filterDescriptions.push(`severity levels: ${normalizedSeverityLevels.join(", ")}`)
            }
            if (hasMessageFilter && normalizedMessageSearch) {
                filterDescriptions.push(`message contains: "${normalizedMessageSearch}"`)
            }
            const filterDescription = filterDescriptions.length > 0 ? filterDescriptions.join(", ") : "no filters"

            const response = {
                success: true as const,
                userEmail: normalizedUserEmail || null,
                severityLevels: normalizedSeverityLevels || null,
                messageSearch: normalizedMessageSearch || null,
                projectId,
                totalLogs: totalCount,
                logs: formattedLogs,
                logsLink,
                pagination: {
                    limit: Math.min(limit, 250),
                    offset,
                    hasMore,
                    nextOffset,
                    showing: `${offset + 1}-${offset + formattedLogs.length}`
                },
                message: `Found ${formattedLogs.length} log entries filtered by ${filterDescription} (showing ${offset + 1}-${offset + formattedLogs.length}${hasMore ? ", more available" : ""}). View all logs: ${logsLink}`
            }

            // Return action as part of the result
            const queryDesc = normalizedMessageSearch ? ` matching "${normalizedMessageSearch}"` : ""
            const action = {
                action: "Searched PostHog logs",
                integration: IntegrationType.POSTHOG,
                target: projectId,
                details: `Searched event logs: Found ${formattedLogs.length} event(s)${queryDesc}${dateFromValue ? ` from ${dateFromValue}` : ""}${dateTo ? ` to ${dateTo}` : ""}`,
                url: logsLink,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            logger.error("Error querying PostHog logs", { error, userEmail: normalizedUserEmail, severityLevels: normalizedSeverityLevels, messageSearch: normalizedMessageSearch, projectId })
            throw new Error(`Failed to query PostHog logs: ${error.message || "Unknown error"}`)
        }
    }
})

export const validateSearchPosthogLogs: ToolACLValidator<"searchPosthogLogs", PosthogConfig> = ({ args, configs }) => validatePosthogArgs(args.integrationId, args.projectId, configs)

export const validatePosthogArgs = (integrationId: string, projectId: string, configs: PosthogConfig[]) => {
    return requireValueInAnyConfig({
        integrationId,
        configs,
        label: "projectId",
        pickAllowed: c => [c.projectId],
        value: projectId
    })
}
