import GlowingTextField, { Size } from "../GlowingTextField";
import { useSnippetNavigationContext } from "../../context/SnippetNavigationContext";
import { useEffect, useRef } from "react";

function ChatInput({ sendMessage, input, setInput, placeholders }: { sendMessage: (message: string) => void, input: string, setInput: (input: string) => void, placeholders: string[] }) {
    const navigation = useSnippetNavigationContext();
    const prevSelectedRef = useRef<number | null>(null);

    // Track focus override based on state transitions
    const focusOverride = (() => {
        const hadSelection = prevSelectedRef.current !== null;
        const hasSelection = navigation.selectedSnippetIndex !== null;
        
        // If we went from having a selection to no selection, force focus
        if (hadSelection && !hasSelection) {
            return true;
        }
        
        // If we have a selection, force blur
        if (hasSelection) {
            return false;
        }
        
        // Otherwise, no override
        return null;
    })();

    // Update previous selection state
    useEffect(() => {
        prevSelectedRef.current = navigation.selectedSnippetIndex;
    }, [navigation.selectedSnippetIndex]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            // Check if a snippet is selected - if so, don't send message
            if (navigation.selectedSnippetIndex !== null) {
                console.log('Enter pressed but snippet is selected - not sending message');
                return;
            }
            
            e.preventDefault();
            sanitizeAndSendMessage(input);
        }
    };

    const sanitizeAndSendMessage = (message: string) => {
        // Trim whitespace and check if message is empty
        const sanitizedMessage = message.trim();
        
        if (!sanitizedMessage || sanitizedMessage.length === 0) {
            return; // Don't send empty messages
        }
        
        // Basic sanitization for LLM input
        // Remove any potential script tags or dangerous content
        const cleanMessage = sanitizedMessage
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim();
        
        if (!cleanMessage) {
            return; // Don't send if sanitization resulted in empty message
        }
        
        sendMessage(cleanMessage);
    };

    return (
        <div className="flex space-x-3">
            <div className="flex-1">
                <GlowingTextField
                    isLoading={false}
                    onInputChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    inputValue={input}
                    placeholders={placeholders}
                    compact={true}
                    size={Size.Small}
                    autoFocus={true}
                    focusOverride={focusOverride}
                />
            </div>
            <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={() => sanitizeAndSendMessage(input)}
                disabled={!input.trim()}
            >
                Send
            </button>
        </div>
    );
}

export default ChatInput;