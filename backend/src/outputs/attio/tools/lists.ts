import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioListEntrySchema, attioListSchema } from "terse-types"
import type {
    AttioAddListEntryRequest,
    AttioCreateListRequest,
    AttioList,
    AttioReadListEntriesRequest,
    AttioReadListsRequest,
    AttioRemoveListEntryRequest,
    AttioUpdateListEntryRequest,
    AttioUpdateListRequest,
    AttioUpsertListEntryRequest,
    ToolOutputByName
} from "terse-types"
import { z } from "zod"

import { defineSessionTool } from "../../../tools/toolUtils"

import { attioApiRequest, attioRequestData, attioToolExecute, attioWriteData, fetchWorkspaceSlug, parseOptionalJsonObject } from "./attioApi"

const ENTRIES_DEFAULT_LIMIT = 20
const ENTRIES_MAX_LIMIT = 500

export const attioReadListsTool = defineSessionTool({
    name: "attio_read_lists",
    description: `Read Attio lists. Actions: 'list' (all lists in the workspace) and 'get' (a list's configuration by ID or slug). List entries have their own tools (attio_read_list_entries and the entry write tools).`,
    execute: attioToolExecute("attio_read_lists", executeReadListsRequest)
})

export const attioCreateListTool = defineSessionTool({
    name: "attio_create_list",
    description: `Create a new Attio list over an object. This changes the workspace for every user.`,
    execute: attioToolExecute("attio_create_list", createList)
})

export const attioUpdateListTool = defineSessionTool({
    name: "attio_update_list",
    description: `Rename an Attio list.`,
    execute: attioToolExecute("attio_update_list", updateList)
})

export const attioReadListEntriesTool = defineSessionTool({
    name: "attio_read_list_entries",
    description: `Read entries of an Attio list. Actions: 'query_entries' (filter by entry attributes and/or parentRecordId; limit/offset pagination) and 'get_entry' (a single entry by ID).`,
    execute: attioToolExecute("attio_read_list_entries", executeReadListEntriesRequest)
})

export const attioAddListEntryTool = defineSessionTool({
    name: "attio_add_list_entry",
    description: `Add a record to an Attio list as a new entry, with optional entry attribute values (entryValues as a JSON object string, e.g. a stage). Throws on unique-attribute conflicts; the same record may appear in multiple entries.`,
    execute: attioToolExecute("attio_add_list_entry", addListEntry)
})

export const attioUpsertListEntryTool = defineSessionTool({
    name: "attio_upsert_list_entry",
    description: `Create or update an Attio list entry keyed by its parent record (idempotent membership): updates the existing entry if the record is already in the list, otherwise adds it.`,
    execute: attioToolExecute("attio_upsert_list_entry", upsertListEntry)
})

export const attioUpdateListEntryTool = defineSessionTool({
    name: "attio_update_list_entry",
    description: `Update an Attio list entry's attribute values (e.g. move its stage). Entry writes go through entryValues as a JSON object string; multiselectMode 'append' adds to multi-value attributes instead of overwriting.`,
    execute: attioToolExecute("attio_update_list_entry", updateListEntry)
})

export const attioRemoveListEntryTool = defineSessionTool({
    name: "attio_remove_list_entry",
    description: `Remove an entry from an Attio list. The parent record itself is untouched.`,
    execute: attioToolExecute("attio_remove_list_entry", removeListEntry)
})

async function executeReadListsRequest(request: AttioReadListsRequest, accessToken: string): Promise<AttioListsOutput> {
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
        default:
            throw request satisfies never
    }
}

async function createList(request: AttioCreateListRequest, accessToken: string): Promise<AttioListsOutput> {
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

async function updateList(request: AttioUpdateListRequest, accessToken: string): Promise<AttioListsOutput> {
    const list = await attioRequestData(accessToken, listPath(request.listIdOrSlug), attioListSchema, "list", { method: "PATCH", body: { data: { name: request.name } } })
    return {
        list: withListWebUrl(list, await fetchWorkspaceSlug(accessToken)),
        actions: [listAction("Updated list", request.listIdOrSlug, `Renamed list to "${request.name}"`, RunHistoryActionType.update)]
    }
}

async function executeReadListEntriesRequest(request: AttioReadListEntriesRequest, accessToken: string): Promise<AttioListsOutput> {
    switch (request.action) {
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
        case "get_entry": {
            const entry = await attioRequestData(accessToken, entryPath(request.listIdOrSlug, request.entryId), attioListEntrySchema, "list entry")
            return {
                entry,
                actions: [listAction("Fetched list entry", request.entryId, "Fetched list entry", RunHistoryActionType.read)]
            }
        }
        default:
            throw request satisfies never
    }
}

async function addListEntry(request: AttioAddListEntryRequest, accessToken: string): Promise<AttioListsOutput> {
    return writeListEntry(request, "POST", "Added", accessToken)
}

async function upsertListEntry(request: AttioUpsertListEntryRequest, accessToken: string): Promise<AttioListsOutput> {
    return writeListEntry(request, "PUT", "Upserted", accessToken)
}

async function writeListEntry(request: AttioAddListEntryRequest | AttioUpsertListEntryRequest, method: "POST" | "PUT", verb: string, accessToken: string): Promise<AttioListsOutput> {
    const body = {
        data: {
            parent_record_id: request.parentRecordId,
            parent_object: request.parentObjectSlug,
            entry_values: parseOptionalJsonObject(request.entryValues, "entryValues") ?? {}
        }
    }
    const entry = await attioWriteData(accessToken, request.parentObjectSlug, `${listPath(request.listIdOrSlug)}/entries`, attioListEntrySchema, "list entry", { method, body })
    return {
        entry,
        actions: [listAction(`${verb} list entry`, `${request.listIdOrSlug}/${request.parentRecordId}`, `${verb} ${request.parentObjectSlug} record on list`, RunHistoryActionType.create)]
    }
}

async function updateListEntry(request: AttioUpdateListEntryRequest, accessToken: string): Promise<AttioListsOutput> {
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

async function removeListEntry(request: AttioRemoveListEntryRequest, accessToken: string): Promise<AttioListsOutput> {
    await attioApiRequest(accessToken, entryPath(request.listIdOrSlug, request.entryId), { method: "DELETE" })
    return {
        actions: [listAction("Removed list entry", request.entryId, "Removed entry from list (record untouched)", RunHistoryActionType.delete)]
    }
}

function buildEntriesFilter(request: Extract<AttioReadListEntriesRequest, { action: "query_entries" }>): Record<string, unknown> | undefined {
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

type AttioListsOutput = ToolOutputByName["attio_read_lists"]
