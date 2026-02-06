import { AgentBuilderLayout } from "@/components/AgentBuilder/AgentBuilderLayout"

export default function AgentSetup() {
    return (
        <AgentBuilderLayout
            header={
                <>
                    <h1 className="text-2xl font-semibold text-foreground">Create a new agent</h1>
                    <p className="text-muted-foreground mt-1">Describe what you want your agent to do, and we'll help you build it.</p>
                </>
            }
        />
    )
}
