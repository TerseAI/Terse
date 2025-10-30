import { useEffect, useState } from 'react';
import {
    createColumnHelper,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { Automation } from '../shared/types';
import { BackendProvider } from '../services/backend';
import {
    LoadingState,
    EmptyState,
    StatusToggle,
    AppsList,
    ActionButtons,
    PaginationControls,
    TableContent,
} from './Automation';

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
            cell: info => (
                <StatusToggle
                    automation={info.row.original}
                    onToggle={handleToggleStatus}
                />
            ),
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
            cell: props => <AppsList automation={props.row.original} />,
        }),
        columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: props => (
                <ActionButtons
                    automation={props.row.original}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
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
        return <LoadingState />;
    }

    if (!loading && automations.length === 0) {
        const hasFilters: boolean = searchQuery !== '' || statusFilter !== undefined;
        return <EmptyState hasFilters={hasFilters} />;
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
