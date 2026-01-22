import RunHistory from "../../../components/RunHistory/index";

type AgentRunHistoryTabProps = {
    agentId: string | null;
};

export default function AgentRunHistoryTab({ agentId }: AgentRunHistoryTabProps) {
    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto w-full">
                <RunHistory agentId={agentId} />
            </div>
        </div>
    );
}