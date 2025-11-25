import { useEffect, useState, useRef } from 'react';
import { subscribeToChatEvents } from '@/socket';
import type { RunHistoryModelEvent } from '@/shared/RunHistoryTypes';

export function useChannelChatEvents(runId: string | null | undefined) {
    const [events, setEvents] = useState<RunHistoryModelEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!runId) {
            setEvents([]);
            return;
        }

        setIsLoading(true);

        // Subscribe to chat events for this run
        const unsubscribe = subscribeToChatEvents(runId, (payload) => {
            // Extract the event from the socket payload and ensure timestamp is present
            const event: RunHistoryModelEvent = {
                ...payload.runHistoryModelEvent,
                timestamp: payload.runHistoryModelEvent.timestamp || new Date().toISOString(),
            };
            setEvents((prev) => [...prev, event]);
            setIsLoading(false);
        });

        unsubscribeRef.current = unsubscribe;

        // Cleanup on unmount or runId change
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            setEvents([]);
        };
    }, [runId]);

    return {
        events,
        isLoading,
    };
}

