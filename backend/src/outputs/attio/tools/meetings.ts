import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioCallRecordingSchema, attioMeetingSchema, attioTranscriptSchema } from "terse-types"
import type { AttioMeetingsRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { attioRequestData, attioRequestPage, buildQueryString, resolveAttioAccessToken } from "./attioApi"

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
            const page = await attioRequestPage(accessToken, `/meetings${query}`, z.array(attioMeetingSchema), "meetings")
            return {
                success: true,
                action: request.action,
                meetings: page.data,
                count: page.data.length,
                nextCursor: page.nextCursor,
                actions: [meetingAction("Listed meetings", "Attio meetings", `Found ${page.data.length} meeting(s)`)]
            }
        }
        case "get": {
            const meeting = await attioRequestData(accessToken, `/meetings/${encodeURIComponent(request.meetingId)}`, attioMeetingSchema, "meeting")
            return { success: true, action: request.action, meeting, actions: [meetingAction("Fetched meeting", request.meetingId, "Fetched meeting")] }
        }
        case "list_recordings": {
            const query = buildQueryString({ limit: request.limit, cursor: request.cursor })
            const page = await attioRequestPage(accessToken, `/meetings/${encodeURIComponent(request.meetingId)}/call_recordings${query}`, z.array(attioCallRecordingSchema), "call recordings")
            return {
                success: true,
                action: request.action,
                recordings: page.data,
                count: page.data.length,
                nextCursor: page.nextCursor,
                actions: [meetingAction("Listed call recordings", request.meetingId, `Found ${page.data.length} recording(s)`)]
            }
        }
        case "get_transcript": {
            const query = buildQueryString({ cursor: request.cursor })
            const page = await attioRequestPage(
                accessToken,
                `/meetings/${encodeURIComponent(request.meetingId)}/call_recordings/${encodeURIComponent(request.callRecordingId)}/transcript${query}`,
                attioTranscriptSchema,
                "transcript"
            )
            return {
                success: true,
                action: request.action,
                transcript: page.data,
                nextCursor: page.nextCursor,
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
