import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"
import type { AttioCallRecording, AttioMeeting, AttioMeetingsRequest, AttioTranscript, ToolOutputByName } from "terse-types"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { attioApiRequest, buildQueryString, requireAttioData, resolveAttioAccessToken } from "./attioApi"

export const attioMeetingsTool = defineSessionTool({
    name: "attio_meetings",
    description: `Read Attio meetings, call recordings and transcripts (read-only). Actions: 'list' (filter by linked record, participant emails or time range; cursor pagination via nextCursor), 'get', 'list_recordings' (recordings for a meeting), 'get_transcript' (transcript of a call recording). Use for call-summary and meeting-activity workflows.`,
    execute: async ({ integrationId, request }, runContext) => {
        logger.debug("Executing attio_meetings tool", { integrationId, action: request.action })
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await resolveAttioAccessToken(integrationId, runContext)

        try {
            return await executeMeetingsRequest(request, accessToken)
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error executing attio_meetings", { error: errorMessage, integrationId, action: request.action })
            throw new Error(errorMessage)
        }
    }
})

async function executeMeetingsRequest(request: AttioMeetingsRequest, accessToken: string): Promise<AttioMeetingsOutput> {
    switch (request.action) {
        case "list": {
            const query = buildQueryString({
                limit: request.limit,
                cursor: request.cursor,
                linked_object: request.linkedObjectSlug,
                linked_record_id: request.linkedRecordId,
                participants: request.participants,
                starts_before: request.startsBefore,
                ends_from: request.endsFrom
            })
            const data = await attioApiRequest<{ data?: AttioMeeting[]; pagination?: { next_cursor?: string | null } }>(accessToken, `/meetings${query}`)
            const meetings = data.data ?? []
            return {
                success: true,
                action: request.action,
                meetings,
                count: meetings.length,
                nextCursor: data.pagination?.next_cursor ?? null,
                actions: [meetingAction("Listed meetings", "Attio meetings", `Found ${meetings.length} meeting(s)`)]
            }
        }
        case "get": {
            const data = await attioApiRequest<{ data?: AttioMeeting }>(accessToken, `/meetings/${encodeURIComponent(request.meetingId)}`)
            return { success: true, action: request.action, meeting: requireAttioData(data.data, "meeting"), actions: [meetingAction("Fetched meeting", request.meetingId, "Fetched meeting")] }
        }
        case "list_recordings": {
            const query = buildQueryString({ limit: request.limit, cursor: request.cursor })
            const data = await attioApiRequest<{ data?: AttioCallRecording[]; pagination?: { next_cursor?: string | null } }>(
                accessToken,
                `/meetings/${encodeURIComponent(request.meetingId)}/call_recordings${query}`
            )
            const recordings = data.data ?? []
            return {
                success: true,
                action: request.action,
                recordings,
                count: recordings.length,
                nextCursor: data.pagination?.next_cursor ?? null,
                actions: [meetingAction("Listed call recordings", request.meetingId, `Found ${recordings.length} recording(s)`)]
            }
        }
        case "get_transcript": {
            const query = buildQueryString({ cursor: request.cursor })
            const data = await attioApiRequest<{ data?: AttioTranscript; pagination?: { next_cursor?: string | null } }>(
                accessToken,
                `/meetings/${encodeURIComponent(request.meetingId)}/call_recordings/${encodeURIComponent(request.callRecordingId)}/transcript${query}`
            )
            return {
                success: true,
                action: request.action,
                transcript: requireAttioData(data.data, "transcript"),
                nextCursor: data.pagination?.next_cursor ?? null,
                actions: [meetingAction("Fetched call transcript", request.callRecordingId, "Fetched call transcript")]
            }
        }
        default:
            throw request satisfies never
    }
}

function meetingAction(action: string, target: string, details: string) {
    return { action, integration: IntegrationType.ATTIO, target, details, type: RunHistoryActionType.read }
}

type AttioMeetingsOutput = ToolOutputByName["attio_meetings"]
