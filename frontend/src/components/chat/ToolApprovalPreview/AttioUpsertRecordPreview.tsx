import { useMemo } from "react"

import { ArrowRight } from "lucide-react"

interface AttioUpsertRecordParams {
    integrationId?: string
    objectSlug?: string
    matchingAttribute?: string
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

    const { objectSlug, matchingAttribute, values } = parsed

    let parsedValues: Record<string, unknown> = {}
    if (values) {
        try {
            parsedValues = JSON.parse(values)
        } catch {
            // values might not be valid JSON
        }
    }

    const entries = Object.entries(parsedValues)
    const isUpdate = !!matchingAttribute && entries.some(([key]) => key === matchingAttribute)

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-foreground capitalize">{objectSlug || "Record"}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">{isUpdate ? "Create or update" : "Create"}</span>
            </div>

            {matchingAttribute && (
                <div className="text-xs text-muted-foreground">
                    Match on <span className="font-mono text-foreground">{matchingAttribute}</span>
                </div>
            )}

            {entries.length > 0 && (
                <div className="rounded-md border border-border overflow-hidden">
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
            )}
        </div>
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
