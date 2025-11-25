import { DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { IconForIntegration } from '@/pages/Channels/components/Integration';
import { RunHistoryStatus, RunHistoryTrigger } from '@/shared/RunHistoryTypes';
import { ExternalLink, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import RunHistoryStatusBadge from '../RunHistoryStatusBadge';
import { Button } from '@/components/ui/button';
import { RunHistoryRecord } from '@/shared/RunHistoryTypes';

type Props = {
    trigger: RunHistoryTrigger;
    status: RunHistoryStatus;
    filtered: boolean;
    runs?: RunHistoryRecord[];
    currentRunIndex?: number;
    onNavigate?: (runId: string) => void;
    isFullscreen: boolean;
    onFullscreenChange: (fullscreen: boolean) => void;
};

export default function RunHistoryChatDrawerHeader({
    trigger,
    status,
    filtered,
    runs,
    currentRunIndex,
    onNavigate,
    isFullscreen,
    onFullscreenChange,
}: Props) {
    const canGoPrevious = runs && currentRunIndex !== undefined && currentRunIndex > 0;
    const canGoNext = runs && currentRunIndex !== undefined && currentRunIndex < runs.length - 1;
    
    const handlePrevious = () => {
        if (runs && currentRunIndex !== undefined && currentRunIndex > 0 && onNavigate) {
            onNavigate(runs[currentRunIndex - 1].id);
        }
    };
    
    const handleNext = () => {
        if (runs && currentRunIndex !== undefined && currentRunIndex < runs.length - 1 && onNavigate) {
            onNavigate(runs[currentRunIndex + 1].id);
        }
    };
    
    const toggleFullscreen = () => {
        onFullscreenChange(!isFullscreen);
    };

    return (
        <DrawerHeader className="shrink-0 pr-4">
            <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="w-4 h-4 flex-shrink-0 mt-0.5">
                        <IconForIntegration integration={trigger.integration} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <DrawerTitle 
                                className="text-base font-semibold truncate"
                                title={trigger.title || trigger.source}
                            >
                                {trigger.title || trigger.source}
                            </DrawerTitle>
                            {trigger.url && (
                                <a
                                    href={trigger.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:opacity-80 transition-opacity flex-shrink-0"
                                    title={trigger.url}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                        {trigger.subheader && (
                            <DrawerDescription className="mt-1">
                                {trigger.subheader}
                            </DrawerDescription>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <RunHistoryStatusBadge status={status} filtered={filtered} />
                    {runs && currentRunIndex !== undefined && (
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handlePrevious}
                                disabled={!canGoPrevious}
                                className="h-8 w-8 p-0"
                                title="Previous run"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleNext}
                                disabled={!canGoNext}
                                className="h-8 w-8 p-0"
                                title="Next run"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleFullscreen}
                        className="h-8 w-8 p-0"
                        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    >
                        {isFullscreen ? (
                            <Minimize2 className="w-4 h-4" />
                        ) : (
                            <Maximize2 className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>
        </DrawerHeader>
    );
}

