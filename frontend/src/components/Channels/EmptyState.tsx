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
import { TemplatesGrid } from "./TemplatesGrid";

interface EmptyStateProps {
    hasFilters: boolean;
    onCreateNew?: () => void;
}

export function EmptyState({ hasFilters, onCreateNew }: EmptyStateProps) {
    // If no filters, show templates grid for new users
    if (!hasFilters) {
        return (
            <div className="space-y-8">
                <TemplatesGrid />
                <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-sm text-muted-foreground">or</span>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Settings className="text-primary" />
                        </EmptyMedia>
                        <EmptyTitle>Start from scratch</EmptyTitle>
                        <EmptyDescription>
                            Create a custom channel with your own configuration
                        </EmptyDescription>
                    </EmptyHeader>
                    {onCreateNew && (
                        <EmptyContent>
                            <Button
                                variant="default"
                                onClick={onCreateNew}
                            >
                                <Plus className="h-4 w-4" />
                                Add Channel
                            </Button>
                        </EmptyContent>
                    )}
                </Empty>
            </div>
        );
    }

    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Settings className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>No channels found</EmptyTitle>
                <EmptyDescription>
                    Try adjusting your search or filters
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
