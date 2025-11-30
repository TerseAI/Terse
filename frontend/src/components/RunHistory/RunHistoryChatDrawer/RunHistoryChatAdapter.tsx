import { useMemo } from 'react';
import { useChatHistory } from '@/hooks/api/useChatHistory';
import { useChannelChatEvents } from '@/hooks/useChannelChatEvents';
import { useRunHistoryTurns } from '@/components/RunHistory/RunHistoryChatDrawer/hooks/useRunHistoryTurns';
import { Chat } from '@/components/chat/Chat';
import { RunHistoryStatus, RunHistoryModelEvent } from '@/shared/RunHistoryTypes';
import { ModelEvent, ModelRequest } from '@/shared/ModelEvents';
import { Turn } from '@/components/chat/Turn';
import { subscribeToChatEvents, sendChatMessage } from '@/socket';
import { type ChatEventSubscription } from '@/components/chat/hooks/useCompletionSocket';
import type { RunHistoryModelSocketEvent } from '@/shared/RunHistoryTypes';

type RunHistoryChatAdapterProps = {
    runId: string;
    status: RunHistoryStatus;
    children?: (props: { 
        turns: Turn[]; 
        isLoading: boolean; 
        runId: string;
        startTimestamp?: string;
        endTimestamp?: string;
        subscribeToEvents?: ChatEventSubscription | null;
        sendMessage: (message: ModelRequest) => void;
        currentStatus: RunHistoryStatus;
    }) => React.ReactNode;
};

export default function RunHistoryChatAdapter({ runId, status, children }: RunHistoryChatAdapterProps) {
    // Fetch History (API)
    const { events: historyEvents, isLoading, startTimestamp, endTimestamp, status: apiStatus } = useChatHistory(runId);

    // Use API status if available, otherwise fall back to prop status
    const currentStatus = (apiStatus as RunHistoryStatus) || status;
    const isActiveRun = currentStatus === 'in_progress';
    
    // Subscribe to Realtime Events (Socket)
    // Pass null if not active to skip subscription
    const { events: realtimeEvents } = useChannelChatEvents(isActiveRun ? runId : null);

    // Merge Events: Combine historical (API) and realtime (socket) events
    // Use event.id as the unique key since it's guaranteed to be unique
    const events: (ModelEvent & { isHistorical?: boolean })[] = useMemo(() => {
        const eventMap = new Map<string, RunHistoryModelEvent & { isHistorical?: boolean }>();
        const historicalEventIds = new Set<string>();
        const historicalEventKeys = new Set<string>(); // Compound key: step_id:type for events without IDs
        
        // Add history events first (base truth) and tag them
        historyEvents.forEach(event => {
            // Use event.id as the primary key (unique database ID)
            const key = event.id || `${event.step_id}:${event.type}` || Math.random().toString();
            eventMap.set(key, { ...event, isHistorical: true });
            
            // Track IDs and compound keys for deduplication
            if (event.id) {
                historicalEventIds.add(event.id);
            }
            if (event.step_id) {
                historicalEventKeys.add(`${event.step_id}:${event.type}`);
            }
        });

        // Add realtime events (updates/new events)
        // Skip events that are already in history
        realtimeEvents.forEach(event => {
            // First check by event.id (most precise)
            if (event.id && historicalEventIds.has(event.id)) {
                return;
            }
            
            // Then check by compound key (step_id:type) to avoid duplicates
            // Multiple events can share step_id, but they should have different types
            if (event.step_id) {
                const compoundKey = `${event.step_id}:${event.type}`;
                if (historicalEventKeys.has(compoundKey)) {
                    return;
                }
            }
            
            // Use event.id as the key, or compound key if no ID
            const key = event.id || `${event.step_id}:${event.type}` || Math.random().toString();
            
            // Only add if we don't already have this event
            if (!eventMap.has(key)) {
                eventMap.set(key, { ...event, isHistorical: false });
            }
        });
        
        // Sort by timestamp, then by id for deterministic ordering
        const sorted = Array.from(eventMap.values()).sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            if (timeA !== timeB) {
                return timeA - timeB;
            }
            // If timestamps are equal, sort by id for deterministic ordering
            const idA = a.id || '';
            const idB = b.id || '';
            return idA.localeCompare(idB);
        });
        
        return sorted;
    }, [historyEvents, realtimeEvents]);

    // Convert to Turns
    const turns = useRunHistoryTurns(events);

    // Create subscription function for run history
    const subscribeToEvents: ChatEventSubscription | null = useMemo(() => {
        if (!isActiveRun) return null;
        
        return (callback: (payload: RunHistoryModelSocketEvent) => void) => {
            return subscribeToChatEvents(runId, callback);
        };
    }, [isActiveRun, runId]);

    // Create send message function for run history
    const sendMessage = (message: ModelRequest) => {
        console.log('Sending message', message, runId);
        sendChatMessage(runId, message);
    };

    if (children) {
        return <>{children({ turns, isLoading, runId, startTimestamp, endTimestamp, subscribeToEvents, sendMessage, currentStatus })}</>;
    }

    return (
        <Chat 
            turns={turns}
            subscribeToEvents={subscribeToEvents}
            sendMessage={sendMessage}
            EmptyContentPlaceholder={isLoading ? <div className="p-4 text-center text-muted-foreground">Loading history...</div> : <div className="p-4 text-center text-muted-foreground">No events found</div>}
        />
    );
}

