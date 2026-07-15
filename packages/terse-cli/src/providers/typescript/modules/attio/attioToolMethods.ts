import type { ToolDefinition, ToolName } from "terse-types"
import { ToolDefinitions } from "terse-types"
import { z } from "zod"

import type { ToolMethodContext } from "../IntegrationModule.js"
import { escapeString } from "../moduleHelpers.js"

import { ATTIO_RESOURCE_METHOD_SPECS, type AttioResourceMethodSpec, type AttioResultSpec, attioMethodParamsTypeName, attioOutputTypeName } from "./attioProjection.js"

export function buildAttioToolMethods(integrationId: string, tool: ToolDefinition): ToolMethodContext[] | null {
    switch (tool.name) {
        case "attio_read_records":
        case "attio_create_record":
        case "attio_update_record":
        case "attio_upsert_record":
        case "attio_delete_record":
            return buildAttioRecordsMethods(integrationId, tool)
        case "attio_read_lists":
        case "attio_create_list":
        case "attio_update_list":
        case "attio_read_list_entries":
        case "attio_add_list_entry":
        case "attio_upsert_list_entry":
        case "attio_update_list_entry":
        case "attio_remove_list_entry":
            return buildAttioListsMethods(integrationId, tool)
        default: {
            const specs = ATTIO_RESOURCE_METHOD_SPECS[tool.name]
            return specs ? buildAttioResourceMethods(integrationId, tool, specs) : null
        }
    }
}

function buildAttioRecordsMethods(integrationId: string, tool: ToolDefinition): ToolMethodContext[] {
    const id = escapeString(integrationId)
    const toolName = tool.name
    const call = (requestExpr: string) => `TerseAgent.executeTool<${attioOutputTypeName(toolName)}>("${toolName}", { integrationId: "${id}", request: ${requestExpr} })`
    const objectSlug = "objectSlug: __normalizeAttioObjectSlug(params.object)"

    switch (toolName) {
        case "attio_read_records":
            return [
                {
                    description: attioActionDescription(toolName, "query"),
                    generatedSignature: "queryRecords<TObject extends GeneratedAttioObject>(params: AttioQueryRecordsParams<TObject>): Promise<AttioQueryRecordsResult<TObject>>",
                    runtimeLines: [
                        "queryRecords: <TObject extends GeneratedAttioObject>(params: AttioQueryRecordsParams<TObject>) =>",
                        `    ${call(`{ action: "query", ${objectSlug}, filter: __serializeAttioFilter(params.filter), limit: params.limit ?? null, offset: params.offset ?? null }`)}.then(result => __enhanceAttioQueryResult(params.object, result)),`
                    ]
                },
                {
                    description: attioActionDescription(toolName, "search"),
                    generatedSignature: "searchRecords<TObject extends GeneratedAttioObject>(params: AttioSearchRecordsParams<TObject>): Promise<AttioSearchRecordsResult>",
                    runtimeLines: [
                        "searchRecords: <TObject extends GeneratedAttioObject>(params: AttioSearchRecordsParams<TObject>) =>",
                        `    ${call(`{ action: "search", ${objectSlug}, query: params.query, limit: params.limit ?? null }`)}.then(result => __enhanceAttioSearchResult(result)),`
                    ]
                },
                {
                    description: attioActionDescription(toolName, "get"),
                    generatedSignature: "getRecord<TObject extends GeneratedAttioObject>(params: AttioGetRecordParams<TObject>): Promise<AttioSingleRecordResult<TObject>>",
                    runtimeLines: [
                        "getRecord: <TObject extends GeneratedAttioObject>(params: AttioGetRecordParams<TObject>) =>",
                        `    ${call(`{ action: "get", ${objectSlug}, recordId: params.recordId }`)}.then(result => __enhanceAttioSingleRecordResult(params.object, result)),`
                    ]
                },
                {
                    description: attioActionDescription(toolName, "get_attribute_history"),
                    generatedSignature:
                        "getAttributeHistory<TObject extends GeneratedAttioObject, TAttr extends AttioAttributeSlug<TObject>>(params: AttioGetAttributeHistoryParams<TObject> & { attribute: TAttr }): Promise<AttioAttributeHistoryResult<__AttioSingleValue<NonNullable<AttioRecordValuesFor<TObject>[TAttr & keyof AttioRecordValuesFor<TObject>]>>>>",
                    runtimeLines: [
                        "getAttributeHistory: <TObject extends GeneratedAttioObject, TAttr extends AttioAttributeSlug<TObject>>(params: AttioGetAttributeHistoryParams<TObject> & { attribute: TAttr }) =>",
                        `    ${call(`{ action: "get_attribute_history", ${objectSlug}, recordId: params.recordId, attributeSlug: params.attribute, limit: params.limit ?? null, offset: params.offset ?? null }`)}.then(result => __enhanceAttioHistoryResult<__AttioSingleValue<NonNullable<AttioRecordValuesFor<TObject>[TAttr & keyof AttioRecordValuesFor<TObject>]>>>(result)),`
                    ]
                }
            ]
        case "attio_create_record":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: "createRecord<TObject extends GeneratedAttioObject>(params: AttioCreateRecordParams<TObject>): Promise<AttioSingleRecordResult<TObject>>",
                    runtimeLines: [
                        "createRecord: <TObject extends GeneratedAttioObject>(params: AttioCreateRecordParams<TObject>) =>",
                        `    ${call(`{ ${objectSlug}, values: JSON.stringify(params.values) }`)}.then(result => __enhanceAttioSingleRecordResult(params.object, result)),`
                    ]
                }
            ]
        case "attio_update_record":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: "updateRecord<TObject extends GeneratedAttioObject>(params: AttioUpdateRecordParams<TObject>): Promise<AttioSingleRecordResult<TObject>>",
                    runtimeLines: [
                        "updateRecord: <TObject extends GeneratedAttioObject>(params: AttioUpdateRecordParams<TObject>) =>",
                        `    ${call(`{ ${objectSlug}, recordId: params.recordId, values: JSON.stringify(params.values), multiselectMode: params.multiselectMode ?? null }`)}.then(result => __enhanceAttioSingleRecordResult(params.object, result)),`
                    ]
                }
            ]
        case "attio_upsert_record":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: "upsertRecord<TObject extends GeneratedAttioObject>(params: AttioUpsertRecordParams<TObject>): Promise<AttioUpsertRecordResult<TObject>>",
                    runtimeLines: [
                        "upsertRecord: <TObject extends GeneratedAttioObject>(params: AttioUpsertRecordParams<TObject>) =>",
                        `    ${call(`{ ${objectSlug}, matchingAttribute: params.matchingAttribute, records: __serializeAttioRecords(params.records) }`)}.then(result => __enhanceAttioUpsertResult(params.object, result)),`
                    ]
                }
            ]
        case "attio_delete_record":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: "deleteRecord<TObject extends GeneratedAttioObject>(params: AttioDeleteRecordParams<TObject>): Promise<void>",
                    runtimeLines: [
                        "deleteRecord: <TObject extends GeneratedAttioObject>(params: AttioDeleteRecordParams<TObject>) =>",
                        `    ${call(`{ ${objectSlug}, recordId: params.recordId }`)}.then(() => undefined),`
                    ]
                }
            ]
        default:
            return []
    }
}

