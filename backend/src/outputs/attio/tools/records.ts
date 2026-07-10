import { RunHistoryActionType } from "@prisma/client"
import { AttioOutputConfig, IntegrationType } from "terse-types"
import type {
    AttioAttributeHistoryEntry,
    AttioCreateRecordRequest,
    AttioDeleteRecordRequest,
    AttioGetAttributeHistoryRequest,
    AttioGetRecordRequest,
    AttioQueryRecordsRequest,
    AttioRecord,
    AttioRecordsRequest,
    AttioSearchMatch,
    AttioSearchRecordsRequest,
    AttioUpdateRecordRequest,
    AttioUpsertRecordsRequest,
    ToolOutputByName
} from "terse-types"
import { z } from "zod"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"
import { ToolACLValidator, requireValueInAnyConfig } from "../../abstract/acl"

import { attioApiRequest, attioWriteRequest, requireAttioData, resolveAttioAccessToken } from "./attioApi"

const QUERY_DEFAULT_LIMIT = 20
const QUERY_MAX_LIMIT = 500
const SEARCH_MAX_LIMIT = 25

export const attioRecordsTool = defineSessionTool({
    name: "attio_records",
    description: `Read and write records in Attio. One tool, several actions: 'query' (filtered listing with limit/offset pagination), 'search' (fuzzy match by name/email/domain), 'get' (fetch by record ID), 'create' (plain create, works for objects without a unique writable attribute), 'update' (patch by record ID), 'upsert' (create-or-update matched on a unique attribute), 'delete' (remove by record ID, irreversible), and 'get_attribute_history' (historic values of one attribute, e.g. every stage a deal has been in). Use attio_schema with the 'list_objects' action first to discover objects and their attributes.`,
    execute: async ({ integrationId, request }, runContext) => {
        logger.debug("Executing attio_records tool", { integrationId, action: request.action, objectSlug: request.objectSlug })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await resolveAttioAccessToken(integrationId, runContext)

        try {
            return await executeRecordsRequest(request, accessToken)
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error executing attio_records", { error: errorMessage, integrationId, action: request.action, objectSlug: request.objectSlug })
            throw new Error(errorMessage)
        }
    }
})

async function executeRecordsRequest(request: AttioRecordsRequest, accessToken: string): Promise<AttioRecordsOutput> {
    switch (request.action) {
        case "query":
            return queryRecords(request, accessToken)
        case "search":
            return searchRecords(request, accessToken)
        case "get":
            return getRecord(request, accessToken)
        case "create":
            return createRecord(request, accessToken)
        case "update":
            return updateRecord(request, accessToken)
        case "upsert":
            return upsertRecords(request, accessToken)
        case "delete":
            return deleteRecord(request, accessToken)
        case "get_attribute_history":
            return getAttributeHistory(request, accessToken)
        default:
            throw request satisfies never
    }
}

async function queryRecords(request: AttioQueryRecordsRequest, accessToken: string): Promise<AttioRecordsOutput> {
    const limit = clampLimit(request.limit, QUERY_DEFAULT_LIMIT, QUERY_MAX_LIMIT)
    const offset = request.offset ?? 0
    const body: Record<string, unknown> = { limit, offset }
    const filter = parseFilter(request.filter)
    if (filter) {
        body.filter = filter
    }

    const data = await attioApiRequest<{ data?: AttioRecord[] }>(accessToken, `/objects/${encodeURIComponent(request.objectSlug)}/records/query`, { method: "POST", body })
    const records = data.data ?? []

    return {
        success: true,
        action: request.action,
        records,
        count: records.length,
        offset,
        actions: [readAction("Queried records", request.objectSlug, `Found ${records.length} ${request.objectSlug} record(s) at offset ${offset}`)]
    }
}

async function searchRecords(request: AttioSearchRecordsRequest, accessToken: string): Promise<AttioRecordsOutput> {
    const limit = clampLimit(request.limit, SEARCH_MAX_LIMIT, SEARCH_MAX_LIMIT)
    const data = await attioApiRequest<{ data?: AttioSearchMatch[] }>(accessToken, "/objects/records/search", {
        method: "POST",
        body: { query: request.query, objects: [request.objectSlug], limit, request_as: { type: "workspace" } }
    })
    const matches = data.data ?? []

    return {
        success: true,
        action: request.action,
        matches,
        count: matches.length,
        actions: [readAction("Searched records", request.objectSlug, `Found ${matches.length} match(es) for "${request.query}"`)]
    }
}

