import RunHistory from "../../../components/RunHistory/index"

type AgentRunHistoryTabProps = {
    agentId: string | null
    onTriggerNow?: () => void
}

export default function AgentRunHistoryTab({ agentId, onTriggerNow }: AgentRunHistoryTabProps) {
    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto w-full">
                <RunHistory agentId={agentId} onTriggerNow={onTriggerNow} />
            </div>
        </div>
    )
}
