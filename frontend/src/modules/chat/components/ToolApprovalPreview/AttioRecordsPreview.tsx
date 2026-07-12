import { AlertTriangle, ArrowRight, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAttioObjects } from "@/modules/integrations/api/useAttioObjects"

import { buildEditorColumns, buildValidationNotices, extractRecords, safeParseParams, valueToEditString, writeActionLabel } from "./attioRecordsPreviewUtils"
import type { ToolPreviewProps } from "./index"

export default function AttioRecordsPreview({ parameters }: ToolPreviewProps) {
    const parsedParameters = safeParseParams(parameters)
    const request = parsedParameters?.request
    const { objects } = useAttioObjects(parsedParameters?.integrationId)

    if (!parsedParameters || !request) return null

    if (request.action === "delete") {
        return (
            <div className="rounded-lg border border-destructive/40 bg-destructive/8 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    Permanently delete this {request.objectSlug} record
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                    Record <span className="font-mono text-foreground">{request.recordId}</span> will be deleted from Attio. This cannot be undone.
                </div>
            </div>
        )
    }

    if (request.action !== "create" && request.action !== "update" && request.action !== "upsert") {
        return (
            <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-foreground capitalize">{request.objectSlug}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Read-only: {request.action.replace(/_/g, " ")}</span>
            </div>
        )
    }

    const matchingAttribute = request.action === "upsert" ? request.matchingAttribute : undefined
    const records = extractRecords(request)
    const objectDefinition = objects.find(object => object.api_slug === request.objectSlug)
    const columns = buildEditorColumns(records, objectDefinition?.attributes, matchingAttribute)
    const validationNotices = buildValidationNotices(records, objectDefinition?.attributes, matchingAttribute)
    const requiredAttributes = (objectDefinition?.attributes ?? []).filter(attribute => attribute.is_required && attribute.api_slug)

    return (
        <div className="space-y-3">
            <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-foreground capitalize">{request.objectSlug || "Record"}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{writeActionLabel(request.action)}</span>
                </div>
                {matchingAttribute && (
                    <div className="mt-1 text-xs text-muted-foreground">
                        Match on <span className="font-mono text-foreground">{matchingAttribute}</span>
                    </div>
                )}
                {request.action === "update" && (
                    <div className="mt-1 text-xs text-muted-foreground">
                        Record <span className="font-mono text-foreground">{request.recordId}</span>
                        {request.multiselectMode === "append" ? " (appending to multi-value attributes)" : ""}
                    </div>
                )}
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

            {records.length === 0 ? (
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

                        {validationNotices.length > 0 && (
                            <div className="rounded-lg border border-warning/40 bg-warning/8 px-4 py-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <AlertTriangle className="h-4 w-4 text-warning" />
                                    Review these warnings before approval
                                </div>
                                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                    {validationNotices.slice(0, 4).map(notice => (
                                        <div key={`${notice.rowIndex}-${notice.field}`}>
                                            Row {notice.rowIndex + 1}: {notice.message}
                                        </div>
                                    ))}
                                    {validationNotices.length > 4 && <div>+{validationNotices.length - 4} more warnings</div>}
                                </div>
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted px-4 py-2">
                                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Preview</div>
                                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                                    {records.length} record{records.length === 1 ? "" : "s"}
                                </Badge>
                            </div>
                            <div className="overflow-hidden rounded-md">
                                <ScrollArea className="max-h-[56vh] w-full bg-background">
                                    <Table className="table-fixed">
                                        <TableHeader className="sticky top-0 z-20 bg-muted">
                                            <TableRow>
                                                <TableHead className="sticky left-0 z-30 w-14 min-w-14 bg-muted text-center text-xs uppercase tracking-[0.16em] text-muted-foreground">#</TableHead>
                                                {columns.map(column => (
                                                    <TableHead
                                                        key={column.key}
                                                        className="bg-muted text-sm font-medium text-foreground"
                                                        style={column.width ? { width: column.width, minWidth: column.width } : undefined}
                                                    >
                                                        {column.title}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {records.map((record, rowIndex) => (
                                                <TableRow key={rowIndex} className={rowIndex % 2 === 0 ? "bg-background" : "bg-muted"}>
                                                    <TableCell className="sticky left-0 z-10 px-3 text-center text-xs font-medium text-muted-foreground">{rowIndex + 1}</TableCell>
                                                    {columns.map(column => (
                                                        <TableCell
                                                            key={column.key}
                                                            className="px-3 py-2 text-sm text-foreground"
                                                            style={column.width ? { width: column.width, minWidth: column.width } : undefined}
                                                        >
                                                            <span className="whitespace-pre-wrap break-words select-text">{valueToEditString(record[column.key])}</span>
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
