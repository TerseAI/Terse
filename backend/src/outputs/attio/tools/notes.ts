import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioNoteSchema } from "terse-types"
import type { AttioCreateNoteRequest, AttioDeleteNoteRequest, AttioReadNotesRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import { defineSessionTool } from "../../../tools/toolUtils"

import { attioApiRequest, attioRequestData, attioToolExecute, buildQueryString } from "./attioApi"

export const attioReadNotesTool = defineSessionTool({
    name: "attio_read_notes",
    execute: attioToolExecute("attio_read_notes", executeReadNotesRequest)
})

export const attioCreateNoteTool = defineSessionTool({
    name: "attio_create_note",
    execute: attioToolExecute("attio_create_note", createNote)
})

export const attioDeleteNoteTool = defineSessionTool({
    name: "attio_delete_note",
    execute: attioToolExecute("attio_delete_note", deleteNote)
})

async function executeReadNotesRequest(request: AttioReadNotesRequest, accessToken: string): Promise<AttioNotesOutput> {
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
                notes,
                count: notes.length,
                actions: [noteAction("Listed notes", "Attio notes", `Found ${notes.length} note(s)`, RunHistoryActionType.read)]
            }
        }
        case "get": {
            const note = await attioRequestData(accessToken, `/notes/${encodeURIComponent(request.noteId)}`, attioNoteSchema, "note")
            return {
                note,
                actions: [noteAction("Fetched note", request.noteId, "Fetched note", RunHistoryActionType.read)]
            }
        }
        default:
            throw request satisfies never
    }
}

async function createNote(request: AttioCreateNoteRequest, accessToken: string): Promise<AttioNotesOutput> {
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
        note,
        actions: [noteAction("Created note", `${request.parentObjectSlug}/${request.parentRecordId}`, `Created note "${request.title}"`, RunHistoryActionType.create)]
    }
}

async function deleteNote(request: AttioDeleteNoteRequest, accessToken: string): Promise<AttioNotesOutput> {
    await attioApiRequest(accessToken, `/notes/${encodeURIComponent(request.noteId)}`, { method: "DELETE" })
    return { actions: [noteAction("Deleted note", request.noteId, "Permanently deleted note", RunHistoryActionType.delete)] }
}

function noteAction(action: string, target: string, details: string, type: RunHistoryActionType) {
    return { action, integration: IntegrationType.ATTIO, target, details, type }
}

type AttioNotesOutput = ToolOutputByName["attio_read_notes"]
