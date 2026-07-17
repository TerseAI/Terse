import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

export function FetchErrorCard({ message, onRetry }: FetchErrorCardProps) {
    return (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-card p-6">
            <div>
                <p className="text-sm font-medium text-foreground">{message}</p>
                <p className="mt-1 text-sm text-muted-foreground">Check your connection or try again in a moment.</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="size-4" />
                Retry
            </Button>
        </div>
    )
}

interface FetchErrorCardProps {
    readonly message: string
    readonly onRetry: () => void
}
