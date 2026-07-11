import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioNoteSchema } from "terse-types"
import type { AttioNotesRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { attioApiRequest, attioRequestData, buildQueryString, resolveAttioAccessToken } from "./attioApi"

export const attioNotesTool = defineSessionTool({
    name: "attio_notes",
    description: `Manage Attio notes on records. Actions: 'list' (optionally scoped to one record; limit/offset pagination), 'get', 'create' (title + markdown or plaintext content on a record), 'delete'. Use for logging research, call summaries or context onto CRM records.`,
    execute: async ({ integrationId, request }, runContext) => {
        logger.debug("Executing attio_notes tool", { integrationId, action: request.action })
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await resolveAttioAccessToken(integrationId, runContext)

        try {
            return await executeNotesRequest(request, accessToken)
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error executing attio_notes", { error: errorMessage, integrationId, action: request.action })
            throw new Error(errorMessage)
        }
    }
})

async function executeNotesRequest(request: AttioNotesRequest, accessToken: string): Promise<AttioNotesOutput> {
    switch (request.action) {
        case "list": {
            const query = buildQueryString({
                limit: request.limit,
                offset: request.offset,
                parent_object: request.parentObjectSlug,
                parent_record_id: request.parentRecordId
            })
            const notes = await attioRequestData(accessToken, `/notes${query}`, z.array(attioNoteSchema), "notes")
            return {
                success: true,
                action: request.action,
                notes,
                count: notes.length,
                actions: [noteAction("Listed notes", "Attio notes", `Found ${notes.length} note(s)`, RunHistoryActionType.read)]
            }
        }
        case "get": {
            const note = await attioRequestData(accessToken, `/notes/${encodeURIComponent(request.noteId)}`, attioNoteSchema, "note")
            return {
                success: true,
                action: request.action,
                note,
                actions: [noteAction("Fetched note", request.noteId, "Fetched note", RunHistoryActionType.read)]
            }
        }
        case "create": {
            const body = {
                data: {
                    parent_object: request.parentObjectSlug,
                    parent_record_id: request.parentRecordId,
                    title: request.title,
                    format: request.format ?? "markdown",
                    content: request.content
                }
            }
            const note = await attioRequestData(accessToken, "/notes", attioNoteSchema, "note", { method: "POST", body })
            return {
                success: true,
                action: request.action,
                note,
                actions: [noteAction("Created note", `${request.parentObjectSlug}/${request.parentRecordId}`, `Created note "${request.title}"`, RunHistoryActionType.create)]
            }
        }
        case "delete": {
            await attioApiRequest(accessToken, `/notes/${encodeURIComponent(request.noteId)}`, { method: "DELETE" })
            return { success: true, action: request.action, deleted: true, actions: [noteAction("Deleted note", request.noteId, "Permanently deleted note", RunHistoryActionType.delete)] }
        }
        default:
            throw request satisfies never
    }
}

function noteAction(action: string, target: string, details: string, type: RunHistoryActionType) {
    return { action, integration: IntegrationType.ATTIO, target, details, type }
}

type AttioNotesOutput = ToolOutputByName["attio_notes"]
