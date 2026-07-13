import {
    ToolDefinitions,
    type ToolName,
    attioAttributeHistoryEntrySchema,
    attioAttributeSchema,
    attioCallRecordingSchema,
    attioCommentSchema,
    attioFileSchema,
    attioListEntrySchema,
    attioListSchema,
    attioMeetingSchema,
    attioNoteSchema,
    attioObjectSchema,
    attioObjectWithAttributesSchema,
    attioRecordSchema,
    attioSearchMatchSchema,
    attioSelectOptionEntitySchema,
    attioStatusSchema,
    attioTaskSchema,
    attioThreadSchema,
    attioTranscriptSchema,
    attioWorkspaceMemberSchema,
    runHistoryActionBaseSchema
} from "terse-types"
import { z } from "zod"

import type { AttioAttributeData } from "../codegenTypes.js"

import { type HoistedShape, printType } from "./typePrinter.js"

export async function buildAttioValueTypeDeclarations(): Promise<string[]> {
    const declarations = await Promise.all([
        printType({ typeName: "AttioSelectOption", schema: attioSelectOptionValueSchema, io: "output" }),
        printType({ typeName: "AttioActorReferenceInput", schema: attioActorReferenceInputSchema, io: "input" }),
        printType({ typeName: "AttioRecordReferenceInput", schema: attioRecordReferenceInputSchema, io: "input" }),
        printType({ typeName: "AttioActorReference", schema: attioActorReferenceSchema, io: "output" }),
        printType({ typeName: "AttioRecordReferenceValue", schema: attioRecordReferenceValueSchema, io: "output" }),
        printType({ typeName: "AttioCurrencyValue", schema: attioCurrencyValueSchema, io: "output" })
    ])
    return declarations.flatMap(declaration => [declaration, ""])
}

export async function buildAttioObjectTypeDeclarations(objects: readonly AttioValueTypeSource[], lists: readonly AttioValueTypeSource[]): Promise<string[]> {
    const printed = await Promise.all([
        ...objects.flatMap(object => {
            const names = attioObjectValueTypeNames(object.staticName)
            return [
                printType({ typeName: names.record, schema: buildAttioValuesSchema(object.attributes, "record"), io: "output", hoisted: RECORD_VALUE_HOISTS, declareAs: "alias" }),
                printType({ typeName: names.input, schema: buildAttioValuesSchema(object.attributes, "input"), io: "input", hoisted: INPUT_VALUE_HOISTS, declareAs: "alias" })
            ]
        }),
        ...lists.flatMap(list => {
            const names = attioListValueTypeNames(list.staticName)
            return [
                printType({ typeName: names.entryRecord, schema: buildAttioValuesSchema(list.attributes, "record"), io: "output", hoisted: RECORD_VALUE_HOISTS, declareAs: "alias" }),
                printType({ typeName: names.entry, schema: buildAttioValuesSchema(list.attributes, "input"), io: "input", hoisted: INPUT_VALUE_HOISTS, declareAs: "alias" })
            ]
        })
    ])
    return printed.flatMap(declaration => [declaration, ""])
}

export function attioObjectValueTypeNames(staticName: string): { record: string; input: string } {
    return { record: `Attio${staticName}RecordValues`, input: `Attio${staticName}InputValues` }
}

export function attioListValueTypeNames(staticName: string): { entry: string; entryRecord: string } {
    return { entry: `Attio${staticName}EntryValues`, entryRecord: `Attio${staticName}EntryRecordValues` }
}

export function buildAttioRecordTriggerAliases(objects: readonly AttioValueTypeSource[]): string[] {
    return objects.flatMap(object => {
        const values = attioObjectValueTypeNames(object.staticName).record
        return ATTIO_RECORD_TRIGGER_EVENTS.flatMap(event => [
            `export type Attio${object.staticName}Record${event}Payload = AttioRecord${event}TriggerPayload<${values}>`,
            `export type Attio${object.staticName}Record${event}Trigger = AttioRecord${event}Trigger<${values}>`
        ])
    })
}

