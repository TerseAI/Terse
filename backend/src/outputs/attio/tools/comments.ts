import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioCommentSchema, attioThreadSchema } from "terse-types"
import type { AttioCommentsRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { attioApiRequest, attioRequestData, buildQueryString, resolveAttioAccessToken } from "./attioApi"

export const attioCommentsTool = defineSessionTool({
    name: "attio_comments",
    description: `Manage Attio comments and threads on records. Actions: 'create' (reply to a thread via threadId, or start a new thread on a record via objectSlug + recordId; requires an author workspace member ID), 'get', 'delete', 'list_threads' (threads on a record), 'get_thread' (a thread with all its comments).`,
    execute: async ({ integrationId, request }, runContext) => {
        logger.debug("Executing attio_comments tool", { integrationId, action: request.action })
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await resolveAttioAccessToken(integrationId, runContext)

        try {
            return await executeCommentsRequest(request, accessToken)
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error executing attio_comments", { error: errorMessage, integrationId, action: request.action })
            throw new Error(errorMessage)
        }
    }
})

async function executeCommentsRequest(request: AttioCommentsRequest, accessToken: string): Promise<AttioCommentsOutput> {
    switch (request.action) {
        case "create": {
            const body = { data: { format: "plaintext", content: request.content, author: { type: "workspace-member", id: request.authorWorkspaceMemberId }, ...buildCommentTarget(request) } }
            const comment = await attioRequestData(accessToken, "/comments", attioCommentSchema, "comment", { method: "POST", body })
            const target = request.threadId ? `thread/${request.threadId}` : `${request.objectSlug}/${request.recordId}`
            return {
                comment,
                actions: [commentAction("Created comment", target, "Created comment", RunHistoryActionType.create)]
            }
        }
        case "get": {
            const comment = await attioRequestData(accessToken, `/comments/${encodeURIComponent(request.commentId)}`, attioCommentSchema, "comment")
            return {
                comment,
                actions: [commentAction("Fetched comment", request.commentId, "Fetched comment", RunHistoryActionType.read)]
            }
        }
        case "delete": {
            await attioApiRequest(accessToken, `/comments/${encodeURIComponent(request.commentId)}`, { method: "DELETE" })
            return { actions: [commentAction("Deleted comment", request.commentId, "Permanently deleted comment", RunHistoryActionType.delete)] }
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

function buildCommentTarget(request: Extract<AttioCommentsRequest, { action: "create" }>): Record<string, unknown> {
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

type AttioCommentsOutput = ToolOutputByName["attio_comments"]
