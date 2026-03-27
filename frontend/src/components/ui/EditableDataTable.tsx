import { cn } from "@/lib/utils"

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
}

export function EditableDataTable({ columns, rows, onCellChange, className, viewportClassName, tableClassName, rowLabel }: EditableDataTableProps) {
    return (
        <div className={cn("overflow-hidden rounded-md border border-border/60", className)}>
            <ScrollArea className={cn("max-h-[56vh] w-full bg-background", viewportClassName)}>
                <Table className={cn("table-fixed border-collapse", tableClassName)}>
                    <TableHeader className="sticky top-0 z-20 bg-muted">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="sticky left-0 z-30 w-14 min-w-14 bg-muted text-center text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                #
                            </TableHead>
                            {columns.map(column => (
                                <TableHead
                                    key={column.key}
                                    className="bg-muted align-bottom text-sm font-medium text-foreground"
                                    style={column.width ? { width: column.width, minWidth: column.width } : undefined}
                                >
                                    {column.title}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {rows.map((row, rowIndex) => (
                            <TableRow key={rowIndex} className="hover:bg-transparent">
                                <TableCell className="sticky left-0 z-10 bg-card/95 px-3 text-center text-xs font-medium text-muted-foreground">
                                    {rowLabel?.(rowIndex) ?? String(rowIndex + 1)}
                                </TableCell>

                                {columns.map(column => {
                                    const value = row[column.key] ?? ""
                                    const isMultiline = column.multiline === true || value.includes("\n")

                                    return (
                                        <TableCell
                                            key={column.key}
                                            className="p-0 align-top"
                                            style={column.width ? { width: column.width, minWidth: column.width } : undefined}
                                        >
                                            {isMultiline ? (
                                                <Textarea
                                                    value={value}
                                                    onChange={event => onCellChange(rowIndex, column.key, event.target.value)}
                                                    className="min-h-[88px] resize-y rounded-none border-0 bg-transparent px-3 py-2 shadow-none focus-visible:bg-accent/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
                                                />
                                            ) : (
                                                <Input
                                                    value={value}
                                                    onChange={event => onCellChange(rowIndex, column.key, event.target.value)}
                                                    className="h-[42px] rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:bg-accent/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
                                                />
                                            )}
                                        </TableCell>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
    )
}
