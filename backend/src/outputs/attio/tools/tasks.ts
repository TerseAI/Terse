import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioTaskSchema } from "terse-types"
import type { AttioTasksRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { attioApiRequest, attioRequestData, buildQueryString, resolveAttioAccessToken, toAttioActorInput } from "./attioApi"

export const attioTasksTool = defineSessionTool({
    name: "attio_tasks",
    description: `Manage Attio tasks. Actions: 'list' (filter by linked record, completion state; limit/offset pagination), 'get', 'create' (content plus optional deadline, assignees by workspace-member email or ID, and linked records), 'update' (deadline, completion, assignees, linked records; content is immutable), 'delete'. Use for follow-ups and reminders tied to CRM records.`,
    execute: async ({ integrationId, request }, runContext) => {
        logger.debug("Executing attio_tasks tool", { integrationId, action: request.action })
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await resolveAttioAccessToken(integrationId, runContext)

        try {
            return await executeTasksRequest(request, accessToken)
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error executing attio_tasks", { error: errorMessage, integrationId, action: request.action })
            throw new Error(errorMessage)
        }
    }
})

async function executeTasksRequest(request: AttioTasksRequest, accessToken: string): Promise<AttioTasksOutput> {
    switch (request.action) {
        case "list": {
            const query = buildQueryString({
                limit: request.limit,
                offset: request.offset,
                linked_object: request.linkedObjectSlug,
                linked_record_id: request.linkedRecordId,
                is_completed: request.isCompleted
            })
            const tasks = await attioRequestData(accessToken, `/tasks${query}`, z.array(attioTaskSchema), "tasks")
            return {
                tasks,
                count: tasks.length,
                actions: [taskAction("Listed tasks", "Attio tasks", `Found ${tasks.length} task(s)`, RunHistoryActionType.read)]
            }
        }
        case "get": {
            const task = await attioRequestData(accessToken, `/tasks/${encodeURIComponent(request.taskId)}`, attioTaskSchema, "task")
            return {
                task,
                actions: [taskAction("Fetched task", request.taskId, "Fetched task", RunHistoryActionType.read)]
            }
        }
        case "create": {
            const body = {
                data: {
                    content: request.content,
                    format: "plaintext",
                    deadline_at: request.deadlineAt ?? null,
                    is_completed: request.isCompleted ?? false,
                    linked_records: (request.linkedRecords ?? []).map(record => ({ target_object: record.objectSlug, target_record_id: record.recordId })),
                    assignees: (request.assignees ?? []).map(toAttioActorInput)
                }
            }
            const task = await attioRequestData(accessToken, "/tasks", attioTaskSchema, "task", { method: "POST", body })
            return {
                task,
                actions: [taskAction("Created task", task.id.task_id || "task", `Created task "${truncate(request.content)}"`, RunHistoryActionType.create)]
            }
        }
        case "update": {
            const updates: Record<string, unknown> = {}
            if (request.deadlineAt !== undefined) updates.deadline_at = request.deadlineAt
            if (request.isCompleted !== undefined && request.isCompleted !== null) updates.is_completed = request.isCompleted
            if (request.assignees !== undefined && request.assignees !== null) updates.assignees = request.assignees.map(toAttioActorInput)
            if (request.linkedRecords !== undefined && request.linkedRecords !== null) {
                updates.linked_records = request.linkedRecords.map(record => ({ target_object: record.objectSlug, target_record_id: record.recordId }))
            }
            const task = await attioRequestData(accessToken, `/tasks/${encodeURIComponent(request.taskId)}`, attioTaskSchema, "task", { method: "PATCH", body: { data: updates } })
            return {
                task,
                actions: [taskAction("Updated task", request.taskId, "Updated task", RunHistoryActionType.update)]
            }
        }
        case "delete": {
            await attioApiRequest(accessToken, `/tasks/${encodeURIComponent(request.taskId)}`, { method: "DELETE" })
            return { actions: [taskAction("Deleted task", request.taskId, "Permanently deleted task", RunHistoryActionType.delete)] }
        }
        default:
            throw request satisfies never
    }
}

function taskAction(action: string, target: string, details: string, type: RunHistoryActionType) {
    return { action, integration: IntegrationType.ATTIO, target, details, type }
}

function truncate(text: string, maxLength = 60): string {
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

type AttioTasksOutput = ToolOutputByName["attio_tasks"]