export async function buildAttioToolTypeDeclarations(attioToolNames: readonly string[]): Promise<string[]> {
    if (attioToolNames.length === 0) return []
    const declarations: string[] = []

    for (const entity of ATTIO_ENTITY_HOISTS) {
        const otherEntities = ATTIO_ENTITY_HOISTS.filter(other => other.name !== entity.name)
        const printSchema = ATTIO_ENTITY_PRINT_OVERRIDES[entity.name] ?? entity.schema
        declarations.push(await printType({ typeName: entity.name, schema: printSchema, io: "output", hoisted: otherEntities }), "")
    }

    const printedOutputNames = new Set<string>()
    for (const toolName of attioToolNames) {
        if (!isKnownToolName(toolName)) continue
        const outputName = attioOutputTypeName(toolName)
        if (printedOutputNames.has(outputName)) continue
        printedOutputNames.add(outputName)
        declarations.push(await printType({ typeName: outputName, schema: ToolDefinitions[toolName].outputSchema, io: "output", hoisted: ATTIO_OUTPUT_HOISTS }), "")
    }

    for (const toolName of attioToolNames) {
        const sources = ATTIO_METHOD_PARAM_SOURCES[toolName]
        if (!sources || !isKnownToolName(toolName)) continue
        for (const source of sources) {
            const schema = attioMethodParamsSchema(toolName, source.action)
            declarations.push(await printType({ typeName: attioMethodParamsTypeName(source.methodName), schema, io: "input" }), "")
        }
    }

    return declarations
}

export function attioOutputTypeName(toolName: string): string {
    const familyName = ATTIO_OUTPUT_TYPE_NAMES[toolName]
    if (!familyName) throw new AttioProjectionError(`No projected output type registered for tool ${toolName}`)
    return familyName
}

export function attioMethodParamsTypeName(methodName: string): string {
    return `Attio${methodName.charAt(0).toUpperCase()}${methodName.slice(1)}Params`
}

export class AttioProjectionError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "AttioProjectionError"
    }
}

function attioMethodParamsSchema(toolName: ToolName, action: string | undefined): z.ZodType {
    const request = attioRequestSchema(toolName)
    if (!action) {
        if (!(request instanceof z.ZodObject)) throw new AttioProjectionError(`Tool ${toolName} request is not a plain object schema`)
        return request
    }
    if (!(request instanceof z.ZodUnion)) throw new AttioProjectionError(`Tool ${toolName} request is not an action union`)
    const options: readonly unknown[] = request.options
    for (const option of options) {
        if (!(option instanceof z.ZodObject)) continue
        const discriminant: unknown = option.shape.action
        if (discriminant instanceof z.ZodLiteral && discriminant.value === action) {
            return option.omit({ action: true })
        }
    }
    throw new AttioProjectionError(`Tool ${toolName} has no request branch for action "${action}"`)
}

function attioRequestSchema(toolName: ToolName): unknown {
    const inputSchema: z.ZodType = ToolDefinitions[toolName].inputSchema
    if (!(inputSchema instanceof z.ZodObject)) throw new AttioProjectionError(`Tool ${toolName} input is not an object schema`)
    const request: unknown = inputSchema.shape.request
    if (!request) throw new AttioProjectionError(`Tool ${toolName} input has no request field`)
    return request
}

function isKnownToolName(name: string): name is ToolName {
    return name in ToolDefinitions
}

export function buildAttioValuesSchema(attributes: readonly AttioAttributeData[], mode: AttioValueMode): z.ZodType {
    const named = attributes.filter(attr => !!attr.api_slug)
    if (named.length === 0) return z.record(z.string(), z.unknown())
    const shape: Record<string, z.ZodType> = {}
    for (const attr of named) {
        shape[attr.api_slug ?? ""] = attioAttributeValueSchema(attr, mode).optional()
    }
    return z.object(shape)
}

export function attioIsMultiValue(attr: AttioAttributeData): boolean {
    if (typeof attr.is_multiselect === "boolean") return attr.is_multiselect
    return isProbablyAttioMultiValue(attr)
}

function attioAttributeValueSchema(attr: AttioAttributeData, mode: AttioValueMode): z.ZodType {
    const base = mode === "input" ? attioAttributeInputBaseSchema(attr) : attioAttributeRecordBaseSchema(attr)
    return attioIsMultiValue(attr) ? z.array(base) : base
}

function attioAttributeInputBaseSchema(attr: AttioAttributeData): z.ZodType {
    const type = (attr.type || "").toLowerCase()

    if (type.includes("actor")) return attioActorReferenceInputSchema
    if (type.includes("record") && type.includes("reference")) return attioRecordReferenceInputSchema
    if ((type.includes("select") || type.includes("status")) && attr.options && attr.options.length > 0) {
        return z.enum(attr.options)
    }
    return attioAttributeBaseSchema(attr)
}