async function getRecord(request: AttioGetRecordRequest, accessToken: string): Promise<AttioRecordsOutput> {
    const data = await attioApiRequest<{ data?: AttioRecord }>(accessToken, recordPath(request.objectSlug, request.recordId))
    if (!data.data) {
        throw new Error(`Attio record "${request.recordId}" not found on object "${request.objectSlug}".`)
    }

    return {
        success: true,
        action: request.action,
        record: data.data,
        actions: [readAction("Fetched record", `${request.objectSlug}/${request.recordId}`, `Fetched ${request.objectSlug} record`)]
    }
}

async function createRecord(request: AttioCreateRecordRequest, accessToken: string): Promise<AttioRecordsOutput> {
    const values = parseValuesObject(request.values)
    const data = await attioWriteRequest<{ data?: AttioRecord }>(accessToken, request.objectSlug, `/objects/${encodeURIComponent(request.objectSlug)}/records`, {
        method: "POST",
        body: { data: { values } }
    })

    return {
        success: true,
        action: request.action,
        record: requireAttioData(data.data, "record"),
        actions: [writeAction("Created record", request.objectSlug, data.data, RunHistoryActionType.create, `Created ${request.objectSlug} record`)]
    }
}

async function updateRecord(request: AttioUpdateRecordRequest, accessToken: string): Promise<AttioRecordsOutput> {
    const values = parseValuesObject(request.values)
    const method = request.multiselectMode === "append" ? "PATCH" : "PUT"
    const data = await attioWriteRequest<{ data?: AttioRecord }>(accessToken, request.objectSlug, recordPath(request.objectSlug, request.recordId), {
        method,
        body: { data: { values } }
    })

    return {
        success: true,
        action: request.action,
        record: requireAttioData(data.data, "record"),
        actions: [writeAction("Updated record", request.objectSlug, data.data, RunHistoryActionType.update, `Updated ${request.objectSlug} record ${request.recordId}`)]
    }
}

async function upsertRecords(request: AttioUpsertRecordsRequest, accessToken: string): Promise<AttioRecordsOutput> {
    const parsedRecords = parseRecordsArray(request.records)

    const successfulRecords: AttioRecord[] = []
    const actions: RunHistoryActionEntry[] = []
    const errors: Array<{ index: number; message: string }> = []

    for (const [index, recordValues] of parsedRecords.entries()) {
        const result = await upsertSingleRecord(request, recordValues, accessToken)
        if ("error" in result) {
            logger.error("Attio upsert record failed", { objectSlug: request.objectSlug, matchingAttribute: request.matchingAttribute, recordIndex: index, error: result.error })
            errors.push({ index, message: result.error })
            continue
        }

        if (result.record) {
            successfulRecords.push(result.record)
        }
        actions.push(
            writeAction(
                "Upserted record",
                request.objectSlug,
                result.record,
                RunHistoryActionType.create,
                `Upserted ${request.objectSlug} record via matching attribute "${request.matchingAttribute}"`
            )
        )
    }

    const successCount = successfulRecords.length
    const failureCount = errors.length

    return {
        success: successCount > 0 || failureCount === 0,
        action: request.action,
        records: successfulRecords,
        count: successCount,
        requestedCount: parsedRecords.length,
        successCount,
        failureCount,
        partial: successCount > 0 && failureCount > 0,
        errors,
        actions
    }
}

async function upsertSingleRecord(request: AttioUpsertRecordsRequest, recordValues: Record<string, unknown>, accessToken: string): Promise<{ record?: AttioRecord } | { error: string }> {
    try {
        const data = await attioWriteRequest<{ data?: AttioRecord }>(
            accessToken,
            request.objectSlug,
            `/objects/${encodeURIComponent(request.objectSlug)}/records?matching_attribute=${encodeURIComponent(request.matchingAttribute)}`,
            { method: "PUT", body: { data: { values: recordValues } } }
        )
        return { record: data.data }
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : String(error) }
    }
}

