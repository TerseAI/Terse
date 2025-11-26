import { useEffect, useRef, useState, useMemo } from 'react';
import {
    Drawer,
    DrawerContent,
} from '@/components/ui/drawer';
import { useChannelChatEvents } from '@/hooks/useChannelChatEvents';
import { useChatHistory } from '@/hooks/api/useChatHistory';
import { RunHistoryStatus, RunHistoryTrigger, RunHistoryRecord, RunHistoryModelEvent } from '@/shared/RunHistoryTypes';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import RunHistoryChatDrawerHeader from './RunHistoryChatDrawerHeader';
import EventList from './EventList';
import RunTimestamps from './RunTimestamps';
import { useChatEvents } from './useChatEvents';

/**
 * Get the unique ID for an event to use for deduplication
 * Events from the database and socket should both have an 'id' field
 */
function getEventId(event: RunHistoryModelEvent): string | null {
    return event.id || null;
}

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
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
    const [internalFullscreen, setInternalFullscreen] = useState(false);
    const prevRunIdRef = useRef<string | null>(null);
    
    // Use external fullscreen state if provided, otherwise use internal
    const isFullscreen = onFullscreenChange ? externalIsFullscreen : internalFullscreen;
    
    // Determine if this is an initial open or navigation
    const isActuallyInitialOpen = isInitialOpen && (prevRunIdRef.current === null || prevRunIdRef.current !== runId);
    
    // Update prevRunId when runId changes, reset when drawer closes. Used to trigger animation only on initial open.
    useEffect(() => {
        if (isOpen) {
            prevRunIdRef.current = runId;
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
    
    // Only fetch chat history when drawer is open
    const isActiveRun = status === 'in_progress';
    const { events: realtimeEvents } = useChannelChatEvents(isOpen && isActiveRun ? runId : null);
    const { events: historyEvents, isLoading, startTimestamp, endTimestamp } = useChatHistory(isOpen ? runId : null);
    
    // Merge events based on run status
    const events: Array<RunHistoryModelEvent> = useMemo(() => {
        // Completed runs: API is source of truth (simple case)
        if (!isActiveRun) {
            return historyEvents;
        }
        
        // Active runs: merge API (stored) + websocket (live)
        // Handles page refresh - API has history, websocket has new events
        const eventMap = new Map<string, RunHistoryModelEvent>();
        
        // Add all API events first (already stored in database)
        historyEvents.forEach(event => {
            const id = getEventId(event);
            if (id) {
                eventMap.set(id, event);
            }
        });
        
        // Add websocket events that aren't in API yet
        realtimeEvents.forEach(event => {
            const id = getEventId(event);
            if (id && !eventMap.has(id)) {
                eventMap.set(id, event);
            }
        });
        
        // Sort by timestamp
        return Array.from(eventMap.values()).sort((a, b) => 
            new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
        );
    }, [isActiveRun, historyEvents, realtimeEvents]);

    // Process events using custom hook
    const { accumulatedMessages, toolCallMap, messageOrder } = useChatEvents(events);

    // Auto-scroll to bottom when new events arrive
    useEffect(() => {
        if (scrollAreaRef.current && isOpen) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [events, isOpen]);

    const handleToggleToolCall = (stepId: string, expanded: boolean) => {
        const next = new Set(expandedToolCalls);
        if (expanded) {
            next.add(stepId);
        } else {
            next.delete(stepId);
        }
        setExpandedToolCalls(next);
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
                <RunHistoryChatDrawerHeader
                    trigger={trigger}
                    status={status}
                    filtered={filtered}
                    runs={runs}
                    currentRunIndex={currentRunIndex}
                    onNavigate={onNavigate}
                    isFullscreen={isFullscreen}
                    onFullscreenChange={handleFullscreenChange}
                />
                <div className={cn(
                    "flex-1 overflow-hidden min-h-0",
                    isFullscreen && "mx-auto w-full"
                )}>
                    <ScrollArea ref={scrollAreaRef} className={cn(
                        "h-full pb-6 select-text",
                        isFullscreen ? "px-8" : "px-4"
                    )}>
                        <div className="py-2 pr-2 select-text space-y-4">
                            <EventList
                                events={events}
                                messageOrder={messageOrder}
                                toolCallMap={toolCallMap}
                                accumulatedMessages={accumulatedMessages}
                                expandedToolCalls={expandedToolCalls}
                                onToggleToolCall={handleToggleToolCall}
                                isLoading={isLoading}
                                status={status}
                                isActiveRun={isActiveRun}
                            />
                            <RunTimestamps
                                startTimestamp={startTimestamp}
                                endTimestamp={endTimestamp}
                            />
                        </div>
                    </ScrollArea>
                </div>
            </DrawerContent>
        </Drawer>
    );
}

