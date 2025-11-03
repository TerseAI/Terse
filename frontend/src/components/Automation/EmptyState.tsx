import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";

interface EmptyStateProps {
    hasFilters: boolean;
    onCreateNew?: () => void;
}

export function EmptyState({ hasFilters, onCreateNew }: EmptyStateProps) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Settings className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>No automations found</EmptyTitle>
                <EmptyDescription>
                    {hasFilters
                        ? "Try adjusting your search or filters"
                        : "Create your first automation to get started"}
                </EmptyDescription>
            </EmptyHeader>
            {!hasFilters && onCreateNew && (
                <EmptyContent>
                    <Button
                        variant="default"
                        onClick={onCreateNew}
                    >
                        <Plus className="h-4 w-4" />
                        Add Automation
                    </Button>
                </EmptyContent>
            )}
        </Empty>
    );
}