function attioAttributeRecordBaseSchema(attr: AttioAttributeData): z.ZodType {
    const type = (attr.type || "").toLowerCase()

    if (type.includes("select") || type.includes("status")) return attioSelectOptionValueSchema
    if (type.includes("actor")) return attioActorReferenceSchema
    if (type.includes("record") && type.includes("reference")) return attioRecordReferenceValueSchema
    if (type.includes("currency")) return attioCurrencyValueSchema
    return attioAttributeBaseSchema(attr)
}

function attioAttributeBaseSchema(attr: AttioAttributeData): z.ZodType {
    const slug = (attr.api_slug || "").toLowerCase()
    const type = (attr.type || "").toLowerCase()

    if (type.includes("checkbox") || type.includes("boolean")) return z.boolean()
    if (type.includes("number") || type.includes("currency") || type.includes("rating") || type.includes("percent")) {
        return z.number()
    }
    if (type.includes("date") || type.includes("time")) return z.string()
    if (
        type.includes("email") ||
        type.includes("domain") ||
        type.includes("phone") ||
        type.includes("url") ||
        type.includes("select") ||
        type.includes("status") ||
        type.includes("text") ||
        type.includes("string") ||
        type.includes("name")
    ) {
        return z.string()
    }
    if (type.includes("location") || type.includes("address") || type.includes("reference") || type.includes("record") || type.includes("actor")) {
        return z.record(z.string(), z.unknown())
    }
    if (slug === "email_addresses" || slug === "domains" || slug === "phone_numbers" || slug === "name") {
        return z.string()
    }
    return z.unknown()
}

function isProbablyAttioMultiValue(attr: AttioAttributeData): boolean {
    const slug = (attr.api_slug || "").toLowerCase()
    const type = (attr.type || "").toLowerCase()

    return (
        type.includes("multi") ||
        type.includes("array") ||
        type.includes("list") ||
        slug === "email_addresses" ||
        slug === "domains" ||
        slug === "phone_numbers" ||
        slug === "social_profiles" ||
        slug === "links" ||
        slug === "tags" ||
        slug.endsWith("_addresses") ||
        slug.endsWith("_ids")
    )
}

const attioSelectOptionValueSchema = z.object({ id: z.string(), title: z.string(), is_archived: z.boolean() })
const attioActorReferenceSchema = z.object({ referenced_actor_type: z.string(), referenced_actor_id: z.string().nullable() })
const attioRecordReferenceValueSchema = z.object({ target_object: z.string(), target_record_id: z.string() })
const attioCurrencyValueSchema = z.object({ currency_value: z.number(), currency_code: z.string().nullable() })
const attioActorReferenceInputSchema = z.union([
    z.string(),
    z.object({ workspace_member_email_address: z.string() }),
    z.object({ referenced_actor_type: z.literal("workspace-member"), referenced_actor_id: z.string() })
])
const attioRecordReferenceInputSchema = z.union([z.object({ target_object: z.string(), target_record_id: z.string() }), z.record(z.string(), z.unknown())])

const RECORD_VALUE_HOISTS: HoistedShape[] = [
    { name: "AttioSelectOption", schema: attioSelectOptionValueSchema },
    { name: "AttioActorReference", schema: attioActorReferenceSchema },
    { name: "AttioRecordReferenceValue", schema: attioRecordReferenceValueSchema },
    { name: "AttioCurrencyValue", schema: attioCurrencyValueSchema }
]

const INPUT_VALUE_HOISTS: HoistedShape[] = [
    { name: "AttioActorReferenceInput", schema: attioActorReferenceInputSchema },
    { name: "AttioRecordReferenceInput", schema: attioRecordReferenceInputSchema }
]

const ATTIO_RECORD_TRIGGER_EVENTS = ["Created", "Updated", "Merged"] as const

