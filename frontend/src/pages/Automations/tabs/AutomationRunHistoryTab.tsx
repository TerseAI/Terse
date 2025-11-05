import RunHistory from "../../../components/RunHistory/index";

export default function AutomationRunHistoryTab() {
    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto w-full">
                <RunHistory />
            </div>
        </div>
    );
}