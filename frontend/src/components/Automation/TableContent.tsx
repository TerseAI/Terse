import { flexRender, Table } from '@tanstack/react-table';
import { Automation } from '../../shared/types';

interface TableContentProps {
    table: Table<Automation>;
    onEdit: (automation: Automation) => void;
}

export function TableContent({ table, onEdit }: TableContentProps) {
    return (
        <div className="overflow-x-auto rounded-lg border border-[theme(border)]">
            <table className="min-w-full divide-y divide-[theme(border)]">
                <thead className="bg-[theme(background-elevated)]">
                    {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                                <th
                                    key={header.id}
                                    className="px-6 py-2 text-left text-sm font-bold text-[theme(text-secondary)] tracking-wider"
                                >
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                              header.column.columnDef.header,
                                              header.getContext()
                                          )}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody className="bg-[theme(background-elevated)] divide-y divide-[theme(border)]">
                    {table.getRowModel().rows.map(row => (
                        <tr
                            key={row.id}
                            className="hover:bg-[theme(background-surface)] transition-colors cursor-pointer"
                            onClick={() => onEdit(row.original)}
                        >
                            {row.getVisibleCells().map(cell => (
                                <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
