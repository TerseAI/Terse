import { useEffect, useState } from 'react';
import {
    ColumnDef,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { Agent } from '../shared/types';
import {
    LoadingState,
    EmptyState,
    StatusToggle,
    AppsList,
    ActionButtons,
    PaginationControls,
    TableContent,
} from './Agents';
import { useAgents, useAgentMutations } from '@/hooks/api/useAgents';

type AgentsTableProps = {
    onEdit: (agent: Agent) => void;
    onDelete: (agent: Agent) => void;
    onCreateNew?: () => void;
    searchQuery?: string;
    statusFilter?: boolean;
};

export function AgentsTable({ onEdit, onDelete, onCreateNew, searchQuery, statusFilter }: AgentsTableProps) {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const { agents, pagination, isLoading, mutate } = useAgents({
        page,
        limit,
        isActive: statusFilter,
        search: searchQuery,
    });
    const { toggleAgentActive } = useAgentMutations();

    const totalPages = pagination?.totalPages ?? 1;
    const total = pagination?.total ?? agents.length;

    // Reset to first page when search query or status filter changes
    useEffect(() => {
        setPage(1);
    }, [searchQuery, statusFilter]);

    const handleLimitChange = (newLimit: number) => {
        setLimit(newLimit);
        setPage(1); // Reset to first page when changing limit
    };

    const handleToggleStatus = async (agent: Agent) => {
        try {
            await toggleAgentActive(agent, {
                mutateList: mutate,
                params: {
                    page,
                    limit,
                    isActive: statusFilter,
                    search: searchQuery,
                },
            });
        } catch (error) {
            console.error('Failed to toggle agent status:', error);
        }
    };

    const columns: ColumnDef<Agent>[] = [
        {
            accessorKey: 'isActive',
            header: 'Status',
            cell: ({ row }) => (
                <StatusToggle
                    agent={row.original}
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
            cell: ({ row }) => <AppsList agent={row.original} />,
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <ActionButtons
                    agent={row.original}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ),
        },
    ];

    const table = useReactTable({
        data: agents,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: totalPages,
    });

    if (isLoading && agents.length === 0) {
        return <LoadingState />;
    }

    if (!isLoading && agents.length === 0) {
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
