import { Sparkles } from "lucide-react"

import { AgentBuilderLayout } from "@/components/AgentBuilder/AgentBuilderLayout"

export function HomeEmptyState() {
    return (
        <AgentBuilderLayout
            header={
                <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                        <Sparkles className="h-4 w-4" />
                        <span>Welcome to Terse!</span>
                    </div>
                    <h1 className="text-3xl font-semibold text-foreground tracking-tight">Build your first agent</h1>
                    <p className="text-muted-foreground mt-2 text-lg">Focus on shipping faster. We'll take care of the rest.</p>
                </div>
            }
        />
    )
}
