import { Switch } from "@/components/ui/switch"

import { Agent } from "../../shared/types"

interface StatusToggleProps {
    agent: Agent
    onToggle: (agent: Agent) => void
}

export function StatusToggle({ agent, onToggle }: StatusToggleProps) {
    const isActive = agent.isActive

    return (
        <div className="flex items-center space-x-2">
            <Switch id="airplane-mode" checked={isActive} onCheckedChange={() => onToggle(agent)} onClick={e => e.stopPropagation()} />
        </div>
    )
}
