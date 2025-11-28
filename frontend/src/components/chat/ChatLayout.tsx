import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { AwaitingResponseAnimation } from './AwaitingResponseAnimation';
import { type Turn, TurnView } from './Turn';
import ChatInput from './ChatInput';
import { type ModelRequest } from '../../shared/ModelEvents';

interface ChatLayoutProps {
    turns: Turn[];
    isPendingAssistantResponse: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
    onSendMessage: (message: string) => void;
    onSendModelRequest?: (request: ModelRequest) => void;
    input: string;
    setInput: (input: string) => void;
    placeholders?: string[];
    EmptyContentPlaceholder?: React.ReactNode;
    initialScrollToBottom?: boolean;
}

export function ChatLayout({
    turns,
    isPendingAssistantResponse,
    messagesEndRef,
    onSendMessage,
    input,
    setInput,
    placeholders = ["Type a message..."],
    EmptyContentPlaceholder,
    initialScrollToBottom = false,
}: ChatLayoutProps) {
    const [showScrollIndicator, setShowScrollIndicator] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const hasInitialScrolled = useRef(false);

    const checkScrollPosition = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const threshold = 100;
        const isNotAtBottom = container.scrollHeight - container.scrollTop > container.clientHeight + threshold;
        setShowScrollIndicator(isNotAtBottom);
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Check initial position
        checkScrollPosition();

        container.addEventListener('scroll', checkScrollPosition);
        
        // Also check on resize
        const resizeObserver = new ResizeObserver(checkScrollPosition);
        resizeObserver.observe(container);

        return () => {
            container.removeEventListener('scroll', checkScrollPosition);
            resizeObserver.disconnect();
        };
    }, [checkScrollPosition]);

    // Re-check when turns change (new messages)
    useEffect(() => {
        checkScrollPosition();
    }, [turns, checkScrollPosition]);

    // Scroll to bottom on initial load when initialScrollToBottom is enabled
    useEffect(() => {
        if (initialScrollToBottom && turns.length > 0 && !hasInitialScrolled.current) {
            hasInitialScrolled.current = true;
            // Use requestAnimationFrame to ensure DOM is ready, then scroll instantly
            requestAnimationFrame(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
            });
        }
    }, [initialScrollToBottom, turns, messagesEndRef]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messagesEndRef]);

    return (
        <div className={`h-full w-full backdrop-blur-sm shadow-lg transition-opacity duration-300 opacity-100 rounded-lg flex flex-col relative`}>
            <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
            >
                {turns.map((turn, index) => (
                    <TurnView key={index} {...turn} />
                ))}

                {isPendingAssistantResponse && (
                    <AwaitingResponseAnimation />
                )}

                {turns.length === 0 && (
                    EmptyContentPlaceholder
                )}
                
                
                {/* This is a hack to scroll to the bottom of the messages when a new message is added. */}
                <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* Scroll down indicator */}
            <AnimatePresence>
                {showScrollIndicator && (
                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        onClick={scrollToBottom}
                        className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 
                            flex items-center justify-center
                            w-10 h-10 rounded-full
                            bg-[theme(--bg-secondary)] backdrop-blur-md
                            border border-[theme(--border-primary)]
                            shadow-lg shadow-black/20
                            hover:bg-[theme(--bg-tertiary)] 
                            hover:scale-105
                            transition-all duration-200 ease-out
                            cursor-pointer"
                        aria-label="Scroll to bottom"
                    >
                        <ChevronDown className="w-5 h-5 text-[theme(--text-secondary)]" />
                    </motion.button>
                )}
            </AnimatePresence>

            <div className="flex-shrink-0">
                <ChatInput 
                    sendMessage={onSendMessage} 
                    input={input} 
                    setInput={setInput} 
                    placeholders={placeholders}
                    disabled={isPendingAssistantResponse}
                />
            </div>
        </div>
    );
} 
