import { useNavigate } from "react-router-dom"

import { Bot, Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { FrontendRoutes } from "@/shared/FrontendRoutes"

interface EmptyStateProps {
    hasFilters: boolean
    onCreateNew?: () => void
}

export function EmptyState({ hasFilters }: EmptyStateProps) {
    const navigate = useNavigate()

    if (hasFilters) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Search className="text-primary" />
                    </EmptyMedia>
                    <EmptyTitle>No agents found</EmptyTitle>
                    <EmptyDescription>Try adjusting your search or filters</EmptyDescription>
                </EmptyHeader>
            </Empty>
        )
    }

    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Bot className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>No agents yet</EmptyTitle>
                <EmptyDescription>Create your first agent to get started</EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}>
                <Plus className="h-4 w-4" />
                Create agent
            </Button>
        </Empty>
    )
}
