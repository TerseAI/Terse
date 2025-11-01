import { Settings } from "lucide-react";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";

interface EmptyStateProps {
    hasFilters: boolean;
}

export function EmptyState({ hasFilters }: EmptyStateProps) {
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
        </Empty>
    );
}
