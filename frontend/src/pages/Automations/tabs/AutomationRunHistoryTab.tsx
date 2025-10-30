import RunHistory from "../../../components/RunHistory/index";

export default function AutomationRunHistoryTab() {
    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto max-w-6xl mx-auto p-6 space-y-4 w-full">
                <RunHistory />
            </div>
        </div>
    );
}

