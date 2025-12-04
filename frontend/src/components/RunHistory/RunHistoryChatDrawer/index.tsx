import { useEffect, useRef, useState } from 'react';
import {
    Drawer,
    DrawerContent,
} from '@/components/ui/drawer';
import { RunHistoryStatus, RunHistoryTrigger, RunHistoryRecord } from '@/shared/RunHistoryTypes';
import { cn } from '@/lib/utils';
import RunHistoryChatDrawerHeader from './RunHistoryChatDrawerHeader';
import RunHistoryChatAdapter from './RunHistoryChatAdapter';
import { Chat, type ChatHandle } from '@/components/chat/Chat';

type Props = {
    runId: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    status: RunHistoryStatus;
    trigger: RunHistoryTrigger;
    filtered: boolean;
    runs?: RunHistoryRecord[];
    currentRunIndex?: number;
    onNavigate?: (runId: string) => void;
    isFullscreen?: boolean;
    onFullscreenChange?: (fullscreen: boolean) => void;
    isInitialOpen?: boolean;
};

export default function RunHistoryChatDrawer({
    runId,
    isOpen,
    onOpenChange,
    status,
    trigger,
    filtered,
    runs,
    currentRunIndex,
    onNavigate,
    isFullscreen: externalIsFullscreen = false,
    onFullscreenChange,
    isInitialOpen = true,
}: Props) {
    const [internalFullscreen, setInternalFullscreen] = useState(false);
    const prevRunIdRef = useRef<string | null>(null);
    const chatRef = useRef<ChatHandle>(null);
    
    const isFullscreen = onFullscreenChange ? externalIsFullscreen : internalFullscreen;
    const isActuallyInitialOpen = isInitialOpen && (prevRunIdRef.current === null || prevRunIdRef.current !== runId);
    
    useEffect(() => {
        if (isOpen) {
            prevRunIdRef.current = runId;
            // Scroll to bottom when drawer opens (with small delay for content to render)
            const timeoutId = setTimeout(() => {
                chatRef.current?.scrollToBottom();
            }, 100);
            return () => clearTimeout(timeoutId);
        } else {
            prevRunIdRef.current = null;
        }
    }, [runId, isOpen]);
    
    const handleFullscreenChange = (fullscreen: boolean) => {
        if (onFullscreenChange) {
            onFullscreenChange(fullscreen);
        } else {
            setInternalFullscreen(fullscreen);
        }
    };

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange} direction="right" shouldScaleBackground={isActuallyInitialOpen}>
            <DrawerContent className={cn(
                "flex flex-col overflow-hidden",
                isFullscreen 
                    ? "!w-screen !h-screen !max-w-none !max-h-none !rounded-none !m-0"
                    : "!w-full sm:!w-[600px] md:!w-[700px] lg:!w-[800px] !max-w-[100vw] h-full",
                !isActuallyInitialOpen && "[&[data-state=open]]:!animate-none [&[data-state=closed]]:!animate-none [&+*]:!animate-none"
            )}>
                {isOpen && (
                    <RunHistoryChatAdapter runId={runId} status={status}>
                        {({ initialTurns, isLoading, subscribeToEvents, sendMessage, currentStatus }) => {
                            const isFiltered = currentStatus === 'skipped';
                            return (
                                <>
                                    <RunHistoryChatDrawerHeader
                                        trigger={trigger}
                                        status={currentStatus}
                                        filtered={isFiltered || filtered}
                                        runs={runs}
                                        currentRunIndex={currentRunIndex}
                                        onNavigate={onNavigate}
                                        isFullscreen={isFullscreen}
                                        onFullscreenChange={handleFullscreenChange}
                                    />
                                    <div className={cn(
                                        "flex-1 overflow-hidden min-h-0 bg-background",
                                        isFullscreen && "mx-auto w-full"
                                    )}>
                                        <div className="flex flex-col h-full relative">
                                            <div className="flex-1 min-h-0">
                                                <Chat 
                                                    ref={chatRef}
                                                    initialTurns={initialTurns} 
                                                    subscribeToEvents={subscribeToEvents}
                                                    sendMessage={sendMessage}
                                                    EmptyContentPlaceholder={
                                                        isLoading 
                                                            ? <div className="p-4 text-center text-muted-foreground">Loading history...</div> 
                                                            : <div className="p-4 text-center text-muted-foreground">No events found</div>
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        }}
                    </RunHistoryChatAdapter>
                )}
            </DrawerContent>
        </Drawer>
    );
}
