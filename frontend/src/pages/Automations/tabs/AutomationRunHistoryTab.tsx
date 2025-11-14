import RunHistory from "../../../components/RunHistory/index";

type AutomationRunHistoryTabProps = {
    automationId: string | null;
};

export default function AutomationRunHistoryTab({ automationId }: AutomationRunHistoryTabProps) {
    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto w-full">
                <RunHistory automationId={automationId} />
            </div>
        </div>
    );
}