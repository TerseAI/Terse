import { Link } from "react-router-dom"

import { FileText } from "lucide-react"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ACTIVITY_OVERVIEW_PATH } from "@/modules/activity/activityRoutes"

type Props = {
    hasActiveFilters: boolean
    onClearAll: () => void
}

export default function RunHistoryEmptyState({ hasActiveFilters, onClearAll }: Props) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <FileText className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>No events found</EmptyTitle>
                <EmptyDescription>
                    {hasActiveFilters
                        ? "Try adjusting your filters or search query."
                        : "Job runs show up here. Open one to see the transcript."}
                </EmptyDescription>
            </EmptyHeader>
            {hasActiveFilters ? (
                <EmptyContent>
                    <Button variant="outline" size="sm" onClick={onClearAll}>
                        Clear all filters
                    </Button>
                </EmptyContent>
            ) : (
                <EmptyContent className="flex-row flex-wrap justify-center gap-2">
                    <Button size="sm" asChild>
                        <Link to={FrontendRoutes.HOME}>View your jobs</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link to={ACTIVITY_OVERVIEW_PATH}>See the overview</Link>
                    </Button>
                </EmptyContent>
            )}
        </Empty>
    )
}
