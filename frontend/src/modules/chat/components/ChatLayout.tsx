import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { type ModelRequest } from "terse-types"

import type { ToolApprovalResponseOptions } from "@/lib/socket"

import type { Turn } from "../turnModel"

import { AwaitingResponseAnimation } from "./AwaitingResponseAnimation"
import ChatInput, { type ChatInputHandle } from "./ChatInput"
import { TurnView } from "./TurnView"

interface ChatLayoutProps {
    turns: Turn[]
    isPendingAssistantResponse: boolean
    isCancelling?: boolean
    onCancel?: () => Promise<void> | void
    onSendMessage: (message: string) => void
    onSendModelRequest?: (request: ModelRequest) => void
    input: string
    setInput: (input: string) => void
    placeholders?: string[]
    EmptyContentPlaceholder?: React.ReactNode
    onApprove?: (stepId: string, options?: ToolApprovalResponseOptions) => void
    onReject?: (stepId: string, options?: ToolApprovalResponseOptions) => void
    onMultipleChoiceAnswer?: (questionId: string, value: string) => void
    inputSize?: "small" | "medium" | "large"
    showPlaceholderChips?: boolean
}

export interface ChatLayoutHandle {
    scrollToBottom: () => void
    focus: () => void
}

export const ChatLayout = forwardRef<ChatLayoutHandle, ChatLayoutProps>(function ChatLayout(
    {
        turns,
        isPendingAssistantResponse,
        isCancelling = false,
        onSendMessage,
        input,
        setInput,
        placeholders = ["Type a message…"],
        EmptyContentPlaceholder,
        onApprove,
        onReject,
        onCancel,
        onMultipleChoiceAnswer,
        inputSize = "small",
        showPlaceholderChips = false
    },
    ref
) {
    const [showScrollIndicator, setShowScrollIndicator] = useState(false)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const isNearBottomRef = useRef(true)
    const chatInputRef = useRef<ChatInputHandle>(null)

    // With flex-col-reverse, scrollTop = 0 is the bottom (newest content).
    // Scrolling up moves scrollTop away from 0 (negative in some browsers,
    // positive in others), so we use Math.abs to handle both conventions.
    const checkScrollPosition = () => {
        const container = scrollContainerRef.current
        if (!container) return

        const threshold = 100
        const distanceFromBottom = Math.abs(container.scrollTop)
        const isNearBottom = distanceFromBottom <= threshold

        isNearBottomRef.current = isNearBottom
        setShowScrollIndicator(!isNearBottom)
    }

    // Set up scroll listener
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        checkScrollPosition()
        container.addEventListener("scroll", checkScrollPosition)

        return () => {
            container.removeEventListener("scroll", checkScrollPosition)
        }
    }, [])

    // Expose scrollToBottom and focus to parent via ref
    useImperativeHandle(ref, () => ({
        scrollToBottom: () => {
            const container = scrollContainerRef.current
            if (container) {
                container.scrollTo({ top: 0, behavior: "smooth" })
            }
        },
        focus: () => {
            chatInputRef.current?.focus()
        }
    }))

    // Smooth scroll for button click
    const handleScrollButtonClick = () => {
        const container = scrollContainerRef.current
        if (container) {
            container.scrollTo({ top: 0, behavior: "smooth" })
        }
    }

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
            <div ref={scrollContainerRef} data-chat-scroll-container="true" className="chat-scrollbar flex flex-1 flex-col-reverse overflow-y-auto px-4 pb-7 pt-5 select-text sm:px-6 sm:pb-9 sm:pt-7">
                <div className="flex-grow" />
                <div ref={contentRef} className="mx-auto w-full max-w-3xl space-y-4 sm:space-y-5">
                    {turns.map(turn => (
                        <TurnView key={turn.id} turn={turn} onApprove={onApprove} onReject={onReject} onSendMessage={onSendMessage} onMultipleChoiceAnswer={onMultipleChoiceAnswer} />
                    ))}

                    {isPendingAssistantResponse && <AwaitingResponseAnimation />}

                    {turns.length === 0 && EmptyContentPlaceholder}
                </div>
            </div>

            {/* Scroll down indicator */}
            <AnimatePresence>
                {showScrollIndicator && (
                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        type="button"
                        onClick={handleScrollButtonClick}
                        className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2
                            flex items-center justify-center
                            size-10 max-md:size-11 rounded-full border border-border bg-card
                            text-muted-foreground shadow-[var(--shadow-popover)]
                            transition-[background-color,color,transform] duration-200 ease-out
                            hover:-translate-y-0.5 hover:bg-accent hover:text-foreground"
                        aria-label="Scroll to bottom"
                    >
                        <ChevronDown className="size-5" />
                    </motion.button>
                )}
            </AnimatePresence>

            <div className="flex-shrink-0 border-t border-border/70 bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pt-4">
                <div className="mx-auto w-full max-w-3xl">
                    <ChatInput
                        ref={chatInputRef}
                        sendMessage={onSendMessage}
                        input={input}
                        setInput={setInput}
                        placeholders={placeholders}
                        disabled={isPendingAssistantResponse || isCancelling}
                        isGenerating={isPendingAssistantResponse}
                        isCancelling={isCancelling}
                        onCancel={onCancel}
                        inputSize={inputSize}
                        showPlaceholderChips={showPlaceholderChips}
                    />
                </div>
            </div>
        </div>
    )
})
