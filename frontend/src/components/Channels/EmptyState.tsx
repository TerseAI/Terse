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
import { useNavigate } from "react-router-dom";

interface EmptyStateProps {
    hasFilters: boolean;
    onCreateNew?: () => void;
}

export function EmptyState({ hasFilters }: EmptyStateProps) {
    const navigate = useNavigate();

    // If no filters, show empty state that redirects to setup page
    if (!hasFilters) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Settings className="text-primary" />
                    </EmptyMedia>
                    <EmptyTitle>No channels yet</EmptyTitle>
                    <EmptyDescription>
                        Create your first channel to start automating your workflow
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button
                        variant="default"
                        onClick={() => navigate('/app/channels/setup')}
                    >
                        <Plus className="h-4 w-4" />
                        Create Channel
                    </Button>
                </EmptyContent>
            </Empty>
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
