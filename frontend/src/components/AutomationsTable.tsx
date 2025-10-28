import { useEffect, useState } from 'react';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { Automation } from '../shared/types';
import { BackendProvider } from '../services/backend';
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

type AutomationsTableProps = {
    onEdit: (automation: Automation) => void;
    onDelete: (automation: Automation) => void;
    refreshTrigger?: number;
};

const columnHelper = createColumnHelper<Automation>();

export function AutomationsTable({ onEdit, onDelete, refreshTrigger }: AutomationsTableProps) {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    const loadAutomations = async () => {
        try {
            setLoading(true);
            const response = await BackendProvider.getUserAutomations(page, limit);
            setAutomations(response.automations);
            setTotalPages(response.pagination.totalPages);
            setTotal(response.pagination.total);
        } catch (error) {
            console.error('Failed to load automations:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAutomations();
    }, [page, refreshTrigger]);

    const columns = [
        columnHelper.accessor('name', {
            header: 'Name',
            cell: info => (
                <div className="font-medium text-gray-900">
                    {info.getValue()}
                </div>
            ),
        }),
        columnHelper.accessor('inputs', {
            header: 'Inputs',
            cell: info => (
                <div className="flex gap-2">
                    {info.getValue().map((input, idx) => (
                        <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                            {input.integration}
                        </span>
                    ))}
                </div>
            ),
        }),
        columnHelper.accessor('output', {
            header: 'Output',
            cell: info => {
                const output = info.getValue();
                return output ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {output.integration}
                    </span>
                ) : (
                    <span className="text-gray-400 text-sm">-</span>
                );
            },
        }),
        columnHelper.accessor('isActive', {
            header: 'Status',
            cell: info => (
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        info.getValue()
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}
                >
                    {info.getValue() ? 'Active' : 'Inactive'}
                </span>
            ),
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: props => (
                <div className="flex gap-2">
                    <button
                        onClick={() => onEdit(props.row.original)}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        title="Edit automation"
                    >
                        <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => onDelete(props.row.original)}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        title="Delete automation"
                    >
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            ),
        }),
    ];

    const table = useReactTable({
        data: automations,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: totalPages,
    });

    if (loading && automations.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading automations...</div>
            </div>
        );
    }

    if (!loading && automations.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p className="text-gray-500 mb-2">No automations found</p>
                    <p className="text-sm text-gray-400">Create your first automation to get started</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th
                                        key={header.id}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
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
                    <tbody className="bg-white divide-y divide-gray-200">
                        {table.getRowModel().rows.map(row => (
                            <tr key={row.id} className="hover:bg-gray-50 transition-colors">
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

            {/* Pagination */}
            <div className="flex items-center justify-between px-4">
                <div className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                    <span className="font-medium">
                        {Math.min(page * limit, total)}
                    </span>{' '}
                    of <span className="font-medium">{total}</span> results
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