const ATTIO_ENTITY_HOISTS: HoistedShape[] = [
    { name: "AttioRecordBase", schema: attioRecordSchema },
    { name: "AttioSearchMatch", schema: attioSearchMatchSchema },
    { name: "AttioAttributeHistoryEntry", schema: attioAttributeHistoryEntrySchema },
    { name: "AttioTask", schema: attioTaskSchema },
    { name: "AttioNote", schema: attioNoteSchema },
    { name: "AttioComment", schema: attioCommentSchema },
    { name: "AttioThread", schema: attioThreadSchema },
    { name: "AttioMeeting", schema: attioMeetingSchema },
    { name: "AttioCallRecording", schema: attioCallRecordingSchema },
    { name: "AttioTranscript", schema: attioTranscriptSchema },
    { name: "AttioFile", schema: attioFileSchema },
    { name: "AttioObjectSummary", schema: attioObjectSchema },
    { name: "AttioObjectInfo", schema: attioObjectWithAttributesSchema },
    { name: "AttioAttributeInfo", schema: attioAttributeSchema },
    { name: "AttioStatusEntity", schema: attioStatusSchema },
    { name: "AttioSelectOptionEntity", schema: attioSelectOptionEntitySchema },
    { name: "AttioWorkspaceMember", schema: attioWorkspaceMemberSchema },
    { name: "AttioListInfo", schema: attioListSchema },
    { name: "AttioListEntryInfo", schema: attioListEntrySchema }
]

const ATTIO_OUTPUT_HOISTS: HoistedShape[] = [...ATTIO_ENTITY_HOISTS, { name: "RunHistoryAction", schema: runHistoryActionBaseSchema }]

// AttioRecordBase feeds `Omit<AttioRecordBase, "values">` in the generic record machinery, and Omit over
// a type with an index signature collapses every named property; print it without the schema's catchall.
const ATTIO_ENTITY_PRINT_OVERRIDES: Record<string, z.ZodType> = {
    AttioRecordBase: z.object({
        id: z.object({ workspace_id: z.string().optional(), object_id: z.string().optional(), record_id: z.string().optional() }).optional(),
        record_id: z.string().optional(),
        values: z.record(z.string(), z.unknown()).optional(),
        web_url: z.string().optional(),
        created_at: z.string().optional()
    })
}

const ATTIO_OUTPUT_TYPE_NAMES: Record<string, string> = {
    attio_read_records: "AttioRecordsResult",
    attio_create_record: "AttioRecordsResult",
    attio_update_record: "AttioRecordsResult",
    attio_upsert_record: "AttioRecordsResult",
    attio_delete_record: "AttioRecordsResult",
    attio_read_lists: "AttioListsResult",
    attio_create_list: "AttioListsResult",
    attio_update_list: "AttioListsResult",
    attio_read_list_entries: "AttioListsResult",
    attio_add_list_entry: "AttioListsResult",
    attio_upsert_list_entry: "AttioListsResult",
    attio_update_list_entry: "AttioListsResult",
    attio_remove_list_entry: "AttioListsResult",
    attio_read_tasks: "AttioTasksOutput",
    attio_create_task: "AttioTasksOutput",
    attio_update_task: "AttioTasksOutput",
    attio_delete_task: "AttioTasksOutput",
    attio_read_notes: "AttioNotesOutput",
    attio_create_note: "AttioNotesOutput",
    attio_delete_note: "AttioNotesOutput",
    attio_read_comments: "AttioCommentsOutput",
    attio_create_comment: "AttioCommentsOutput",
    attio_delete_comment: "AttioCommentsOutput",
    attio_meetings: "AttioMeetingsOutput",
    attio_read_files: "AttioFilesOutput",
    attio_upload_file: "AttioFilesOutput",
    attio_delete_file: "AttioFilesOutput",
    attio_read_schema: "AttioSchemaOutput",
    attio_modify_schema: "AttioSchemaOutput",
    attio_workspace_members: "AttioWorkspaceMembersResult"
}

