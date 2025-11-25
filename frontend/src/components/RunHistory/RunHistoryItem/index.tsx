import moment from 'moment';
import { RunHistoryRecord } from "../../../shared/RunHistoryTypes";
import RunHistoryItemHeader from "./RunHistoryItemHeader";
import RunHistoryChatDrawer from "../RunHistoryChatDrawer";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import RunHistoryStatusBadge from "../RunHistoryStatusBadge";

type Props = {
    run: RunHistoryRecord;
    runs?: RunHistoryRecord[];
    currentRunIndex?: number;
    isDrawerOpen?: boolean;
    onDrawerOpenChange?: (open: boolean) => void;
    onNavigateToRun?: (runId: string) => void;
    isFullscreen?: boolean;
    onFullscreenChange?: (fullscreen: boolean) => void;
    isInitialOpen?: boolean;
};

export default function RunHistoryItem({ 
    run, 
    runs, 
    currentRunIndex, 
    isDrawerOpen = false,
    onDrawerOpenChange,
    onNavigateToRun,
    isFullscreen = false,
    onFullscreenChange,
    isInitialOpen = true,
}: Props) {
    const handleDrawerOpen = () => {
        if (onDrawerOpenChange) {
            onDrawerOpenChange(true);
        }
    };
    
    const handleDrawerClose = (open: boolean) => {
        if (onDrawerOpenChange) {
            onDrawerOpenChange(open);
        }
    };
    const formatTimestamp = (timestamp: string) => {
        const date = moment(timestamp);
        const now = moment();
        const diffMs = now.diff(date);
        const minutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return date.format('MMM D, h:mm A');
    };

    const copyToClipboard = (text: string) => {
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
        }
    };

    return (
        <div className="overflow-hidden bg-card border border-border rounded-lg md:mb-3 min-w-[640px] md:min-w-0 shrink-0 md:shrink">
            <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
                <RunHistoryItemHeader
                    run={run}
                    formattedTimestamp={formatTimestamp(run.timestamp)}
                    onCopy={copyToClipboard}
                />
                <div className="flex items-center gap-3 md:ml-auto">
                    <RunHistoryStatusBadge status={run.status} filtered={run.filtered} />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDrawerOpen}
                        className="flex items-center gap-2"
                        title="View chat"
                    >
                        <MessageSquare className="w-4 h-4" />
                    </Button>
                </div>
            </div>
            <RunHistoryChatDrawer
                runId={run.id}
                isOpen={isDrawerOpen}
                onOpenChange={handleDrawerClose}
                status={run.status}
                trigger={run.trigger}
                filtered={run.filtered}
                runs={runs}
                currentRunIndex={currentRunIndex}
                onNavigate={(newRunId) => {
                    if (onNavigateToRun) {
                        onNavigateToRun(newRunId);
                    }
                }}
                isFullscreen={isFullscreen}
                onFullscreenChange={onFullscreenChange}
                isInitialOpen={isInitialOpen}
            />
        </div>
    );
}


