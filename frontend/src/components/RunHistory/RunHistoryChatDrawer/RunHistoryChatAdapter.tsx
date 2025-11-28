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
    const { events: historyEvents, isLoading, startTimestamp, endTimestamp, status: apiStatus, mutate: mutateChatHistory } = useChatHistory(runId);

    console.log('historyEvents:', historyEvents);
    // Use API status if available, otherwise fall back to prop status
    const currentStatus = (apiStatus as RunHistoryStatus) || status;
    const isActiveRun = currentStatus === 'in_progress';
    
    // Subscribe to Realtime Events (Socket)
    // Pass null if not active to skip subscription
    const { events: realtimeEvents } = useChannelChatEvents(isActiveRun ? runId : null);

    // step id, represents a grouping of data.
    // Merge Events
    const events: (ModelEvent & { isHistorical?: boolean })[] = useMemo(() => {
        const historicalEventMap = new Map<string, RunHistoryModelEvent & { isHistorical?: boolean }>();
        const eventMap = new Map<string, RunHistoryModelEvent & { isHistorical?: boolean }>();
        
        // Add history events first (base truth) and tag them
        historyEvents.forEach(event => {
            if (event.step_id) {
                historicalEventMap.set(event.step_id, { ...event, isHistorical: true });
                eventMap.set(event.step_id, { ...event, isHistorical: true });
            }
        });

        // ok so we have 
        
        // Add realtime events (updates/new events)
        realtimeEvents.forEach(event => {
            const isAlreadyInHistory = historicalEventMap.has(event.step_id);
            if (isAlreadyInHistory) {
                return;
            }
            eventMap.set(event.id, { ...event, isHistorical: false });
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
