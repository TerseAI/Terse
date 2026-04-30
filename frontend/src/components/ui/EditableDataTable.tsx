import { Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "./button"
import { Input } from "./input"
import { ScrollArea } from "./scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table"
import { Textarea } from "./textarea"

export type EditableDataTableColumn = {
    key: string
    title: string
    width?: number
    multiline?: boolean
}

type EditableDataTableProps = {
    columns: EditableDataTableColumn[]
    rows: Array<Record<string, string>>
    onCellChange: (rowIndex: number, columnKey: string, value: string) => void
    className?: string
    viewportClassName?: string
    tableClassName?: string
    rowLabel?: (rowIndex: number) => string
    onAddRow?: () => void
    onRemoveRow?: (rowIndex: number) => void
    addRowLabel?: string
}

export function EditableDataTable({ columns, rows, onCellChange, className, viewportClassName, tableClassName, rowLabel, onAddRow, onRemoveRow, addRowLabel = "Add row" }: EditableDataTableProps) {
    return (
        <div className={cn("overflow-hidden rounded-md", className)}>
            <ScrollArea className={cn("max-h-[56vh] w-full bg-background", viewportClassName)}>
                <Table className={cn("table-fixed", tableClassName)}>
                    <TableHeader className="sticky top-0 z-20 bg-muted">
                        <TableRow>
                            <TableHead className="sticky left-0 z-30 w-14 min-w-14 bg-muted text-center text-xs uppercase tracking-[0.16em] text-muted-foreground">#</TableHead>
                            {columns.map(column => (
                                <TableHead key={column.key} className="bg-muted text-sm font-medium text-foreground" style={column.width ? { width: column.width, minWidth: column.width } : undefined}>
                                    {column.title}
                                </TableHead>
                            ))}
                            {onRemoveRow && <TableHead className="w-14 min-w-14 bg-muted" />}
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {rows.map((row, rowIndex) => (
                            <TableRow key={rowIndex} className={cn(rowIndex % 2 === 0 ? "bg-background" : "bg-muted")}>
                                <TableCell className={cn("sticky left-0 z-10 px-3 text-center text-xs font-medium text-muted-foreground")}>{rowLabel?.(rowIndex) ?? String(rowIndex + 1)}</TableCell>

                                {columns.map(column => {
                                    const value = row[column.key] ?? ""
                                    const isMultiline = column.multiline === true || value.includes("\n")

                                    return (
                                        <TableCell key={column.key} className="p-0" style={column.width ? { width: column.width, minWidth: column.width } : undefined}>
                                            {isMultiline ? (
                                                <Textarea
                                                    value={value}
                                                    onChange={event => onCellChange(rowIndex, column.key, event.target.value)}
                                                    className="min-h-[88px] resize-y rounded-none border-0 bg-transparent dark:!bg-transparent px-3 py-2 shadow-none focus-visible:!bg-accent/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
                                                />
                                            ) : (
                                                <Input
                                                    value={value}
                                                    onChange={event => onCellChange(rowIndex, column.key, event.target.value)}
                                                    className="h-[42px] rounded-none border-0 bg-transparent dark:bg-transparent px-3 shadow-none focus-visible:!bg-accent/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
                                                />
                                            )}
                                        </TableCell>
                                    )
                                })}

                                {onRemoveRow && (
                                    <TableCell className={cn("w-14 min-w-14 px-2 text-right", rowIndex % 2 === 0 ? "bg-background" : "bg-muted/30")}>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onRemoveRow(rowIndex)}
                                            aria-label={`Remove row ${rowLabel?.(rowIndex) ?? String(rowIndex + 1)}`}
                                        >
                                            <Trash2 className="h-4 w-4 text-danger" />
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>

            {onAddRow && (
                <div className="border-t border-border/60 bg-muted/30 px-3 py-2">
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onAddRow}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        {addRowLabel}
                    </Button>
                </div>
            )}
        </div>
    )
}
