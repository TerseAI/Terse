import { useEffect, useState } from 'react';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { Automation } from '../shared/types';
import { BackendProvider } from '../services/backend';
import { TrashIcon, PencilIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { IconForInputType } from '../pages/Automations/components/Integration';
import { Integration } from '../context/Integrations';

type AutomationsTableProps = {
    onEdit: (automation: Automation) => void;
    onDelete: (automation: Automation) => void;
    refreshTrigger?: number;
    searchQuery?: string;
    statusFilter?: boolean;
};

const columnHelper = createColumnHelper<Automation>();

export function AutomationsTable({ onEdit, onDelete, refreshTrigger, searchQuery, statusFilter }: AutomationsTableProps) {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(25);

    // Reset to first page when search query or status filter changes
    useEffect(() => {
        setPage(1);
    }, [searchQuery, statusFilter]);

    useEffect(() => {
        const loadAutomations = async () => {
            try {
                setLoading(true);
                const response = await BackendProvider.getUserAutomations(page, limit, statusFilter, searchQuery);
                setAutomations(response.automations);
                setTotalPages(response.pagination.totalPages);
                setTotal(response.pagination.total);
            } catch (error) {
                console.error('Failed to load automations:', error);
            } finally {
                setLoading(false);
            }
        };

        loadAutomations();
    }, [page, limit, refreshTrigger, searchQuery, statusFilter]);

    const handleLimitChange = (newLimit: number) => {
        setLimit(newLimit);
        setPage(1); // Reset to first page when changing limit
    };

    const handleToggleStatus = async (automation: Automation) => {
        const newStatus = !automation.isActive;

        // Update the automation status locally for immediate feedback
        setAutomations(prev =>
            prev.map(a =>
                a.id === automation.id
                    ? { ...a, isActive: newStatus }
                    : a
            )
        );

        try {
            // Update the automation status on the backend
            await BackendProvider.updateAutomation(automation.id, {
                isActive: newStatus
            });
        } catch (error) {
            console.error('Failed to toggle automation status:', error);
            // Revert on error
            setAutomations(prev =>
                prev.map(a =>
                    a.id === automation.id
                        ? { ...a, isActive: automation.isActive }
                        : a
                )
            );
        }
    };

    const columns = [
        columnHelper.accessor('isActive', {
            header: 'Status',
            cell: info => {
                const isActive = info.getValue();
                const automation = info.row.original;

                return (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(automation); }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            isActive
                                ? 'bg-[theme(--color-success)] focus:ring-[theme(--color-success)]'
                                : 'bg-[theme(text-disabled)] focus:ring-[theme(text-disabled)]'
                        }`}
                        role="switch"
                        aria-checked={isActive}
                        title={isActive ? 'Active' : 'Inactive'}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-[theme(text-primary)] transition-transform ${
                                isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                );
            },
        }),
        columnHelper.accessor('name', {
            header: 'Name',
            cell: info => (
                <div className="font-medium text-[theme(text-primary)]">
                    {info.getValue()}
                </div>
            ),
        }),
        columnHelper.display({
            id: 'apps',
            header: 'Apps',
            cell: props => {
                const automation = props.row.original;
                const allApps = [
                    ...automation.inputs.map(input => input.integration),
                    automation.output?.integration
                ].filter(Boolean) as Integration[];

                return (
                    <div className="flex items-center gap-1.5">
                        {allApps.map((app, idx) => (
                            <div key={idx} className="flex items-center">
                                {idx > 0 && (
                                    <ChevronRightIcon className="w-3 h-3 text-[theme(text-disabled)] mx-0.5" />
                                )}
                                <div
                                    className="w-7 h-7 flex items-center justify-center rounded border border-[theme(border)] bg-[theme(background-elevated)] p-1"
                                    title={app}
                                >
                                    <IconForInputType type={app} />
                                </div>
                            </div>
                        ))}
                    </div>
                );
            },
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: props => (
                <div className="flex gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(props.row.original); }}
                        className="p-1 text-[theme(--color-accent)] hover:text-[theme(--color-accent)]/80 hover:bg-[theme(--color-accent)]/10 rounded transition-colors"
                        title="Edit automation"
                    >
                        <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(props.row.original); }}
                        className="p-1 text-[theme(--color-accent-danger)] hover:text-[theme(--color-accent-danger)]/80 hover:bg-[theme(--color-accent-danger)]/10 rounded transition-colors"
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
                <div className="text-[theme(text-secondary)]">Loading automations...</div>
            </div>
        );
    }

    if (!loading && automations.length === 0) {
        const hasFilters = searchQuery || statusFilter !== undefined;
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p className="text-[theme(text-secondary)] mb-2">No automations found</p>
                    {hasFilters ? (
                        <p className="text-sm text-[theme(text-disabled)]">Try adjusting your search or filters</p>
                    ) : (
                        <p className="text-sm text-[theme(text-disabled)]">Create your first automation to get started</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
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

            {/* Pagination and Count */}
            <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <div className="text-sm text-[theme(text-secondary)]">
                        {totalPages > 1 ? (
                            <>
                                Showing <span className="font-medium text-[theme(text-primary)]">{(page - 1) * limit + 1}</span> to{' '}
                                <span className="font-medium text-[theme(text-primary)]">
                                    {Math.min(page * limit, total)}
                                </span>{' '}
                                of <span className="font-medium text-[theme(text-primary)]">{total}</span> automations
                            </>
                        ) : (
                            <>
                                <span className="font-medium text-[theme(text-primary)]">{total}</span> {total === 1 ? 'automation' : 'automations'}
                            </>
                        )}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <label htmlFor="items-per-page" className="text-sm text-[theme(text-secondary)]">
                                Per page:
                            </label>
                            <select
                                id="items-per-page"
                                value={limit}
                                onChange={(e) => handleLimitChange(Number(e.target.value))}
                                className="px-3 py-1.5 text-sm text-[theme(text-primary)] bg-[theme(background-surface)] border border-[theme(border)] rounded-md hover:bg-[theme(background-elevated)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)] transition-colors"
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    )}
                </div>
                {totalPages > 1 && (
                    <div className="flex gap-2">
                        {page > 1 && (
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="px-4 py-2 text-sm font-medium text-[theme(text-primary)] bg-[theme(background-surface)] border border-[theme(border)] rounded-md hover:bg-[theme(background-elevated)] transition-colors"
                            >
                                Previous
                            </button>
                        )}
                        {page < totalPages && (
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                className="px-4 py-2 text-sm font-medium text-[theme(text-primary)] bg-[theme(background-surface)] border border-[theme(border)] rounded-md hover:bg-[theme(background-elevated)] transition-colors"
                            >
                                Next
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
