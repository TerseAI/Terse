import { flexRender, Table } from '@tanstack/react-table';
import { Agent } from '../../shared/types';
import {
    Table as ShadcnTable,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../ui/table';

interface TableContentProps {
    table: Table<Agent>;
    onEdit: (channel: Agent) => void;
}

export function TableContent({ table, onEdit }: TableContentProps) {
    return (
        <div className="rounded-lg border shadow-sm">
            <ShadcnTable>
                <TableHeader>
                    {table.getHeaderGroups().map(headerGroup => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                                <TableHead key={header.id}>
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                              header.column.columnDef.header,
                                              header.getContext()
                                          )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map(row => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                                className="cursor-pointer"
                                onClick={() => onEdit(row.original)}
                            >
                                {row.getVisibleCells().map(cell => (
                                    <TableCell key={cell.id}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </ShadcnTable>
        </div>
    );
}
