import { Pencil, Trash } from "lucide-react"

import { Agent } from "../../shared/types"

interface ActionButtonsProps {
    agent: Agent
    onEdit: (agent: Agent) => void
    onDelete: (agent: Agent) => void
}

export function ActionButtons({ agent, onEdit, onDelete }: ActionButtonsProps) {
    return (
        <div className="flex gap-2">
            <button
                onClick={e => {
                    e.stopPropagation()
                    onEdit(agent)
                }}
                className="p-1 text-primary hover:scale-110 rounded transition-colors cursor-pointer"
                title="Edit agent"
            >
                <Pencil className="h-5 w-5" />
            </button>
            <button
                onClick={e => {
                    e.stopPropagation()
                    onDelete(agent)
                }}
                className="p-1 text-destructive hover:scale-110 rounded transition-colors cursor-pointer"
                title="Delete agent"
            >
                <Trash className="h-5 w-5" />
            </button>
        </div>
    )
}
