import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { Session } from "../../../types/session"
import { getPosthogApiKeyByIntegrationId } from "../posthogApiClient"

import { PostHogSessionService, SessionEventsResult } from "./eventDecoder"

/**
 * Tool for fetching and decoding PostHog session replay events.
 * Returns summarized meaningful events (clicks, inputs, console logs, etc.)
 * that can be analyzed by the AI directly.
 */
export const getSessionEventsTool = tool({
    name: ToolName.POSTHOG_GET_SESSION_EVENTS,
    description:
        "Fetch and decode session replay events from PostHog. Returns summarized meaningful events (clicks, inputs, scroll, console logs, network errors, navigation) within a specified time window. Use this to investigate what a user did during a session - what they clicked, what they typed, any errors that occurred, etc. The events are decoded and summarized for easy analysis.",
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the PostHog skill to use."),
        projectId: z.string().describe("The PostHog project ID."),
        sessionId: z.string().uuid().describe("The PostHog session ID (UUID format) to fetch events for. You can get this from searchPosthogSessions."),
        startSeconds: z.union([z.number().min(0), z.null()]).describe("Optional: Start time in seconds from the beginning of the session. If not provided, starts from the beginning."),
        endSeconds: z.union([z.number().min(0), z.null()]).describe("Optional: End time in seconds from the beginning of the session. If not provided, goes until the end.")
    }),
    execute: async ({ integrationId, projectId, sessionId, startSeconds, endSeconds }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const posthogApiKey = await getPosthogApiKeyByIntegrationId(integrationId, runContext.context.user)
        if (!posthogApiKey) {
            throw new Error(`PostHog integration not found or access denied for integrationId: ${integrationId}`)
        }

        const posthogHost = "https://us.posthog.com"

        try {
            logger.info("Fetching PostHog session events", {
                sessionId,
                startSeconds,
                endSeconds,
                projectId,
                integrationId
            })

            // Create service and fetch events
            const service = new PostHogSessionService(posthogApiKey, projectId, posthogHost)
            const result: SessionEventsResult = await service.fetchSessionEvents(sessionId, startSeconds ?? undefined, endSeconds ?? undefined)

            logger.info("PostHog session events fetched", {
                sessionId: result.sessionId,
                sessionUrl: result.sessionUrl,
                totalRawEvents: result.totalRawEvents,
                meaningfulEvents: result.events.length,
                consoleLogs: result.consoleLogs.length
            })

            // Format the response for the AI
            const response = {
                success: true,
                sessionId: result.sessionId,
                sessionUrl: result.sessionUrl,
                startTime: result.startTime,
                duration: result.duration,
                timeWindow: {
                    startSeconds: startSeconds ?? 0,
                    endSeconds: endSeconds ?? result.duration ?? null
                },
                summary: {
                    totalRawEvents: result.totalRawEvents,
                    meaningfulEventsReturned: result.events.length,
                    consoleLogsReturned: result.consoleLogs.length
                },
                events: result.events,
                consoleLogs: result.consoleLogs,
                message: `Retrieved ${result.events.length} meaningful events and ${result.consoleLogs.length} console logs from session. View full session: ${result.sessionUrl}`
            }

            // Return action as part of the result
            const action = {
                action: "Retrieved PostHog session events",
                integration: IntegrationType.POSTHOG,
                target: sessionId,
                details: `Retrieved ${result.events.length} event(s) from session${startSeconds !== null || endSeconds !== null ? ` (time window: ${startSeconds ?? 0}s - ${endSeconds ?? result.duration ?? "end"}s)` : ""}`,
                url: result.sessionUrl,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            logger.error("Error fetching PostHog session events", {
                error,
                sessionId,
                projectId
            })

            if (error.message?.includes("not found")) {
                throw new Error(`Session not found: ${error.message}`)
            } else if (error.message?.includes("API key")) {
                throw new Error(`API key error: ${error.message}`)
            }

            throw new Error(`Failed to fetch PostHog session events: ${error.message || "Unknown error"}`)
        }
    }
})
