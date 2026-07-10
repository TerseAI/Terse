import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"
import type { AttioNote, AttioNotesRequest, ToolOutputByName } from "terse-types"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { attioApiRequest, buildQueryString, requireAttioData, resolveAttioAccessToken } from "./attioApi"

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
            const data = await attioApiRequest<{ data?: AttioNote[] }>(accessToken, `/notes${query}`)
            const notes = data.data ?? []
            return {
                success: true,
                action: request.action,
                notes,
                count: notes.length,
                actions: [noteAction("Listed notes", "Attio notes", `Found ${notes.length} note(s)`, RunHistoryActionType.read)]
            }
        }
        case "get": {
            const data = await attioApiRequest<{ data?: AttioNote }>(accessToken, `/notes/${encodeURIComponent(request.noteId)}`)
            return {
                success: true,
                action: request.action,
                note: requireAttioData(data.data, "note"),
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
            const data = await attioApiRequest<{ data?: AttioNote }>(accessToken, "/notes", { method: "POST", body })
            return {
                success: true,
                action: request.action,
                note: requireAttioData(data.data, "note"),
                actions: [noteAction("Created note", `${request.parentObjectSlug}/${request.parentRecordId}`, `Created note "${request.title}"`, RunHistoryActionType.create)]
            }
        }
        case "delete": {
            await attioApiRequest<unknown>(accessToken, `/notes/${encodeURIComponent(request.noteId)}`, { method: "DELETE" })
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
