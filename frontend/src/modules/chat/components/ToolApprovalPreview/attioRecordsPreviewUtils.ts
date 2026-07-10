import type { AttioRecordsRequest } from "terse-types"
import type { AttioAttribute } from "terse-types/types"

export function safeParseParams(parameters?: string): AttioRecordsParams | null {
    if (!parameters) return null

    try {
        const parsed = JSON.parse(parameters) as AttioRecordsParams
        return parsed && typeof parsed === "object" ? parsed : null
    } catch {
        return null
    }
}

export function extractRecords(request?: AttioRecordsRequest): Array<Record<string, unknown>> {
    switch (request?.action) {
        case "upsert":
            return parseRecordsBatch(request.records)
        case "create":
        case "update":
            return parseSingleValues(request.values)
        default:
            return []
    }
}

export function writeActionLabel(action: "create" | "update" | "upsert"): string {
    switch (action) {
        case "create":
            return "Create"
        case "update":
            return "Update"
        case "upsert":
            return "Create or update"
    }
}

export function buildEditorColumns(records: Array<Record<string, unknown>>, attributes?: AttioAttribute[], matchingAttribute?: string): AttioEditorColumn[] {
    return buildColumnOrder(records, attributes, matchingAttribute).map(column => {
        const attribute = attributes?.find(item => item.api_slug === column)
        const label = attribute?.title || column
        const suffixParts = [column === matchingAttribute ? "match" : null, attribute?.is_required ? "required" : null].filter(Boolean)
        const title = suffixParts.length > 0 ? `${label} (${suffixParts.join(", ")})` : label
        const hasLongContent = records.some(record => {
            const value = valueToEditString(record[column])
            return value.includes("\n") || value.length > 60
        })

        return {
            key: column,
            title,
            width: Math.max(180, Math.min(320, label.length * 12 + 80)),
            multiline: hasLongContent
        }
    })
}

export function buildValidationNotices(records: Array<Record<string, unknown>>, attributes?: AttioAttribute[], matchingAttribute?: string): ValidationNotice[] {
    const notices: ValidationNotice[] = []
    const requiredAttributes = (attributes ?? []).filter(attribute => attribute.is_required && attribute.api_slug)

    records.forEach((record, rowIndex) => {
        if (matchingAttribute && isEmptyValue(record[matchingAttribute])) {
            notices.push({
                rowIndex,
                field: matchingAttribute,
                message: `"${matchingAttribute}" is empty. Attio upsert matching may fail.`
            })
        }

        requiredAttributes.forEach(attribute => {
            const field = attribute.api_slug!
            if (isEmptyValue(record[field])) {
                notices.push({
                    rowIndex,
                    field,
                    message: `${attribute.title || field} is required but empty.`
                })
            }
        })
    })

    return notices
}

export function valueToEditString(value: unknown): string {
    if (Array.isArray(value)) return value.map(String).join(", ")
    if (typeof value === "object" && value !== null) return JSON.stringify(value)
    return String(value ?? "")
}

function parseRecordsBatch(records: string): Array<Record<string, unknown>> {
    try {
        const batch = JSON.parse(records) as unknown
        return Array.isArray(batch) ? batch.filter(isRecordLike) : []
    } catch {
        return []
    }
}

function parseSingleValues(values: string): Array<Record<string, unknown>> {
    try {
        const value = JSON.parse(values) as unknown
        return isRecordLike(value) ? [value] : []
    } catch {
        return []
    }
}

function buildColumnOrder(records: Array<Record<string, unknown>>, attributes?: AttioAttribute[], matchingAttribute?: string): string[] {
    const ordered = new Set<string>()

    if (matchingAttribute) {
        ordered.add(matchingAttribute)
    }

    for (const record of records) {
        for (const key of Object.keys(record)) {
            ordered.add(key)
        }
    }

    for (const attribute of attributes ?? []) {
        if (attribute.is_required && attribute.api_slug) {
            ordered.add(attribute.api_slug)
        }
    }

    return Array.from(ordered)
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isEmptyValue(value: unknown): boolean {
    if (value === undefined || value === null) return true
    if (typeof value === "string") return value.trim().length === 0
    if (Array.isArray(value)) return value.length === 0 || value.every(item => String(item).trim().length === 0)
    return false
}

export interface AttioRecordsParams {
    integrationId?: string
    request?: AttioRecordsRequest
}

export type ValidationNotice = {
    rowIndex: number
    field: string
    message: string
}

export type AttioEditorColumn = {
    key: string
    title: string
    width?: number
    multiline?: boolean
}
