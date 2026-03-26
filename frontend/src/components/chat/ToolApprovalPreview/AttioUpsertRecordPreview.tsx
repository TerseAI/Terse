import { useCallback, useEffect, useMemo, useState } from "react"

import { DataEditor, GridCellKind, type EditableGridCell, type GridCell, type GridColumn, type Item, type Theme } from "@glideapps/glide-data-grid"
import { AlertTriangle, ArrowRight, Pencil, RotateCcw } from "lucide-react"

import { useAttioObjects } from "@/hooks/api/useAttioObjects"
import type { AttioAttribute } from "@/shared/types"

import { Badge } from "../../ui/badge"
import { Button } from "../../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog"

import type { ToolPreviewProps } from "./index"

interface AttioUpsertRecordParams {
    integrationId?: string
    objectSlug?: string
    matchingAttribute?: string
    records?: string
    values?: string
}

type ValidationNotice = {
    rowIndex: number
    field: string
    message: string
}

export default function AttioUpsertRecordPreview({ parameters, editedArguments, onEditedArgumentsChange }: ToolPreviewProps) {
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [workingRecords, setWorkingRecords] = useState<Array<Record<string, unknown>>>([])

    const parsedParameters = useMemo(() => safeParseParams(parameters), [parameters])
    const draftParameters = useMemo(() => (editedArguments ? safeParseParams(editedArguments) : null), [editedArguments])
    const { integrationId, objectSlug, matchingAttribute } = parsedParameters ?? {}
    const { objects } = useAttioObjects(integrationId)

    const originalRecords = useMemo(() => extractRecords(parsedParameters), [parsedParameters])
    const draftRecords = useMemo(() => extractRecords(draftParameters), [draftParameters])
    const displayRecords = draftRecords.length > 0 ? draftRecords : originalRecords
    const objectDefinition = useMemo(() => objects.find(object => object.api_slug === objectSlug), [objectSlug, objects])
    const columns = useMemo(() => buildColumnOrder(displayRecords, objectDefinition?.attributes, matchingAttribute), [displayRecords, matchingAttribute, objectDefinition?.attributes])
    const gridColumns = useMemo(() => buildGridColumns(columns, objectDefinition?.attributes, matchingAttribute), [columns, matchingAttribute, objectDefinition?.attributes])
    const glideTheme = useMemo(() => buildGlideTheme(), [])
    const validationNotices = useMemo(() => buildValidationNotices(displayRecords, objectDefinition?.attributes, matchingAttribute), [displayRecords, matchingAttribute, objectDefinition?.attributes])
    const workingValidationNotices = useMemo(
        () => buildValidationNotices(workingRecords, objectDefinition?.attributes, matchingAttribute),
        [workingRecords, matchingAttribute, objectDefinition?.attributes]
    )

    useEffect(() => {
        if (isEditorOpen) {
            setWorkingRecords(structuredClone(displayRecords))
        }
    }, [displayRecords, isEditorOpen])

    if (!parsedParameters) return null

    const requiredAttributes = (objectDefinition?.attributes ?? []).filter(attribute => attribute.is_required && attribute.api_slug)
    const hasDraftEdits = areRecordsEqual(displayRecords, originalRecords) === false
    const previewRows = displayRecords.slice(0, 3)

    const handleDialogChange = (nextOpen: boolean) => {
        setIsEditorOpen(nextOpen)
        if (nextOpen) {
            setWorkingRecords(structuredClone(displayRecords))
        }
    }

    const handleCellUpdate = (recordIndex: number, key: string, newValue: string) => {
        setWorkingRecords(prev => {
            const updated = structuredClone(prev)
            const originalValue = updated[recordIndex]?.[key] ?? originalRecords[recordIndex]?.[key]
            updated[recordIndex] = updated[recordIndex] ?? {}
            updated[recordIndex][key] = coerceEditedValue(originalValue, newValue)
            return updated
        })
    }

    const getCellContent = useCallback(
        ([columnIndex, rowIndex]: Item): GridCell => {
            const columnKey = columns[columnIndex]
            const value = workingRecords[rowIndex]?.[columnKey]
            const textValue = valueToEditString(value)

            return {
                kind: GridCellKind.Text,
                allowOverlay: true,
                readonly: false,
                displayData: textValue,
                data: textValue
            }
        },
        [columns, workingRecords]
    )

    const handleGridCellEdited = useCallback(
        ([columnIndex, rowIndex]: Item, newValue: EditableGridCell) => {
            if (newValue.kind !== GridCellKind.Text) return

            const columnKey = columns[columnIndex]
            handleCellUpdate(rowIndex, columnKey, newValue.data)
        },
        [columns]
    )

    const applyDraft = () => {
        const nextArguments = buildEditedArguments(parsedParameters, workingRecords)
        onEditedArgumentsChange?.(areRecordsEqual(workingRecords, originalRecords) ? undefined : nextArguments)
        setIsEditorOpen(false)
    }

    const resetDraft = () => {
        onEditedArgumentsChange?.(undefined)
        setWorkingRecords(structuredClone(originalRecords))
        setIsEditorOpen(false)
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

                    <div className="flex items-center gap-2">
                        {hasDraftEdits && <Badge variant="outline">Draft ready</Badge>}
                        <Button size="sm" variant="ghost" onClick={() => handleDialogChange(true)} className="h-7 px-2 text-xs">
                            <Pencil className="mr-1 h-3 w-3" />
                            Review & Edit
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                        {displayRecords.length} record{displayRecords.length === 1 ? "" : "s"}
                    </Badge>
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
                    <div className="space-y-2">
                        {previewRows.map((record, index) => (
                            <div key={index} className="rounded-md border border-border/70 bg-muted/10 px-3 py-2">
                                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Record {index + 1}</div>
                                <div className="flex flex-wrap gap-2">
                                    {columns
                                        .filter(column => !isEmptyValue(record[column]))
                                        .slice(0, 4)
                                        .map(column => (
                                            <div key={column} className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs">
                                                <span className="font-mono text-muted-foreground">{column}</span>
                                                <span className="mx-1 text-muted-foreground/60">:</span>
                                                <span className="text-foreground">{valueToEditString(record[column])}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ))}

                        {displayRecords.length > previewRows.length && (
                            <div className="text-xs text-muted-foreground">
                                Showing {previewRows.length} of {displayRecords.length} records.
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Dialog open={isEditorOpen} onOpenChange={handleDialogChange}>
                <DialogContent className="max-w-[min(1440px,calc(100vw-2rem))] gap-0 overflow-hidden p-0 sm:max-h-[88vh]">
                    <DialogHeader className="border-b border-border/70 px-6 py-5">
                        <DialogTitle>Review {objectSlug || "Attio"} records</DialogTitle>
                        <DialogDescription>Update the draft before approving the Attio upsert. Array values should be comma-separated.</DialogDescription>
                    </DialogHeader>

                    <div className="relative space-y-4 px-6 py-5">
                        <div id="portal" className="relative z-[92]" />
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{workingRecords.length} rows</Badge>
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

                        <div className="overflow-hidden rounded-xl border border-border/70">
                            <div className="border-b border-border/60 bg-muted/20 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                Spreadsheet editor
                            </div>
                            <div className="h-[50vh] bg-background">
                                <DataEditor
                                    width="100%"
                                    height="100%"
                                    columns={gridColumns}
                                    rows={workingRecords.length}
                                    getCellContent={getCellContent}
                                    onCellEdited={handleGridCellEdited}
                                    theme={glideTheme}
                                    cellActivationBehavior="single-click"
                                    getCellsForSelection={true}
                                    onPaste={true}
                                    rowMarkers={{ kind: "number", width: 54 }}
                                    rowHeight={42}
                                    headerHeight={42}
                                    smoothScrollX={true}
                                    smoothScrollY={true}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t border-border/70 px-6 py-4">
                        {hasDraftEdits ? (
                            <Button type="button" variant="ghost" onClick={resetDraft}>
                                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                Reset Draft
                            </Button>
                        ) : (
                            <div />
                        )}
                        <Button type="button" variant="outline" onClick={() => setIsEditorOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={applyDraft}>
                            Apply Draft
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

function safeParseParams(parameters?: string): AttioUpsertRecordParams | null {
    if (!parameters) return null

    try {
        return JSON.parse(parameters) as AttioUpsertRecordParams
    } catch {
        return null
    }
}

function extractRecords(parameters: AttioUpsertRecordParams | null): Array<Record<string, unknown>> {
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

function buildEditedArguments(parameters: AttioUpsertRecordParams, records: Array<Record<string, unknown>>): string {
    return JSON.stringify({
        ...parameters,
        records: JSON.stringify(records)
    })
}

function buildGridColumns(columns: string[], attributes?: AttioAttribute[], matchingAttribute?: string): GridColumn[] {
    return columns.map(column => {
        const attribute = attributes?.find(item => item.api_slug === column)
        const label = attribute?.title || column
        const suffixParts = [column === matchingAttribute ? "match" : null, attribute?.is_required ? "required" : null].filter(Boolean)

        return {
            id: column,
            title: suffixParts.length > 0 ? `${label} (${suffixParts.join(", ")})` : label,
            width: Math.max(180, Math.min(320, label.length * 12 + 80))
        }
    })
}

function buildGlideTheme(): Partial<Theme> {
    return {
        accentColor: "#7aa2ff",
        accentFg: "#08111f",
        accentLight: "rgba(122, 162, 255, 0.18)",
        textDark: "#f4f5f7",
        textMedium: "#c5c9d3",
        textLight: "#8a90a0",
        textBubble: "#f4f5f7",
        bgIconHeader: "#a6acc0",
        fgIconHeader: "#0f1115",
        textHeader: "#f4f5f7",
        textGroupHeader: "#d9dde7",
        textHeaderSelected: "#ffffff",
        bgCell: "#0f1115",
        bgCellMedium: "#151821",
        bgHeader: "#11151d",
        bgHeaderHasFocus: "#1a2030",
        bgHeaderHovered: "#1a2030",
        bgBubble: "#202633",
        bgBubbleSelected: "#2b3242",
        bgSearchResult: "#2d2411",
        borderColor: "rgba(255, 255, 255, 0.08)",
        horizontalBorderColor: "rgba(255, 255, 255, 0.06)",
        drilldownBorder: "rgba(255, 255, 255, 0)",
        linkColor: "#8eb4ff",
        headerFontStyle: "600 13px",
        baseFontStyle: "13px",
        markerFontStyle: "600 10px",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        editorFontSize: "13px",
        roundingRadius: 8
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

function buildValidationNotices(records: Array<Record<string, unknown>>, attributes?: AttioAttribute[], matchingAttribute?: string): ValidationNotice[] {
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

function isRecordLike(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function areRecordsEqual(a: Array<Record<string, unknown>>, b: Array<Record<string, unknown>>): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

function isEmptyValue(value: unknown): boolean {
    if (value === undefined || value === null) return true
    if (typeof value === "string") return value.trim().length === 0
    if (Array.isArray(value)) return value.length === 0 || value.every(item => String(item).trim().length === 0)
    return false
}

function valueToEditString(value: unknown): string {
    if (Array.isArray(value)) return value.map(String).join(", ")
    if (typeof value === "object" && value !== null) return JSON.stringify(value)
    return String(value ?? "")
}

function coerceEditedValue(originalValue: unknown, rawValue: string): unknown {
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
