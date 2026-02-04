import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { Session } from "../../../types/session"
import { getPosthogApiKeyByIntegrationId } from "../posthogApiClient"

/**
 * Tool for querying PostHog session recordings for a specific user.
 * This tool first finds the person by email, then retrieves their session recordings.
 */
export const searchSessionsTool = tool({
    name: ToolName.POSTHOG_SEARCH_SESSIONS,
    description:
        "Query PostHog session recordings for a specific user by their email address. Returns session recordings data and links to view sessions in PostHog. Use this when you need to replay user sessions, investigate user behavior, or understand how users interact with the application. Returns the most recent session recordings first.",
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the PostHog knowledge base to use."),
        projectId: z.string().describe("The PostHog project ID."),
        userEmail: z.string().email().describe("The email address of the user to query session recordings for. Must be a valid email address."),
        limit: z.number().default(10).describe("Maximum number of session recordings to return (default: 10, max: 100)"),
        offset: z.number().default(0).describe("Offset for pagination (default: 0)"),
        last7Days: z
            .boolean()
            .default(false)
            .describe(
                "If true and dateFrom is not provided, filters session recordings from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided."
            ),
        dateFrom: z
            .union([z.string(), z.null()])
            .describe(
                'Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.'
            ),
        dateTo: z.union([z.string(), z.null()]).describe('End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.')
    }),
    execute: async (
        { integrationId, projectId, userEmail, limit = 10, offset = 0, last7Days = false, dateFrom, dateTo },
        runContext?: RunContext<SessionWithTracking<Session>>
    ) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const posthogApiKey = await getPosthogApiKeyByIntegrationId(integrationId, runContext.context.user.id)
        if (!posthogApiKey) {
            throw new Error(`PostHog integration not found or access denied for integrationId: ${integrationId}`)
        }

        const posthogHost = "https://us.posthog.com"

        try {
            logger.info("Querying PostHog sessions", { userEmail, projectId, limit })

            // Step 1: Find the person by email
            const personsUrl = `${posthogHost}/api/projects/${projectId}/persons/?email=${encodeURIComponent(userEmail)}`

            const personsResponse = await fetch(personsUrl, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${posthogApiKey}`,
                    "Content-Type": "application/json"
                }
            })

            if (!personsResponse.ok) {
                const errorText = await personsResponse.text()
                logger.error("PostHog persons API error", {
                    status: personsResponse.status,
                    error: errorText,
                    userEmail,
                    projectId
                })

                if (personsResponse.status === 401) {
                    throw new Error("PostHog API key is invalid or expired. Please update your PostHog integration.")
                } else if (personsResponse.status === 404) {
                    // Person not found is not necessarily an error - they might not have any events
                    return {
                        success: true,
                        userEmail,
                        projectId,
                        personFound: false,
                        sessions: [],
                        totalSessions: 0,
                        message: `No person found with email ${userEmail} in PostHog. This user may not have any tracked events yet.`
                    }
                }

                throw new Error(`Failed to query PostHog persons: ${errorText}`)
            }

            const personsData = await personsResponse.json()
            const persons = Array.isArray(personsData) ? personsData : personsData.results || []

            if (persons.length === 0) {
                return {
                    success: true,
                    userEmail,
                    projectId,
                    personFound: false,
                    sessions: [],
                    totalSessions: 0,
                    message: `No person found with email ${userEmail} in PostHog. This user may not have any tracked events yet.`
                }
            }

            // Get the first person (most common case)
            const person = persons[0]
            const personId = person.id || person.uuid
            const distinctId = person.distinct_ids?.[0] || userEmail // Fallback to email if no distinct_id

            // Step 2: Get session recordings for the person with pagination and date filtering
            // Calculate date filters
            let dateFromValue = dateFrom ?? undefined
            let dateToValue = dateTo ?? undefined

            // Default to last 7 days if last7Days is true and dateFrom is not provided
            if (last7Days && !dateFromValue) {
                dateFromValue = "-7d" // Use relative date format
            }

            // Default to now if dateTo is not provided
            if (!dateToValue) {
                dateToValue = "now" // Use relative date format
            }

            logger.info("Querying PostHog session recordings", {
                userEmail,
                projectId,
                personId,
                limit,
                offset,
                dateFrom: dateFromValue,
                dateTo: dateToValue
            })

            // Build query parameters
            const params = new URLSearchParams({
                limit: Math.min(limit, 100).toString(),
                offset: offset.toString()
            })

            // Add person filter
            params.append("person_uuid", personId)

            // Add date filters if provided
            if (dateFromValue) {
                params.append("date_from", dateFromValue)
            }
            if (dateToValue) {
                params.append("date_to", dateToValue)
            }

            // Note: PostHog API doesn't support order_by parameter, so we'll sort client-side
            const recordingsUrl = `${posthogHost}/api/projects/${projectId}/session_recordings/?${params.toString()}`

            const recordingsResponse = await fetch(recordingsUrl, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${posthogApiKey}`,
                    "Content-Type": "application/json"
                }
            })

            if (!recordingsResponse.ok) {
                const errorText = await recordingsResponse.text()
                logger.error("PostHog session recordings API error", {
                    status: recordingsResponse.status,
                    error: errorText,
                    personId,
                    projectId
                })

                if (recordingsResponse.status === 401) {
                    throw new Error("PostHog API key is invalid or expired. Please update your PostHog integration.")
                }

                throw new Error(`Failed to query PostHog session recordings: ${errorText}`)
            }

            const recordingsData = await recordingsResponse.json()

            // Extract recordings from response
            const recordings = Array.isArray(recordingsData) ? recordingsData : recordingsData.results || recordingsData.data || []

            // Get pagination metadata
            const totalCount = recordingsData.count || recordings.length
            const hasNext = recordingsData.next ? true : false
            const hasPrevious = recordingsData.previous ? true : false

            // Sort by start_time descending (latest first) if not already sorted
            const sortedRecordings = [...recordings].sort((a: any, b: any) => {
                const timeA = new Date(a.start_time || 0).getTime()
                const timeB = new Date(b.start_time || 0).getTime()
                return timeB - timeA // Descending order
            })

            // Format results
            const formattedSessions = sortedRecordings.map((recording: any) => {
                const sessionId = recording.id || recording.session_id || recording.uuid
                const sessionUrl = `${posthogHost}/replay/${sessionId}`

                return {
                    id: sessionId,
                    startTime: recording.start_time || recording.created_at || recording.timestamp,
                    endTime: recording.end_time || recording.ended_at,
                    duration: recording.duration || recording.duration_seconds,
                    eventsCount: recording.events_count || recording.event_count || 0,
                    sessionUrl,
                    personId: personId,
                    distinctId: distinctId
                }
            })

            // Build link to session recordings UI
            const sessionsLink = `${posthogHost}/replay?person=${encodeURIComponent(personId)}`

            const response = {
                success: true,
                userEmail,
                projectId,
                personFound: true,
                personId,
                distinctId,
                totalSessions: totalCount,
                sessions: formattedSessions,
                sessionsLink,
                pagination: {
                    limit,
                    offset,
                    hasNext,
                    hasPrevious,
                    nextOffset: hasNext ? offset + limit : null,
                    previousOffset: hasPrevious ? Math.max(0, offset - limit) : null
                },
                message: `Found ${formattedSessions.length} session recording(s) for ${userEmail} (showing ${offset + 1}-${offset + formattedSessions.length} of ${totalCount}). View sessions: ${sessionsLink}`
            }

            // Return action as part of the result
            const action = {
                action: "Searched PostHog sessions",
                integration: IntegrationType.POSTHOG,
                target: userEmail,
                details: `Found ${formattedSessions.length} session recording(s) for user${dateFromValue ? ` from ${dateFromValue}` : ""}${dateToValue ? ` to ${dateToValue}` : ""} (${totalCount} total)`,
                url: sessionsLink,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            logger.error("Error querying PostHog sessions", { error, userEmail, projectId })
            throw new Error(`Failed to query PostHog sessions: ${error.message || "Unknown error"}`)
        }
    }
})
