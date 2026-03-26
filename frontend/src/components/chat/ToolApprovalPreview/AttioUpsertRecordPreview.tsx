import { useState } from "react"

import { ArrowRight, Pencil, Send, X } from "lucide-react"

import { Button } from "../../ui/button"

import type { ToolPreviewProps } from "./index"

interface AttioUpsertRecordParams {
    integrationId?: string
    objectSlug?: string
    matchingAttribute?: string
    records?: string
    values?: string
}

export default function AttioUpsertRecordPreview({ parameters, onSendMessage }: ToolPreviewProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editedRecords, setEditedRecords] = useState<Array<Record<string, unknown>>>([])

    let parsed: AttioUpsertRecordParams | null = null
    try {
        parsed = JSON.parse(parameters)
    } catch {
        return null
    }
    if (!parsed) return null

    const { objectSlug, matchingAttribute, records, values } = parsed

    const parsedRecords: Array<Record<string, unknown>> = []
    if (records) {
        try {
            const batch = JSON.parse(records) as unknown
            if (Array.isArray(batch)) {
                parsedRecords.push(...batch.filter(isRecordLike))
            }
        } catch {}
    }
    if (parsedRecords.length === 0 && values) {
        try {
            const v = JSON.parse(values) as unknown
            if (isRecordLike(v)) parsedRecords.push(v)
        } catch {}
    }

    const startEditing = () => {
        setEditedRecords(structuredClone(parsedRecords))
        setIsEditing(true)
    }

    const cancelEditing = () => {
        setIsEditing(false)
        setEditedRecords([])
    }

    const updateValue = (recordIndex: number, key: string, newValue: string) => {
        const updated = structuredClone(editedRecords)
        const original = updated[recordIndex][key]

        if (Array.isArray(original)) {
            updated[recordIndex][key] = newValue
                .split(",")
                .map(s => s.trim())
                .filter(Boolean)
        } else if (typeof original === "number") {
            const num = Number(newValue)
            updated[recordIndex][key] = isNaN(num) ? newValue : num
        } else if (typeof original === "boolean") {
            updated[recordIndex][key] = newValue === "true"
        } else {
            updated[recordIndex][key] = newValue
        }

        setEditedRecords(updated)
    }

    const submitCorrection = () => {
        if (!onSendMessage) return

        const correctedValues = editedRecords.length === 1 ? JSON.stringify(editedRecords[0], null, 2) : JSON.stringify(editedRecords, null, 2)

        onSendMessage(
            `Retry the attio_upsert_record call now with these corrected values. Do not ask for confirmation, just execute the tool call immediately.\n\n` +
                `Object: ${objectSlug || "unknown"}\n` +
                `Matching attribute: ${matchingAttribute || "unknown"}\n` +
                `Values:\n\`\`\`json\n${correctedValues}\n\`\`\``
        )
        setIsEditing(false)
    }

    const displayRecords = isEditing ? editedRecords : parsedRecords
    const recordCount = displayRecords.length
    const hasMultipleRecords = recordCount > 1
    const isUpsert = parsedRecords.some(record => !!matchingAttribute && matchingAttribute in record)

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-foreground capitalize">{objectSlug || "Record"}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{isUpsert ? "Create or update" : "Create"}</span>
                </div>
                {!isEditing && onSendMessage && recordCount > 0 && (
                    <Button size="sm" variant="ghost" onClick={startEditing} className="h-6 px-2 text-xs text-muted-foreground">
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                    </Button>
                )}
            </div>

            {matchingAttribute && (
                <div className="text-xs text-muted-foreground">
                    Match on <span className="font-mono text-foreground">{matchingAttribute}</span>
                </div>
            )}

            {recordCount > 0 && (
                <div className="space-y-2">
                    {hasMultipleRecords && <div className="text-xs text-muted-foreground">{recordCount} records will be upserted</div>}

                    {displayRecords.map((record, index) => {
                        const entries = Object.entries(record)
                        if (hasMultipleRecords && index > 2) return null

                        return (
                            <div key={index} className="rounded-md border border-border overflow-hidden">
                                {hasMultipleRecords && <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/20 border-b border-border">Record {index + 1}</div>}
                                <table className="w-full text-sm">
                                    <tbody>
                                        {entries.map(([key, value]) => (
                                            <tr key={key} className="border-b border-border last:border-b-0">
                                                <td className="px-3 py-1.5 text-muted-foreground font-mono text-xs bg-muted/30 w-[40%] align-top">
                                                    {key}
                                                    {key === matchingAttribute && <span className="ml-1.5 text-[10px] text-warning font-sans">(match key)</span>}
                                                </td>
                                                <td className="px-3 py-1.5 text-foreground text-xs font-mono break-all">
                                                    {isEditing ? <EditableValue value={value} onChange={newValue => updateValue(index, key, newValue)} /> : <ValueDisplay value={value} />}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    })}

                    {hasMultipleRecords && recordCount > 3 && <div className="text-xs text-muted-foreground">Showing first 3 of {recordCount} records</div>}
                </div>
            )}

            {recordCount === 0 && <div className="text-xs text-muted-foreground">Unable to preview the record payload.</div>}

            {isEditing && (
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={submitCorrection}>
                        <Send className="w-3.5 h-3.5 mr-1" />
                        Submit Changes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                        <X className="w-3.5 h-3.5 mr-1" />
                        Cancel
                    </Button>
                </div>
            )}
        </div>
    )
}

// Helpers

function isRecordLike(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function valueToEditString(value: unknown): string {
    if (Array.isArray(value)) return value.map(String).join(", ")
    if (typeof value === "object" && value !== null) return JSON.stringify(value)
    return String(value ?? "")
}

function EditableValue({ value, onChange }: { value: unknown; onChange: (newValue: string) => void }) {
    return (
        <input
            type="text"
            defaultValue={valueToEditString(value)}
            onBlur={e => onChange(e.target.value)}
            className="w-full bg-background border border-border rounded px-1.5 py-0.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-accent-primary"
        />
    )
}

function ValueDisplay({ value }: { value: unknown }) {
    if (Array.isArray(value)) {
        return (
            <div className="flex flex-wrap gap-1">
                {value.map((item, i) => (
                    <span key={i} className="inline-block bg-muted px-1.5 py-0.5 rounded text-xs">
                        {String(item)}
                    </span>
                ))}
            </div>
        )
    }

    if (typeof value === "object" && value !== null) {
        return <span>{JSON.stringify(value)}</span>
    }

    return <span>{String(value)}</span>
}
