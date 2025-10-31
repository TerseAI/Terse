interface EmptyStateProps {
    hasFilters: boolean;
}

export function EmptyState({ hasFilters }: EmptyStateProps) {
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
