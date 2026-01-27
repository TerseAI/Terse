import { useMemo, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Chat } from './Chat';
import { subscribeToBuilderChat, sendBuilderMessage } from '@/socket';
import { ModelRequest, SendModelRequest } from '@/shared/ModelEvents';
import { ChatEventPayload } from './hooks/useCompletionSocket';

type BuilderChatProps = {
    getStateJSON: () => string;
    agentId?: string | null;
};

export function BuilderChat({ getStateJSON, agentId }: BuilderChatProps) {
    const generatedId = useMemo(() => uuidv4(), []);
    const sessionId = agentId ?? generatedId;
    const previousAgentIdRef = useRef<string | null | undefined>(agentId);
    
    useEffect(() => {
        // Only reset if agentId actually changed (not on initial mount)
        if (previousAgentIdRef.current !== undefined && previousAgentIdRef.current !== agentId) {
            // The key change will handle the reset, but we can log it for debugging
            console.log('[BuilderChat] Agent changed, resetting chat', { 
                previous: previousAgentIdRef.current, 
                current: agentId,
                sessionId 
            });
        }
        previousAgentIdRef.current = agentId;
    }, [agentId, sessionId]);

    const subscribeToEvents = (callback: (payload: ChatEventPayload) => void) => {
        console.log('[BuilderChat] subscribeToEvents called', { sessionId });
        const unsubscribe = subscribeToBuilderChat(sessionId, (payload) => {
            console.log('[BuilderChat] Event received', payload.event.type);
            callback({
                runHistoryModelEvent: payload.event,
            });
        });
        console.log('[BuilderChat] Subscription created');
        return unsubscribe;
    };

    const sendMessage = useCallback((message: ModelRequest) => {
        if (message.type === 'SendModelRequest') {
            const enrichedMessage: { type: 'SendModelRequest' } & SendModelRequest = {
                ...message,
                ui_state: getStateJSON(),
            };
            sendBuilderMessage(sessionId, enrichedMessage);
        } else {
            sendBuilderMessage(sessionId, message);
        }
    }, [sessionId, getStateJSON]);

    return (
        <div className="h-full flex min-h-0">
            <Chat
                key={sessionId}
                subscribeToEvents={subscribeToEvents}
                sendMessage={sendMessage}
                addUserTurnsLocally={true}
            />
        </div>
    );
}