async function deleteRecord(request: AttioDeleteRecordRequest, accessToken: string): Promise<AttioRecordsOutput> {
    await attioApiRequest<unknown>(accessToken, recordPath(request.objectSlug, request.recordId), { method: "DELETE" })

    return {
        success: true,
        action: request.action,
        deleted: true,
        actions: [
            {
                action: "Deleted record",
                integration: IntegrationType.ATTIO,
                target: `${request.objectSlug}/${request.recordId}`,
                details: `Permanently deleted ${request.objectSlug} record ${request.recordId}`,
                type: RunHistoryActionType.delete
            }
        ]
    }
}

async function getAttributeHistory(request: AttioGetAttributeHistoryRequest, accessToken: string): Promise<AttioRecordsOutput> {
    const query = new URLSearchParams({ show_historic: "true" })
    if (request.limit !== null) query.set("limit", String(request.limit))
    if (request.offset !== null) query.set("offset", String(request.offset))

    const data = await attioApiRequest<{ data?: AttioAttributeHistoryEntry[] }>(
        accessToken,
        `${recordPath(request.objectSlug, request.recordId)}/attributes/${encodeURIComponent(request.attributeSlug)}/values?${query.toString()}`
    )
    const history = data.data ?? []

    return {
        success: true,
        action: request.action,
        history,
        count: history.length,
        actions: [readAction("Fetched attribute history", `${request.objectSlug}/${request.recordId}`, `Fetched ${history.length} historic value(s) of "${request.attributeSlug}"`)]
    }
}

function recordPath(objectSlug: string, recordId: string): string {
    return `/objects/${encodeURIComponent(objectSlug)}/records/${encodeURIComponent(recordId)}`
}

function clampLimit(limit: number | null, defaultLimit: number, maxLimit: number): number {
    if (limit === null) return defaultLimit
    return Math.max(1, Math.min(limit, maxLimit))
}

function parseFilter(filter: string | null): Record<string, unknown> | undefined {
    if (!filter) return undefined
    const parsed = JSON.parse(filter)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).length === 0) return undefined
    return parsed as Record<string, unknown>
}

const attioValuesObjectSchema = z.record(z.string(), z.unknown())

function parseValuesObject(values: string): Record<string, unknown> {
    const parsed = attioValuesObjectSchema.safeParse(parseJsonInput(values, "values"))
    if (!parsed.success) {
        throw new Error(`Invalid "values": expected a JSON object mapping attribute slugs to values, e.g. {"name":"Acme"}.`)
    }
    return parsed.data
}

function parseRecordsArray(records: string): Record<string, unknown>[] {
    const parsed = z.array(attioValuesObjectSchema).min(1).safeParse(parseJsonInput(records, "records"))
    if (!parsed.success) {
        throw new Error(`Invalid "records": expected a non-empty JSON array of objects mapping attribute slugs to values.`)
    }
    return parsed.data
}

function parseJsonInput(raw: string, label: string): unknown {
    try {
        return JSON.parse(raw)
    } catch {
        throw new Error(`Invalid "${label}": not valid JSON.`)
    }
}

function readAction(action: string, target: string, details: string): RunHistoryActionEntry {
    return { action, integration: IntegrationType.ATTIO, target, details, type: RunHistoryActionType.read }
}

function writeAction(action: string, objectSlug: string, record: AttioRecord | undefined, type: RunHistoryActionType, details: string): RunHistoryActionEntry {
    const recordId = record?.id?.record_id
    return {
        action,
        integration: IntegrationType.ATTIO,
        target: `${objectSlug}/${recordId || "unknown"}`,
        details,
        type,
        url: record?.web_url || (recordId ? `https://app.attio.com/objects/${objectSlug}/${recordId}` : undefined)
    }
}

export const validateAttioRecords: ToolACLValidator<"attio_records", AttioOutputConfig> = ({ args, configs }) => validateAttioObjectSlug(args.integrationId, args.request.objectSlug, configs)

export const validateAttioObjectSlug = (integrationId: string, objectSlug: string, configs: AttioOutputConfig[]) => {
    return requireValueInAnyConfig({
        integrationId,
        configs,
        label: "objectSlug",
        pickAllowed: c => (c.objectSlug ? [c.objectSlug] : []),
        value: objectSlug
    })
}

type AttioRecordsOutput = ToolOutputByName["attio_records"]
type RunHistoryActionEntry = NonNullable<AttioRecordsOutput["actions"]>[number]
