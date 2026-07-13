import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioCommentSchema, attioThreadSchema } from "terse-types"
import type { AttioCreateCommentRequest, AttioDeleteCommentRequest, AttioReadCommentsRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import { defineSessionTool } from "../../../tools/toolUtils"

import { attioApiRequest, attioRequestData, attioToolExecute, buildQueryString } from "./attioApi"

export const attioReadCommentsTool = defineSessionTool({
    name: "attio_read_comments",
    execute: attioToolExecute("attio_read_comments", executeReadCommentsRequest)
})

export const attioCreateCommentTool = defineSessionTool({
    name: "attio_create_comment",
    execute: attioToolExecute("attio_create_comment", createComment)
})

export const attioDeleteCommentTool = defineSessionTool({
    name: "attio_delete_comment",
    execute: attioToolExecute("attio_delete_comment", deleteComment)
})

async function executeReadCommentsRequest(request: AttioReadCommentsRequest, accessToken: string): Promise<AttioCommentsOutput> {
    switch (request.action) {
        case "get": {
            const comment = await attioRequestData(accessToken, `/comments/${encodeURIComponent(request.commentId)}`, attioCommentSchema, "comment")
            return {
                comment,
                actions: [commentAction("Fetched comment", request.commentId, "Fetched comment", RunHistoryActionType.read)]
            }
        }
        case "list_threads": {
            const query = buildQueryString({ object: request.objectSlug, record_id: request.recordId, limit: request.limit, offset: request.offset })
            const threads = await attioRequestData(accessToken, `/threads${query}`, z.array(attioThreadSchema), "threads")
            return {
                threads,
                count: threads.length,
                actions: [commentAction("Listed threads", request.recordId || "workspace", `Found ${threads.length} thread(s)`, RunHistoryActionType.read)]
            }
        }
        case "get_thread": {
            const thread = await attioRequestData(accessToken, `/threads/${encodeURIComponent(request.threadId)}`, attioThreadSchema, "thread")
            return {
                thread,
                actions: [commentAction("Fetched thread", request.threadId, "Fetched thread with comments", RunHistoryActionType.read)]
            }
        }
        default:
            throw request satisfies never
    }
}

async function createComment(request: AttioCreateCommentRequest, accessToken: string): Promise<AttioCommentsOutput> {
    const body = { data: { format: "plaintext", content: request.content, author: { type: "workspace-member", id: request.authorWorkspaceMemberId }, ...buildCommentTarget(request) } }
    const comment = await attioRequestData(accessToken, "/comments", attioCommentSchema, "comment", { method: "POST", body })
    const target = request.threadId ? `thread/${request.threadId}` : `${request.objectSlug}/${request.recordId}`
    return {
        comment,
        actions: [commentAction("Created comment", target, "Created comment", RunHistoryActionType.create)]
    }
}

async function deleteComment(request: AttioDeleteCommentRequest, accessToken: string): Promise<AttioCommentsOutput> {
    await attioApiRequest(accessToken, `/comments/${encodeURIComponent(request.commentId)}`, { method: "DELETE" })
    return { actions: [commentAction("Deleted comment", request.commentId, "Permanently deleted comment", RunHistoryActionType.delete)] }
}

function buildCommentTarget(request: AttioCreateCommentRequest): Record<string, unknown> {
    if (request.threadId) {
        return { thread_id: request.threadId }
    }
    if (request.objectSlug && request.recordId) {
        return { record: { object: request.objectSlug, record_id: request.recordId } }
    }
    throw new Error("A comment target is required: pass threadId to reply to a thread, or objectSlug + recordId to comment on a record.")
}

function commentAction(action: string, target: string, details: string, type: RunHistoryActionType) {
    return { action, integration: IntegrationType.ATTIO, target, details, type }
}

type AttioCommentsOutput = ToolOutputByName["attio_read_comments"]
