import { useState, useEffect, useRef } from 'react';
import { type ModelRequest } from '../../../shared/ModelEvents';

interface UseChatInputOptions {
    sendMessage: (message: ModelRequest) => void;
    onUserMessage?: (message: string) => void;
    initialPrompt?: string;
}

export function useChatInput({ sendMessage: sendModelRequest, onUserMessage, initialPrompt }: UseChatInputOptions) {
    const [input, setInput] = useState('');
    const lastSetPromptRef = useRef<string | undefined>(undefined);
    
    // Set initial prompt when provided and input is empty
    // Only set once when initialPrompt changes from undefined to a value, or when it changes to a different value
    useEffect(() => {
        if (initialPrompt && !input && initialPrompt !== lastSetPromptRef.current) {
            setInput(initialPrompt);
            lastSetPromptRef.current = initialPrompt;
        }
        
        // Reset tracking when initialPrompt is cleared
        if (!initialPrompt) {
            lastSetPromptRef.current = undefined;
        }
    }, [initialPrompt, input]);

    const sendMessage = async (message: string) => {
        setInput('');
        onUserMessage?.(message);
        
        const modelRequest: ModelRequest = {
            type: 'SendModelRequest',
            user_message: message,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        try {
            sendModelRequest(modelRequest);
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    return {
        input,
        setInput,
        sendMessage
    };
} 