export const ATTIO_RESOURCE_METHOD_SPECS: Record<string, AttioResourceMethodSpec[]> = {
    attio_workspace_members: [
        { action: "list", methodName: "listWorkspaceMembers", emptyParams: true, result: { kind: "list", key: "members" } },
        { action: "get", methodName: "getWorkspaceMember", result: { kind: "single", key: "member", what: "workspace member" } }
    ],
    attio_read_tasks: [
        { action: "list", methodName: "listTasks", emptyParams: true, result: { kind: "list", key: "tasks" } },
        { action: "get", methodName: "getTask", result: { kind: "single", key: "task" } }
    ],
    attio_create_task: [{ methodName: "createTask", result: { kind: "single", key: "task" } }],
    attio_update_task: [{ methodName: "updateTask", result: { kind: "single", key: "task" } }],
    attio_delete_task: [{ methodName: "deleteTask", result: { kind: "void" } }],
    attio_read_notes: [
        { action: "list", methodName: "listNotes", emptyParams: true, result: { kind: "list", key: "notes" } },
        { action: "get", methodName: "getNote", result: { kind: "single", key: "note" } }
    ],
    attio_create_note: [{ methodName: "createNote", result: { kind: "single", key: "note" } }],
    attio_delete_note: [{ methodName: "deleteNote", result: { kind: "void" } }],
    attio_read_comments: [
        { action: "get", methodName: "getComment", result: { kind: "single", key: "comment" } },
        { action: "list_threads", methodName: "listThreads", emptyParams: true, result: { kind: "list", key: "threads" } },
        { action: "get_thread", methodName: "getThread", result: { kind: "single", key: "thread" } }
    ],
    attio_create_comment: [{ methodName: "createComment", result: { kind: "single", key: "comment" } }],
    attio_delete_comment: [{ methodName: "deleteComment", result: { kind: "void" } }],
    attio_meetings: [
        { action: "list", methodName: "listMeetings", emptyParams: true, result: { kind: "list", key: "meetings", cursor: true } },
        { action: "get", methodName: "getMeeting", result: { kind: "single", key: "meeting" } },
        { action: "list_recordings", methodName: "listCallRecordings", result: { kind: "list", key: "recordings", cursor: true } },
        { action: "get_transcript", methodName: "getCallTranscript", result: { kind: "singleWithCursor", key: "transcript" } }
    ],
    attio_read_files: [
        { action: "list", methodName: "listFiles", result: { kind: "list", key: "files", cursor: true } },
        { action: "get", methodName: "getFile", result: { kind: "single", key: "file" } },
        { action: "get_download_url", methodName: "getFileDownloadUrl", result: { kind: "single", key: "downloadUrl", what: "download URL" } }
    ],
    attio_upload_file: [{ methodName: "uploadFile", result: { kind: "single", key: "file" } }],
    attio_delete_file: [{ methodName: "deleteFile", result: { kind: "void" } }],
    attio_read_schema: [
        { action: "list_objects", methodName: "listObjects", emptyParams: true, result: { kind: "list", key: "objects" } },
        { action: "get_object", methodName: "getObject", result: { kind: "single", key: "object" } },
        { action: "list_attributes", methodName: "listAttributes", result: { kind: "list", key: "attributes" } },
        { action: "list_statuses", methodName: "listStatuses", result: { kind: "list", key: "statuses" } },
        { action: "list_select_options", methodName: "listSelectOptions", result: { kind: "list", key: "selectOptions" } }
    ],
    attio_modify_schema: [
        { action: "create_object", methodName: "createObject", result: { kind: "single", key: "object" } },
        { action: "update_object", methodName: "updateObject", result: { kind: "single", key: "object" } },
        { action: "create_attribute", methodName: "createAttribute", result: { kind: "single", key: "attribute" } },
        { action: "update_attribute", methodName: "updateAttribute", result: { kind: "single", key: "attribute" } },
        { action: "create_status", methodName: "createStatus", result: { kind: "single", key: "status" } },
        { action: "update_status", methodName: "updateStatus", result: { kind: "single", key: "status" } },
        { action: "create_select_option", methodName: "createSelectOption", result: { kind: "single", key: "selectOption" } },
        { action: "update_select_option", methodName: "updateSelectOption", result: { kind: "single", key: "selectOption" } }
    ]
}

const ATTIO_METHOD_PARAM_SOURCES: Record<string, Array<{ methodName: string; action?: string }>> = {
    ...Object.fromEntries(Object.entries(ATTIO_RESOURCE_METHOD_SPECS).map(([toolName, specs]) => [toolName, specs.map(spec => ({ methodName: spec.methodName, action: spec.action }))])),
    attio_create_list: [{ methodName: "createList" }]
}

export type AttioValueMode = "input" | "record"

export type AttioResultSpec =
    | { kind: "single"; key: string; what?: string }
    | { kind: "singleWithCursor"; key: string; what?: string }
    | { kind: "list"; key: string; cursor?: boolean }
    | { kind: "void" }

export interface AttioResourceMethodSpec {
    /** Discriminant to inject into the request; omitted for single-op tools with flat request schemas. */
    action?: string
    methodName: string
    emptyParams?: boolean
    result: AttioResultSpec
}

export type AttioValueTypeSource = {
    readonly staticName: string
    readonly attributes: readonly AttioAttributeData[]
}
