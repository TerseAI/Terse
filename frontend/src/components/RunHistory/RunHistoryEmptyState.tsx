import { FileText } from "lucide-react";
import { Button } from "../ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "../ui/empty";

type Props = {
    hasActiveFilters: boolean;
    onClearAll: () => void;
};

export default function RunHistoryEmptyState({ hasActiveFilters, onClearAll }: Props) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <FileText />
                </EmptyMedia>
                <EmptyTitle>No runs found</EmptyTitle>
                <EmptyDescription>
                    {hasActiveFilters
                        ? "Try adjusting your filters or search query"
                        : "Run history will appear here as your automation processes events"}
                </EmptyDescription>
            </EmptyHeader>
            {hasActiveFilters && (
                <EmptyContent>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClearAll}
                    >
                        Clear All Filters
                    </Button>
                </EmptyContent>
            )}
        </Empty>
    );
}



