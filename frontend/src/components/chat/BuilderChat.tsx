import { useId } from 'react';
import { Chat } from './Chat';
import { subscribeToBuilderChat, sendBuilderMessage } from '@/socket';
import { ModelRequest, SendModelRequest } from '@/shared/ModelEvents';
import { ChatEventPayload } from './hooks/useCompletionSocket';

type BuilderChatProps = {
    getStateJSON: () => Record<string, unknown>;
    sessionId?: string;
};

export function BuilderChat({ getStateJSON, sessionId: externalSessionId }: BuilderChatProps) {
    const generatedId = useId();
    const sessionId = externalSessionId ?? generatedId;

    function subscribeToEvents(callback: (payload: ChatEventPayload) => void) {
        return subscribeToBuilderChat(sessionId, (payload) => {
            callback({
                runHistoryModelEvent: payload.event,
            });
        });
    }

    function sendMessage(message: ModelRequest) {
        if (message.type === 'SendModelRequest') {
            const enrichedMessage: { type: 'SendModelRequest' } & SendModelRequest = {
                ...message,
                ui_state: getStateJSON(),
            };
            sendBuilderMessage(sessionId, enrichedMessage);
        } else {
            sendBuilderMessage(sessionId, message);
        }
    }

    return (
        <div className="h-full flex min-h-0">
            <Chat
                subscribeToEvents={subscribeToEvents}
                sendMessage={sendMessage}
            />
        </div>
    );
}
