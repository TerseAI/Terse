interface PaginationControlsProps {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}

export function PaginationControls({
    page,
    totalPages,
    total,
    limit,
    onPageChange,
    onLimitChange,
}: PaginationControlsProps) {
    return (
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
                            onChange={(e) => onLimitChange(Number(e.target.value))}
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
                            onClick={() => onPageChange(Math.max(1, page - 1))}
                            className="px-4 py-2 text-sm font-medium text-[theme(text-primary)] bg-[theme(background-surface)] border border-[theme(border)] rounded-md hover:bg-[theme(background-elevated)] transition-colors"
                        >
                            Previous
                        </button>
                    )}
                    {page < totalPages && (
                        <button
                            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                            className="px-4 py-2 text-sm font-medium text-[theme(text-primary)] bg-[theme(background-surface)] border border-[theme(border)] rounded-md hover:bg-[theme(background-elevated)] transition-colors"
                        >
                            Next
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
