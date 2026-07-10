import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"
import type { AttioList, AttioListEntry, AttioListsRequest, ToolOutputByName } from "terse-types"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { attioApiRequest, attioWriteRequest, parseOptionalJsonObject, resolveAttioAccessToken } from "./attioApi"

const ENTRIES_DEFAULT_LIMIT = 20
const ENTRIES_MAX_LIMIT = 500

export const attioListsTool = defineSessionTool({
    name: "attio_lists",
    description: `Manage Attio lists and their entries. List actions: 'list', 'get', 'create', 'update'. Entry actions: 'query_entries' (filter + limit/offset pagination), 'add_entry' (add a record to a list), 'upsert_entry' (add-or-update keyed by parent record, idempotent membership), 'get_entry', 'update_entry' (change entry attributes such as a stage), 'remove_entry' (the parent record is untouched). Entry attribute writes go through entryValues as a JSON object string.`,
    execute: async ({ integrationId, request }, runContext) => {
        logger.debug("Executing attio_lists tool", { integrationId, action: request.action })
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await resolveAttioAccessToken(integrationId, runContext)

        try {
            return await executeListsRequest(request, accessToken)
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error executing attio_lists", { error: errorMessage, integrationId, action: request.action })
            throw new Error(errorMessage)
        }
    }
})

async function executeListsRequest(request: AttioListsRequest, accessToken: string): Promise<AttioListsOutput> {
    switch (request.action) {
        case "list": {
            const data = await attioApiRequest<{ data?: AttioList[] }>(accessToken, "/lists")
            const lists = data.data ?? []
            return {
                success: true,
                action: request.action,
                lists,
                count: lists.length,
                actions: [listAction("Listed lists", "Attio lists", `Found ${lists.length} list(s)`, RunHistoryActionType.read)]
            }
        }
        case "get": {
            const data = await attioApiRequest<{ data?: AttioList }>(accessToken, listPath(request.listIdOrSlug))
            return { success: true, action: request.action, list: data.data, actions: [listAction("Fetched list", request.listIdOrSlug, "Fetched list configuration", RunHistoryActionType.read)] }
        }
        case "create": {
            const body = {
                data: {
                    name: request.name,
                    api_slug: request.apiSlug,
                    parent_object: request.parentObjectSlug,
                    workspace_access: request.workspaceAccess ?? "full-access",
                    workspace_member_access: []
                }
            }
            const data = await attioApiRequest<{ data?: AttioList }>(accessToken, "/lists", { method: "POST", body })
            return {
                success: true,
                action: request.action,
                list: data.data,
                actions: [listAction("Created list", request.apiSlug, `Created list "${request.name}" over ${request.parentObjectSlug}`, RunHistoryActionType.create)]
            }
        }
        case "update": {
            const data = await attioApiRequest<{ data?: AttioList }>(accessToken, listPath(request.listIdOrSlug), { method: "PATCH", body: { data: { name: request.name } } })
            return {
                success: true,
                action: request.action,
                list: data.data,
                actions: [listAction("Updated list", request.listIdOrSlug, `Renamed list to "${request.name}"`, RunHistoryActionType.update)]
            }
        }
        case "query_entries": {
            const limit = Math.max(1, Math.min(request.limit ?? ENTRIES_DEFAULT_LIMIT, ENTRIES_MAX_LIMIT))
            const offset = request.offset ?? 0
            const body: Record<string, unknown> = { limit, offset }
            const filter = parseOptionalJsonObject(request.filter, "filter")
            if (filter && Object.keys(filter).length > 0) body.filter = filter
            const data = await attioApiRequest<{ data?: AttioListEntry[] }>(accessToken, `${listPath(request.listIdOrSlug)}/entries/query`, { method: "POST", body })
            const entries = data.data ?? []
            return {
                success: true,
                action: request.action,
                entries,
                count: entries.length,
                offset,
                actions: [listAction("Queried list entries", request.listIdOrSlug, `Found ${entries.length} entr(ies) at offset ${offset}`, RunHistoryActionType.read)]
            }
        }
        case "add_entry":
        case "upsert_entry": {
            const body = {
                data: {
                    parent_record_id: request.parentRecordId,
                    parent_object: request.parentObjectSlug,
                    entry_values: parseOptionalJsonObject(request.entryValues, "entryValues") ?? {}
                }
            }
            const method = request.action === "add_entry" ? "POST" : "PUT"
            const data = await attioWriteRequest<{ data?: AttioListEntry }>(accessToken, request.parentObjectSlug, `${listPath(request.listIdOrSlug)}/entries`, { method, body })
            const verb = request.action === "add_entry" ? "Added" : "Upserted"
            return {
                success: true,
                action: request.action,
                entry: data.data,
                actions: [listAction(`${verb} list entry`, `${request.listIdOrSlug}/${request.parentRecordId}`, `${verb} ${request.parentObjectSlug} record on list`, RunHistoryActionType.create)]
            }
        }
        case "get_entry": {
            const data = await attioApiRequest<{ data?: AttioListEntry }>(accessToken, entryPath(request.listIdOrSlug, request.entryId))
            return { success: true, action: request.action, entry: data.data, actions: [listAction("Fetched list entry", request.entryId, "Fetched list entry", RunHistoryActionType.read)] }
        }
        case "update_entry": {
            const entryValues = parseOptionalJsonObject(request.entryValues, "entryValues")
            if (!entryValues) {
                throw new Error('Invalid "entryValues": a JSON object string of entry attribute values is required.')
            }
            const method = request.multiselectMode === "append" ? "PATCH" : "PUT"
            const data = await attioApiRequest<{ data?: AttioListEntry }>(accessToken, entryPath(request.listIdOrSlug, request.entryId), { method, body: { data: { entry_values: entryValues } } })
            return { success: true, action: request.action, entry: data.data, actions: [listAction("Updated list entry", request.entryId, "Updated list entry values", RunHistoryActionType.update)] }
        }
        case "remove_entry": {
            await attioApiRequest<unknown>(accessToken, entryPath(request.listIdOrSlug, request.entryId), { method: "DELETE" })
            return {
                success: true,
                action: request.action,
                deleted: true,
                actions: [listAction("Removed list entry", request.entryId, "Removed entry from list (record untouched)", RunHistoryActionType.delete)]
            }
        }
        default:
            throw request satisfies never
    }
}

function listPath(listIdOrSlug: string): string {
    return `/lists/${encodeURIComponent(listIdOrSlug)}`
}

function entryPath(listIdOrSlug: string, entryId: string): string {
    return `${listPath(listIdOrSlug)}/entries/${encodeURIComponent(entryId)}`
}

function listAction(action: string, target: string, details: string, type: RunHistoryActionType) {
    return { action, integration: IntegrationType.ATTIO, target, details, type }
}

type AttioListsOutput = ToolOutputByName["attio_lists"]
