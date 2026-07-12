import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioListEntrySchema, attioListSchema } from "terse-types"
import type { AttioList, AttioListsRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { attioApiRequest, attioRequestData, attioWriteData, fetchWorkspaceSlug, parseOptionalJsonObject, resolveAttioAccessToken } from "./attioApi"

const ENTRIES_DEFAULT_LIMIT = 20
const ENTRIES_MAX_LIMIT = 500

export const attioListsTool = defineSessionTool({
    name: "attio_lists",
    description: `Manage Attio lists and their entries. List actions: 'list', 'get', 'create', 'update'. Entry actions: 'query_entries' (filter by entry attributes and/or parentRecordId + limit/offset pagination), 'add_entry' (add a record to a list), 'upsert_entry' (add-or-update keyed by parent record, idempotent membership), 'get_entry', 'update_entry' (change entry attributes such as a stage), 'remove_entry' (the parent record is untouched). Entry attribute writes go through entryValues as a JSON object string.`,
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
            const data = await attioRequestData(accessToken, "/lists", z.array(attioListSchema), "lists")
            const workspaceSlug = await fetchWorkspaceSlug(accessToken)
            const lists = data.map(list => withListWebUrl(list, workspaceSlug))
            return {
                lists,
                count: lists.length,
                actions: [listAction("Listed lists", "Attio lists", `Found ${lists.length} list(s)`, RunHistoryActionType.read)]
            }
        }
        case "get": {
            const list = await attioRequestData(accessToken, listPath(request.listIdOrSlug), attioListSchema, "list")
            return {
                list: withListWebUrl(list, await fetchWorkspaceSlug(accessToken)),
                actions: [listAction("Fetched list", request.listIdOrSlug, "Fetched list configuration", RunHistoryActionType.read)]
            }
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
            const list = await attioRequestData(accessToken, "/lists", attioListSchema, "list", { method: "POST", body })
            return {
                list: withListWebUrl(list, await fetchWorkspaceSlug(accessToken)),
                actions: [listAction("Created list", request.apiSlug, `Created list "${request.name}" over ${request.parentObjectSlug}`, RunHistoryActionType.create)]
            }
        }
        case "update": {
            const list = await attioRequestData(accessToken, listPath(request.listIdOrSlug), attioListSchema, "list", { method: "PATCH", body: { data: { name: request.name } } })
            return {
                list: withListWebUrl(list, await fetchWorkspaceSlug(accessToken)),
                actions: [listAction("Updated list", request.listIdOrSlug, `Renamed list to "${request.name}"`, RunHistoryActionType.update)]
            }
        }
        case "query_entries": {
            const limit = Math.max(1, Math.min(request.limit ?? ENTRIES_DEFAULT_LIMIT, ENTRIES_MAX_LIMIT))
            const offset = request.offset ?? 0
            const body: Record<string, unknown> = { limit, offset }
            const filter = buildEntriesFilter(request)
            if (filter) body.filter = filter
            const entries = await attioRequestData(accessToken, `${listPath(request.listIdOrSlug)}/entries/query`, z.array(attioListEntrySchema), "list entries", { method: "POST", body })
            return {
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
            const entry = await attioWriteData(accessToken, request.parentObjectSlug, `${listPath(request.listIdOrSlug)}/entries`, attioListEntrySchema, "list entry", { method, body })
            const verb = request.action === "add_entry" ? "Added" : "Upserted"
            return {
                entry,
                actions: [listAction(`${verb} list entry`, `${request.listIdOrSlug}/${request.parentRecordId}`, `${verb} ${request.parentObjectSlug} record on list`, RunHistoryActionType.create)]
            }
        }
        case "get_entry": {
            const entry = await attioRequestData(accessToken, entryPath(request.listIdOrSlug, request.entryId), attioListEntrySchema, "list entry")
            return {
                entry,
                actions: [listAction("Fetched list entry", request.entryId, "Fetched list entry", RunHistoryActionType.read)]
            }
        }
        case "update_entry": {
            const entryValues = parseOptionalJsonObject(request.entryValues, "entryValues")
            if (!entryValues) {
                throw new Error('Invalid "entryValues": a JSON object string of entry attribute values is required.')
            }
            const method = request.multiselectMode === "append" ? "PATCH" : "PUT"
            const entry = await attioRequestData(accessToken, entryPath(request.listIdOrSlug, request.entryId), attioListEntrySchema, "list entry", {
                method,
                body: { data: { entry_values: entryValues } }
            })
            return {
                entry,
                actions: [listAction("Updated list entry", request.entryId, "Updated list entry values", RunHistoryActionType.update)]
            }
        }
        case "remove_entry": {
            await attioApiRequest(accessToken, entryPath(request.listIdOrSlug, request.entryId), { method: "DELETE" })
            return {
                actions: [listAction("Removed list entry", request.entryId, "Removed entry from list (record untouched)", RunHistoryActionType.delete)]
            }
        }
        default:
            throw request satisfies never
    }
}

function buildEntriesFilter(request: Extract<AttioListsRequest, { action: "query_entries" }>): Record<string, unknown> | undefined {
    const filter = parseOptionalJsonObject(request.filter, "filter")
    const attributeFilter = filter && Object.keys(filter).length > 0 ? filter : undefined
    if (!request.parentRecordId) return attributeFilter
    if (!request.parentObjectSlug) {
        throw new Error('"parentObjectSlug" is required when filtering by "parentRecordId".')
    }
    const parentFilter = {
        path: [
            [request.listIdOrSlug, "parent_record"],
            [request.parentObjectSlug, "record_id"]
        ],
        constraints: { value: request.parentRecordId }
    }
    return attributeFilter ? { $and: [parentFilter, attributeFilter] } : parentFilter
}

function listPath(listIdOrSlug: string): string {
    return `/lists/${encodeURIComponent(listIdOrSlug)}`
}

function entryPath(listIdOrSlug: string, entryId: string): string {
    return `${listPath(listIdOrSlug)}/entries/${encodeURIComponent(entryId)}`
}

function withListWebUrl(list: AttioList, workspaceSlug: string | undefined): AttioList {
    if (!workspaceSlug) return list
    return { ...list, web_url: `https://app.attio.com/${workspaceSlug}/collection/${list.id.list_id}` }
}

function listAction(action: string, target: string, details: string, type: RunHistoryActionType) {
    return { action, integration: IntegrationType.ATTIO, target, details, type }
}

type AttioListsOutput = ToolOutputByName["attio_lists"]
