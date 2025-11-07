import { useEffect, useState } from 'react';
import {
    ColumnDef,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { Automation } from '../shared/types';
import {
    LoadingState,
    EmptyState,
    StatusToggle,
    AppsList,
    ActionButtons,
    PaginationControls,
    TableContent,
} from './Automation';
import { useAutomations, useAutomationMutations } from '@/hooks/api/useAutomations';

type AutomationsTableProps = {
    onEdit: (automation: Automation) => void;
    onDelete: (automation: Automation) => void;
    onCreateNew?: () => void;
    searchQuery?: string;
    statusFilter?: boolean;
};

export function AutomationsTable({ onEdit, onDelete, onCreateNew, searchQuery, statusFilter }: AutomationsTableProps) {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const { automations, pagination, isLoading, mutate } = useAutomations({
        page,
        limit,
        isActive: statusFilter,
        search: searchQuery,
    });
    const { toggleAutomationActive } = useAutomationMutations();

    const totalPages = pagination?.totalPages ?? 1;
    const total = pagination?.total ?? automations.length;

    // Reset to first page when search query or status filter changes
    useEffect(() => {
        setPage(1);
    }, [searchQuery, statusFilter]);

    const handleLimitChange = (newLimit: number) => {
        setLimit(newLimit);
        setPage(1); // Reset to first page when changing limit
    };

    const handleToggleStatus = async (automation: Automation) => {
        try {
            await toggleAutomationActive(automation, {
                mutateList: mutate,
                params: {
                    page,
                    limit,
                    isActive: statusFilter,
                    search: searchQuery,
                },
            });
        } catch (error) {
            console.error('Failed to toggle automation status:', error);
        }
    };

    const columns: ColumnDef<Automation>[] = [
        {
            accessorKey: 'isActive',
            header: 'Status',
            cell: ({ row }) => (
                <StatusToggle
                    automation={row.original}
                    onToggle={handleToggleStatus}
                />
            ),
        },
        {
            accessorKey: 'name',
            header: 'Name',
            cell: ({ getValue }) => (
                <div className="font-medium">
                    {getValue() as string}
                </div>
            ),
        },
        {
            id: 'apps',
            header: 'Apps',
            cell: ({ row }) => <AppsList automation={row.original} />,
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <ActionButtons
                    automation={row.original}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ),
        },
    ];

    const table = useReactTable({
        data: automations,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: totalPages,
    });

    if (isLoading && automations.length === 0) {
        return <LoadingState />;
    }

    if (!isLoading && automations.length === 0) {
        const hasFilters: boolean = searchQuery !== '' || statusFilter !== undefined;
        return <EmptyState hasFilters={hasFilters} onCreateNew={onCreateNew} />;
    }

    return (
        <div className="space-y-4">
            <TableContent table={table} onEdit={onEdit} />
            <PaginationControls
                page={page}
                totalPages={totalPages}
                total={total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={handleLimitChange}
            />
        </div>
    );
}
