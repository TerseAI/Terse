import { useState } from 'react';
import { ModelRequest } from '../../../shared/ModelEvents';

interface UseChatInputOptions {
    connection: {
        connection: {
            sendMessage: (message: ModelRequest) => void;
        } | null;
    };
    onUserMessage?: (message: string) => void;
}

export function useChatInput({ connection, onUserMessage }: UseChatInputOptions) {
    const [input, setInput] = useState('');

    const sendMessage = async (message: string) => {
        setInput('');
        onUserMessage?.(message);
        
        if (connection.connection) {
            const modelRequest: ModelRequest = {
                type: 'SendModelRequest',
                user_message: message,
                visible_actors: [],
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };
            
            try {
                await connection.connection.sendMessage(modelRequest);
            } catch (error) {
                console.error('Failed to send message:', error);
            }
        }
    };

    return {
        input,
        setInput,
        sendMessage
    };
} 