// Method TSDoc is single-sourced: single-op tools inherit the tool description, action-mapped
// methods inherit the zod action literal's description.
function attioActionDescription(toolName: string, action: string): string | undefined {
    if (!isKnownToolName(toolName)) return undefined
    const parsed = attioRequestUnionJsonSchema.safeParse(z.toJSONSchema(ToolDefinitions[toolName].inputSchema))
    if (!parsed.success) return undefined
    const request = parsed.data.properties.request
    for (const branch of request.oneOf ?? request.anyOf ?? []) {
        const actionBranch = attioActionBranchJsonSchema.safeParse(branch)
        if (actionBranch.success && actionBranch.data.properties.action.const === action) {
            return actionBranch.data.properties.action.description
        }
    }
    return undefined
}

function isKnownToolName(name: string): name is ToolName {
    return name in ToolDefinitions
}

const attioRequestUnionJsonSchema = z.object({
    properties: z.object({ request: z.object({ oneOf: z.array(z.unknown()).optional(), anyOf: z.array(z.unknown()).optional() }) })
})

const attioActionBranchJsonSchema = z.object({
    properties: z.object({ action: z.object({ const: z.string(), description: z.string().optional() }) })
})

// Each method narrows the wire result to its action's payload at runtime: singles unwrap to the bare
// entity (throwing if absent), lists rebuild a { items, count, nextCursor? } wrapper, deletes resolve void.
function attioResultParts(toolName: string, result: AttioResultSpec): { resultType: string; thenExpr: string } {
    const base = attioOutputTypeName(toolName)
    switch (result.kind) {
        case "single":
            return {
                resultType: `NonNullable<${base}["${result.key}"]>`,
                thenExpr: `.then(result => __requireAttioPayload(result.${result.key}, "${result.what ?? result.key}"))`
            }
        case "singleWithCursor":
            return {
                resultType: `{ ${result.key}: NonNullable<${base}["${result.key}"]>; nextCursor: string | null }`,
                thenExpr: `.then(result => ({ ${result.key}: __requireAttioPayload(result.${result.key}, "${result.what ?? result.key}"), nextCursor: result.nextCursor ?? null }))`
            }
        case "list": {
            const cursorType = result.cursor ? "; nextCursor: string | null" : ""
            const cursorValue = result.cursor ? ", nextCursor: result.nextCursor ?? null" : ""
            return {
                resultType: `{ ${result.key}: NonNullable<${base}["${result.key}"]>; count: number${cursorType} }`,
                thenExpr: `.then(result => ({ ${result.key}: result.${result.key} ?? [], count: (result.${result.key} ?? []).length${cursorValue} }))`
            }
        }
        case "void":
            return { resultType: "void", thenExpr: ".then(() => undefined)" }
        default:
            throw result satisfies never
    }
}

