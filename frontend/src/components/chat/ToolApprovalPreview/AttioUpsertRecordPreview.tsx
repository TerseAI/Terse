import { useEffect, useMemo, useState } from "react"

import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react"

import { useAttioObjects } from "@/hooks/api/useAttioObjects"

import { EditableDataTable } from "../../ui/EditableDataTable"
import { Badge } from "../../ui/badge"
import { Button } from "../../ui/button"

import {
    areRecordsEqual,
    buildEditedArguments,
    buildEditorColumns,
    buildValidationNotices,
    coerceEditedValue,
    extractRecords,
    safeParseParams,
    valueToEditString
} from "./attioUpsertRecordPreviewUtils"
import type { ToolPreviewProps } from "./index"

export default function AttioUpsertRecordPreview({ parameters, editedArguments, onEditedArgumentsChange }: ToolPreviewProps) {
    const [workingRecords, setWorkingRecords] = useState<Array<Record<string, unknown>>>([])

    const parsedParameters = useMemo(() => safeParseParams(parameters), [parameters])
    const { integrationId, objectSlug, matchingAttribute } = parsedParameters ?? {}
    const { objects } = useAttioObjects(integrationId)

    const originalRecords = useMemo(() => extractRecords(parsedParameters), [parsedParameters])
    const draftRecords = useMemo(() => extractRecords(editedArguments ? safeParseParams(editedArguments) : null), [editedArguments])
    const displayRecords = draftRecords.length > 0 ? draftRecords : originalRecords
    const objectDefinition = objects.find(object => object.api_slug === objectSlug)
    const columns = buildEditorColumns(displayRecords, objectDefinition?.attributes, matchingAttribute)
    const editableRows = workingRecords.map(record => Object.fromEntries(columns.map(column => [column.key, valueToEditString(record[column.key])])))
    const validationNotices = buildValidationNotices(displayRecords, objectDefinition?.attributes, matchingAttribute)
    const workingValidationNotices = buildValidationNotices(workingRecords, objectDefinition?.attributes, matchingAttribute)

    useEffect(() => {
        setWorkingRecords(structuredClone(displayRecords))
    }, [displayRecords])

    if (!parsedParameters) return null

    const requiredAttributes = (objectDefinition?.attributes ?? []).filter(attribute => attribute.is_required && attribute.api_slug)
    const hasDraftEdits = areRecordsEqual(displayRecords, originalRecords) === false
    const hasWorkingEdits = areRecordsEqual(workingRecords, originalRecords) === false

    const handleCellUpdate = (recordIndex: number, key: string, newValue: string) => {
        setWorkingRecords(prev => {
            const updated = structuredClone(prev)
            const originalValue = updated[recordIndex]?.[key] ?? originalRecords[recordIndex]?.[key]
            updated[recordIndex] = updated[recordIndex] ?? {}
            updated[recordIndex][key] = coerceEditedValue(originalValue, newValue)
            return updated
        })
    }

    const applyDraft = () => {
        const nextArguments = buildEditedArguments(parsedParameters, workingRecords)
        onEditedArgumentsChange?.(areRecordsEqual(workingRecords, originalRecords) ? undefined : nextArguments)
    }

    const resetDraft = () => {
        onEditedArgumentsChange?.(undefined)
        setWorkingRecords(structuredClone(originalRecords))
    }

    return (
        <>
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-foreground capitalize">{objectSlug || "Record"}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Create or update</span>
                        </div>
                        {matchingAttribute && (
                            <div className="mt-1 text-xs text-muted-foreground">
                                Match on <span className="font-mono text-foreground">{matchingAttribute}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">{hasDraftEdits && <Badge variant="outline">Draft ready</Badge>}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {requiredAttributes.length > 0 && (
                        <Badge variant="outline">
                            {requiredAttributes.length} required field{requiredAttributes.length === 1 ? "" : "s"}
                        </Badge>
                    )}
                    {validationNotices.length > 0 && (
                        <Badge variant="outline" className="gap-1 text-warning">
                            <AlertTriangle className="h-3 w-3" />
                            {validationNotices.length} warning{validationNotices.length === 1 ? "" : "s"}
                        </Badge>
                    )}
                </div>

                {displayRecords.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Unable to preview the record payload.</div>
                ) : (
                    <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
                        <div className="space-y-4 px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                                {matchingAttribute && <Badge variant="outline">Match key: {matchingAttribute}</Badge>}
                                {requiredAttributes.length > 0 && (
                                    <Badge variant="outline">
                                        Required:{" "}
                                        {requiredAttributes
                                            .map(attribute => attribute.api_slug)
                                            .filter(Boolean)
                                            .join(", ")}
                                    </Badge>
                                )}
                            </div>

                            {workingValidationNotices.length > 0 && (
                                <div className="rounded-lg border border-warning/40 bg-warning/8 px-4 py-3">
                                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        <AlertTriangle className="h-4 w-4 text-warning" />
                                        Review these warnings before approval
                                    </div>
                                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                        {workingValidationNotices.slice(0, 4).map(notice => (
                                            <div key={`${notice.rowIndex}-${notice.field}`}>
                                                Row {notice.rowIndex + 1}: {notice.message}
                                            </div>
                                        ))}
                                        {workingValidationNotices.length > 4 && <div>+{workingValidationNotices.length - 4} more warnings in the table</div>}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted px-4 py-2">
                                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Spreadsheet editor</div>
                                    <Badge variant="outline" className="text-[11px] text-muted-foreground">
                                        Click any cell to edit
                                    </Badge>
                                </div>
                                <EditableDataTable columns={columns} rows={editableRows} onCellChange={handleCellUpdate} />
                            </div>

                            <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                                {hasWorkingEdits ? (
                                    <Button type="button" variant="ghost" onClick={resetDraft}>
                                        <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                        Reset Draft
                                    </Button>
                                ) : (
                                    <div />
                                )}

                                <div className="flex items-center gap-2">
                                    <Button type="button" onClick={applyDraft} disabled={!hasWorkingEdits}>
                                        Apply Draft
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
