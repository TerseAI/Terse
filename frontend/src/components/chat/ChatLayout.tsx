import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { AwaitingResponseAnimation } from './AwaitingResponseAnimation';
import { type Turn, TurnView } from './Turn';
import ChatInput from './ChatInput';
import { type ModelRequest, type UploadedFile } from '../../shared/ModelEvents';

interface ChatLayoutProps {
    turns: Turn[];
    isPendingAssistantResponse: boolean;
    onSendMessage: (message: string, uploadedFiles?: UploadedFile[]) => void;
    onSendModelRequest?: (request: ModelRequest) => void;
    input: string;
    setInput: (input: string) => void;
    placeholders?: string[];
    EmptyContentPlaceholder?: React.ReactNode;
    onApprove?: (stepId: string) => void;
    onReject?: (stepId: string) => void;
    runId?: string;
}

export interface ChatLayoutHandle {
    scrollToBottom: () => void;
}

export const ChatLayout = forwardRef<ChatLayoutHandle, ChatLayoutProps>(function ChatLayout({
    turns,
    isPendingAssistantResponse,
    onSendMessage,
    input,
    setInput,
    placeholders = ["Type a message..."],
    EmptyContentPlaceholder,
    onApprove,
    onReject,
    runId,
}, ref) {
    const [showScrollIndicator, setShowScrollIndicator] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const isNearBottomRef = useRef(true);

    // Check if user is near the bottom and update state accordingly
    const checkScrollPosition = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const threshold = 100;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        const isNearBottom = distanceFromBottom <= threshold;
        
        isNearBottomRef.current = isNearBottom;
        setShowScrollIndicator(!isNearBottom);
    };

    // Set up scroll listener
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        checkScrollPosition();
        container.addEventListener('scroll', checkScrollPosition);

        return () => {
            container.removeEventListener('scroll', checkScrollPosition);
        };
    }, []);

    // Watch content height changes - this handles token streaming animation
    useEffect(() => {
        const content = contentRef.current;
        if (!content) return;

        const resizeObserver = new ResizeObserver(() => {
            if (isNearBottomRef.current) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }
            checkScrollPosition();
        });

        resizeObserver.observe(content);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // Expose scrollToBottom to parent via ref (instant scroll for programmatic calls)
    useImperativeHandle(ref, () => ({
        scrollToBottom: () => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }));

    // Smooth scroll for button click
    const handleScrollButtonClick = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className={`h-full w-full backdrop-blur-sm shadow-lg transition-opacity duration-300 opacity-100 rounded-lg flex flex-col relative`}>
            <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 select-text"
            >
                <div ref={contentRef} className="space-y-4">
                    {turns.map((turn, index) => (
                        <TurnView key={index} {...turn} onApprove={onApprove} onReject={onReject} />
                    ))}

                    {isPendingAssistantResponse && (
                        <AwaitingResponseAnimation />
                    )}

                    {turns.length === 0 && (
                        EmptyContentPlaceholder
                    )}
                    
                    {/* Scroll anchor element */}
                    <div ref={messagesEndRef} className="h-1" />
                </div>
            </div>

            {/* Scroll down indicator */}
            <AnimatePresence>
                {showScrollIndicator && (
                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        onClick={handleScrollButtonClick}
                        className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 
                            flex items-center justify-center
                            w-10 h-10 rounded-full
                            bg-secondary backdrop-blur-md
                            border border-border
                            shadow-lg shadow-black/20
                            hover:bg-accent 
                            hover:scale-105
                            transition-all duration-200 ease-out
                            cursor-pointer"
                        aria-label="Scroll to bottom"
                    >
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
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
                    runId={runId}
                />
            </div>
        </div>
    );
});
