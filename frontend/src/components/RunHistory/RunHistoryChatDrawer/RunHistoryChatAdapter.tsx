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
    }) => React.ReactNode;
};

export default function RunHistoryChatAdapter({ runId, status, children }: RunHistoryChatAdapterProps) {
    const isActiveRun = status === 'in_progress';
    
    // Fetch History (API)
    const { events: historyEvents, isLoading, startTimestamp, endTimestamp, mutate: mutateChatHistory } = useChatHistory(runId);
    
    // Subscribe to Realtime Events (Socket)
    // Pass null if not active to skip subscription
    const { events: realtimeEvents } = useChannelChatEvents(isActiveRun ? runId : null);

    // Merge Events
    const events: (ModelEvent & { isHistorical?: boolean })[] = useMemo(() => {
        // Trigger revalidation of history occasionally if needed, but useChatHistory handles it via SWR
        // We call mutate to ensure freshness on mount/update if logical
        mutateChatHistory();
        
        const eventMap = new Map<string, RunHistoryModelEvent & { isHistorical?: boolean }>();
        
        // Add history events first (base truth) and tag them
        historyEvents.forEach(event => {
            if (event.id) {
                eventMap.set(event.id, { ...event, isHistorical: true });
            }
        });
        
        // Add realtime events (updates/new events)
        realtimeEvents.forEach(event => {
            // Only add if not present or if you want to overwrite (usually socket is newer)
            if (event.id) {
                // Realtime events are NOT historical
                eventMap.set(event.id, event);
            }
        });
        
        // Sort by timestamp
        const sorted = Array.from(eventMap.values()).sort((a, b) => 
            new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
        );
        
        return sorted;
    }, [historyEvents, realtimeEvents, mutateChatHistory]);

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
        return <>{children({ turns, isLoading, runId, startTimestamp, endTimestamp, subscribeToEvents, sendMessage })}</>;
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
