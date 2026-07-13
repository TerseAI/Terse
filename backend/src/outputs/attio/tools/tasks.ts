import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioTaskSchema } from "terse-types"
import type { AttioCreateTaskRequest, AttioDeleteTaskRequest, AttioReadTasksRequest, AttioUpdateTaskRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import { defineSessionTool } from "../../../tools/toolUtils"

import { attioApiRequest, attioRequestData, attioToolExecute, buildQueryString, toAttioActorInput } from "./attioApi"

export const attioReadTasksTool = defineSessionTool({
    name: "attio_read_tasks",
    description: `Read Attio tasks. Actions: 'list' (filter by linked record or completion state; limit/offset pagination) and 'get' (fetch by task ID). Tasks are follow-ups and reminders tied to CRM records.`,
    execute: attioToolExecute("attio_read_tasks", executeReadTasksRequest)
})

export const attioCreateTaskTool = defineSessionTool({
    name: "attio_create_task",
    description: `Create an Attio task: content (plaintext) plus optional deadline, assignees (workspace-member emails or IDs) and linked records.`,
    execute: attioToolExecute("attio_create_task", createTask)
})

export const attioUpdateTaskTool = defineSessionTool({
    name: "attio_update_task",
    description: `Update an Attio task's deadline, completion state, assignees or linked records. Task content cannot be changed.`,
    execute: attioToolExecute("attio_update_task", updateTask)
})

export const attioDeleteTaskTool = defineSessionTool({
    name: "attio_delete_task",
    description: `Permanently delete an Attio task.`,
    execute: attioToolExecute("attio_delete_task", deleteTask)
})

async function executeReadTasksRequest(request: AttioReadTasksRequest, accessToken: string): Promise<AttioTasksOutput> {
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
        default:
            throw request satisfies never
    }
}

async function createTask(request: AttioCreateTaskRequest, accessToken: string): Promise<AttioTasksOutput> {
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

async function updateTask(request: AttioUpdateTaskRequest, accessToken: string): Promise<AttioTasksOutput> {
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

async function deleteTask(request: AttioDeleteTaskRequest, accessToken: string): Promise<AttioTasksOutput> {
    await attioApiRequest(accessToken, `/tasks/${encodeURIComponent(request.taskId)}`, { method: "DELETE" })
    return { actions: [taskAction("Deleted task", request.taskId, "Permanently deleted task", RunHistoryActionType.delete)] }
}

function taskAction(action: string, target: string, details: string, type: RunHistoryActionType) {
    return { action, integration: IntegrationType.ATTIO, target, details, type }
}

function truncate(text: string, maxLength = 60): string {
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

type AttioTasksOutput = ToolOutputByName["attio_read_tasks"]
