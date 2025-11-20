import { useEffect, useState } from 'react';
import {
    ColumnDef,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { Channel } from '../shared/types';
import {
    LoadingState,
    EmptyState,
    StatusToggle,
    AppsList,
    ActionButtons,
    PaginationControls,
    TableContent,
} from './Channels';
import { useChannels, useChannelMutations } from '@/hooks/api/useChannels';

type ChannelsTableProps = {
    onEdit: (channel: Channel) => void;
    onDelete: (channel: Channel) => void;
    onCreateNew?: () => void;
    searchQuery?: string;
    statusFilter?: boolean;
};

export function ChannelsTable({ onEdit, onDelete, onCreateNew, searchQuery, statusFilter }: ChannelsTableProps) {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const { channels, pagination, isLoading, mutate } = useChannels({
        page,
        limit,
        isActive: statusFilter,
        search: searchQuery,
    });
    const { toggleChannelActive } = useChannelMutations();

    const totalPages = pagination?.totalPages ?? 1;
    const total = pagination?.total ?? channels.length;

    // Reset to first page when search query or status filter changes
    useEffect(() => {
        setPage(1);
    }, [searchQuery, statusFilter]);

    const handleLimitChange = (newLimit: number) => {
        setLimit(newLimit);
        setPage(1); // Reset to first page when changing limit
    };

    const handleToggleStatus = async (channel: Channel) => {
        try {
            await toggleChannelActive(channel, {
                mutateList: mutate,
                params: {
                    page,
                    limit,
                    isActive: statusFilter,
                    search: searchQuery,
                },
            });
        } catch (error) {
            console.error('Failed to toggle channel status:', error);
        }
    };

    const columns: ColumnDef<Channel>[] = [
        {
            accessorKey: 'isActive',
            header: 'Status',
            cell: ({ row }) => (
                <StatusToggle
                    channel={row.original}
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
            cell: ({ row }) => <AppsList channel={row.original} />,
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <ActionButtons
                    channel={row.original}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ),
        },
    ];

    const table = useReactTable({
        data: channels,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: totalPages,
    });

    if (isLoading && channels.length === 0) {
        return <LoadingState />;
    }

    if (!isLoading && channels.length === 0) {
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
