import type { AttioAttribute } from "@/shared/types"

export interface AttioUpsertRecordParams {
    integrationId?: string
    objectSlug?: string
    matchingAttribute?: string
    records?: string
    values?: string
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

export function safeParseParams(parameters?: string): AttioUpsertRecordParams | null {
    if (!parameters) return null

    try {
        return JSON.parse(parameters) as AttioUpsertRecordParams
    } catch {
        return null
    }
}

export function extractRecords(parameters: AttioUpsertRecordParams | null): Array<Record<string, unknown>> {
    if (!parameters) return []

    const parsedRecords: Array<Record<string, unknown>> = []

    if (parameters.records) {
        try {
            const batch = JSON.parse(parameters.records) as unknown
            if (Array.isArray(batch)) {
                parsedRecords.push(...batch.filter(isRecordLike))
            }
        } catch {
            return []
        }
    }

    if (parsedRecords.length === 0 && parameters.values) {
        try {
            const value = JSON.parse(parameters.values) as unknown
            if (isRecordLike(value)) {
                parsedRecords.push(value)
            }
        } catch {
            return []
        }
    }

    return parsedRecords
}

export function buildEditedArguments(parameters: AttioUpsertRecordParams, records: Array<Record<string, unknown>>): string {
    return JSON.stringify({
        ...parameters,
        records: JSON.stringify(records)
    })
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

export function areRecordsEqual(a: Array<Record<string, unknown>>, b: Array<Record<string, unknown>>): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

export function valueToEditString(value: unknown): string {
    if (Array.isArray(value)) return value.map(String).join(", ")
    if (typeof value === "object" && value !== null) return JSON.stringify(value)
    return String(value ?? "")
}

export function coerceEditedValue(originalValue: unknown, rawValue: string): unknown {
    const trimmedValue = rawValue.trim()

    if (Array.isArray(originalValue)) {
        return trimmedValue.length === 0
            ? []
            : rawValue
                  .split(",")
                  .map(item => item.trim())
                  .filter(Boolean)
    }

    if (typeof originalValue === "number") {
        const numericValue = Number(trimmedValue)
        return Number.isNaN(numericValue) ? rawValue : numericValue
    }

    if (typeof originalValue === "boolean") {
        if (trimmedValue.toLowerCase() === "true") return true
        if (trimmedValue.toLowerCase() === "false") return false
        return rawValue
    }

    if (typeof originalValue === "object" && originalValue !== null) {
        try {
            return trimmedValue.length === 0 ? null : JSON.parse(rawValue)
        } catch {
            return rawValue
        }
    }

    return rawValue
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
