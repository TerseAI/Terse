import { AgentBuilderLayout } from "@/components/AgentBuilder/AgentBuilderLayout"

export function HomeEmptyState() {
    return (
        <AgentBuilderLayout
            header={
                <div className="text-center">
                    <h1 className="text-3xl font-semibold text-foreground tracking-tight">Build your first agent</h1>
                    <p className="text-muted-foreground mt-2 text-lg">Focus on shipping faster. We'll take care of the rest.</p>
                </div>
            }
        />
    )
}