function buildAttioResourceMethods(integrationId: string, tool: ToolDefinition, specs: AttioResourceMethodSpec[]): ToolMethodContext[] {
    const id = escapeString(integrationId)
    const toolName = tool.name
    return specs.map(spec => {
        const paramsType = attioMethodParamsTypeName(spec.methodName)
        const requestExpr = spec.action ? `{ action: "${spec.action}", ...params }` : "params"
        const { resultType, thenExpr } = attioResultParts(toolName, spec.result)
        return {
            description: spec.action ? attioActionDescription(toolName, spec.action) : tool.description || undefined,
            generatedSignature: `${spec.methodName}(${spec.emptyParams ? `params?: ${paramsType}` : `params: ${paramsType}`}): Promise<${resultType}>`,
            runtimeLines: [
                `${spec.methodName}: (params: ${paramsType}${spec.emptyParams ? " = {}" : ""}) =>`,
                `    TerseAgent.executeTool<${attioOutputTypeName(toolName)}>("${toolName}", { integrationId: "${id}", request: ${requestExpr} })${thenExpr},`
            ]
        }
    })
}

function buildAttioListsMethods(integrationId: string, tool: ToolDefinition): ToolMethodContext[] {
    const id = escapeString(integrationId)
    const toolName = tool.name
    const call = (requestExpr: string) => `TerseAgent.executeTool<${attioOutputTypeName(toolName)}>("${toolName}", { integrationId: "${id}", request: ${requestExpr} })`
    const listKey = "listIdOrSlug: __normalizeAttioObjectSlug(params.list)"
    const listParam = "list: GeneratedAttioList | string"

    switch (toolName) {
        case "attio_read_lists":
            return [
                {
                    description: attioActionDescription(toolName, "list"),
                    generatedSignature: 'listLists(): Promise<{ lists: NonNullable<AttioListsResult["lists"]>; count: number }>',
                    runtimeLines: ["listLists: () =>", `    ${call('{ action: "list" }')}.then(result => ({ lists: result.lists ?? [], count: (result.lists ?? []).length })),`]
                },
                {
                    description: attioActionDescription(toolName, "get"),
                    generatedSignature: `getList(params: { ${listParam} }): Promise<NonNullable<AttioListsResult["list"]>>`,
                    runtimeLines: [`getList: (params: { ${listParam} }) =>`, `    ${call(`{ action: "get", ${listKey} }`)}.then(result => __requireAttioPayload(result.list, "list")),`]
                }
            ]
        case "attio_create_list":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: `createList(params: ${attioMethodParamsTypeName("createList")}): Promise<NonNullable<AttioListsResult["list"]>>`,
                    runtimeLines: [`createList: (params: ${attioMethodParamsTypeName("createList")}) =>`, `    ${call("params")}.then(result => __requireAttioPayload(result.list, "list")),`]
                }
            ]
        case "attio_update_list":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: `updateList(params: { ${listParam}; name: string }): Promise<NonNullable<AttioListsResult["list"]>>`,
                    runtimeLines: [
                        `updateList: (params: { ${listParam}; name: string }) =>`,
                        `    ${call(`{ ${listKey}, name: params.name }`)}.then(result => __requireAttioPayload(result.list, "list")),`
                    ]
                }
            ]
        case "attio_read_list_entries":
            return [
                {
                    description: attioActionDescription(toolName, "query_entries"),
                    generatedSignature:
                        "queryListEntries<TList extends GeneratedAttioList | string>(params: { list: TList; filter?: AttioEntryFilterFor<TList> | null; parentRecordId?: string | null; parentObjectSlug?: string; limit?: number | null; offset?: number | null }): Promise<AttioListEntriesResult<TList>>",
                    runtimeLines: [
                        "queryListEntries: <TList extends GeneratedAttioList | string>(params: { list: TList; filter?: AttioEntryFilterFor<TList> | null; parentRecordId?: string | null; parentObjectSlug?: string; limit?: number | null; offset?: number | null }) =>",
                        `    ${call(
                            '{ action: "query_entries", listIdOrSlug: __normalizeAttioObjectSlug(params.list), filter: __serializeAttioFilter(params.filter), parentRecordId: params.parentRecordId ?? null, parentObjectSlug: params.parentRecordId ? __requireAttioListParentObject(params.list, params.parentObjectSlug) : null, limit: params.limit ?? null, offset: params.offset ?? null }'
                        )}.then(result => __enhanceAttioListEntriesResult(params.list, result)),`
                    ]
                },
                {
                    description: attioActionDescription(toolName, "get_entry"),
                    generatedSignature: "getListEntry<TList extends GeneratedAttioList | string>(params: { list: TList; entryId: string }): Promise<AttioListEntryResult<TList>>",
                    runtimeLines: [
                        "getListEntry: <TList extends GeneratedAttioList | string>(params: { list: TList; entryId: string }) =>",
                        `    ${call('{ action: "get_entry", listIdOrSlug: __normalizeAttioObjectSlug(params.list), entryId: params.entryId }')}.then(result => __enhanceAttioListEntryResult(params.list, result)),`
                    ]
                }
            ]
        case "attio_add_list_entry":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature:
                        "addListEntry<TList extends GeneratedAttioList | string>(params: { list: TList; parentRecordId: string; parentObjectSlug?: string; entryValues?: AttioEntryValuesFor<TList> | null }): Promise<AttioListEntryResult<TList>>",
                    runtimeLines: [
                        "addListEntry: <TList extends GeneratedAttioList | string>(params: { list: TList; parentRecordId: string; parentObjectSlug?: string; entryValues?: AttioEntryValuesFor<TList> | null }) =>",
                        `    ${call(
                            "{ listIdOrSlug: __normalizeAttioObjectSlug(params.list), parentObjectSlug: __requireAttioListParentObject(params.list, params.parentObjectSlug), parentRecordId: params.parentRecordId, entryValues: __serializeAttioValues(params.entryValues) }"
                        )}.then(result => __enhanceAttioListEntryResult(params.list, result)),`
                    ]
                }
            ]
        case "attio_upsert_list_entry":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature:
                        "upsertListEntry<TList extends GeneratedAttioList | string>(params: { list: TList; parentRecordId: string; parentObjectSlug?: string; entryValues?: AttioEntryValuesFor<TList> | null }): Promise<AttioListEntryResult<TList>>",
                    runtimeLines: [
                        "upsertListEntry: <TList extends GeneratedAttioList | string>(params: { list: TList; parentRecordId: string; parentObjectSlug?: string; entryValues?: AttioEntryValuesFor<TList> | null }) =>",
                        `    ${call(
                            "{ listIdOrSlug: __normalizeAttioObjectSlug(params.list), parentObjectSlug: __requireAttioListParentObject(params.list, params.parentObjectSlug), parentRecordId: params.parentRecordId, entryValues: __serializeAttioValues(params.entryValues) }"
                        )}.then(result => __enhanceAttioListEntryResult(params.list, result)),`
                    ]
                }
            ]
        case "attio_update_list_entry":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature:
                        'updateListEntry<TList extends GeneratedAttioList | string>(params: { list: TList; entryId: string; entryValues: Partial<AttioEntryValuesFor<TList>>; multiselectMode?: "overwrite" | "append" | null }): Promise<AttioListEntryResult<TList>>',
                    runtimeLines: [
                        'updateListEntry: <TList extends GeneratedAttioList | string>(params: { list: TList; entryId: string; entryValues: Partial<AttioEntryValuesFor<TList>>; multiselectMode?: "overwrite" | "append" | null }) =>',
                        `    ${call(
                            "{ listIdOrSlug: __normalizeAttioObjectSlug(params.list), entryId: params.entryId, entryValues: __serializeAttioValues(params.entryValues), multiselectMode: params.multiselectMode ?? null }"
                        )}.then(result => __enhanceAttioListEntryResult(params.list, result)),`
                    ]
                }
            ]
        case "attio_remove_list_entry":
            return [
                {
                    description: tool.description || undefined,
                    generatedSignature: `removeListEntry(params: { ${listParam}; entryId: string }): Promise<void>`,
                    runtimeLines: [
                        `removeListEntry: (params: { ${listParam}; entryId: string }) =>`,
                        `    ${call("{ listIdOrSlug: __normalizeAttioObjectSlug(params.list), entryId: params.entryId }")}.then(() => undefined),`
                    ]
                }
            ]
        default:
            return []
    }
}
