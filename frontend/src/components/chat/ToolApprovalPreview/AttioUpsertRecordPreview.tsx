import { useMemo } from "react"

import { ArrowRight } from "lucide-react"

interface AttioUpsertRecordParams {
    integrationId?: string
    objectSlug?: string
    matchingAttribute?: string
    records?: string
    values?: string
}

interface AttioUpsertRecordPreviewProps {
    parameters: string
}

export default function AttioUpsertRecordPreview({ parameters }: AttioUpsertRecordPreviewProps) {
    const parsed = useMemo<AttioUpsertRecordParams | null>(() => {
        try {
            return JSON.parse(parameters)
        } catch {
            return null
        }
    }, [parameters])

    if (!parsed) return null

    const { objectSlug, matchingAttribute, records, values } = parsed

    let parsedRecords: Array<Record<string, unknown>> = []
    if (records) {
        try {
            const parsedBatch = JSON.parse(records) as unknown
            if (Array.isArray(parsedBatch)) {
                parsedRecords = parsedBatch.filter(isRecordLike)
            }
        } catch {
            // records might not be valid JSON
        }
    }

    if (parsedRecords.length === 0 && values) {
        try {
            const parsedValues = JSON.parse(values) as unknown
            if (isRecordLike(parsedValues)) {
                parsedRecords = [parsedValues]
            }
        } catch {
            // values might not be valid JSON
        }
    }

    const recordCount = parsedRecords.length
    const hasMultipleRecords = recordCount > 1
    const isUpsert = parsedRecords.some(record => !!matchingAttribute && matchingAttribute in record)

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-foreground capitalize">{objectSlug || "Record"}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">{isUpsert ? "Create or update" : "Create"}</span>
            </div>

            {matchingAttribute && (
                <div className="text-xs text-muted-foreground">
                    Match on <span className="font-mono text-foreground">{matchingAttribute}</span>
                </div>
            )}

            {recordCount > 0 && (
                <div className="space-y-2">
                    {hasMultipleRecords && <div className="text-xs text-muted-foreground">{recordCount} records will be upserted</div>}

                    {parsedRecords.map((record, index) => {
                        const entries = Object.entries(record)
                        const shouldCollapse = hasMultipleRecords && index > 2
                        if (shouldCollapse) return null

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
                                                    <ValueDisplay value={value} />
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
        </div>
    )
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
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
