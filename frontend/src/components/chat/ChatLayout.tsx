import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"

export type CTAChip = { label: string; prompt: string }

import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown } from "lucide-react"

import { type ModelRequest } from "../../shared/ModelEvents"

import { Button } from "../ui/button"
import { AwaitingResponseAnimation } from "./AwaitingResponseAnimation"
import ChatInput, { type ChatInputHandle } from "./ChatInput"
import { type Turn, TurnView } from "./Turn"

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
    onApprove?: (stepId: string) => void
    onReject?: (stepId: string) => void
    onMultipleChoiceAnswer?: (questionId: string, value: string) => void
    inputSize?: "small" | "medium" | "large"
    showPlaceholderChips?: boolean
    ctaChips?: CTAChip[]
    onCtaChipClick?: (chip: CTAChip) => void
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
        placeholders = ["Type a message..."],
        EmptyContentPlaceholder,
        onApprove,
        onReject,
        onCancel,
        onMultipleChoiceAnswer,
        inputSize = "small",
        showPlaceholderChips = false,
        ctaChips,
        onCtaChipClick
    },
    ref
) {
    const [showScrollIndicator, setShowScrollIndicator] = useState(false)
    const [isLatestTextComplete, setIsLatestTextComplete] = useState(false)
    const [ctaChipsDismissed, setCtaChipsDismissed] = useState(false)
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

    useEffect(() => {
        if (isPendingAssistantResponse) setIsLatestTextComplete(false)
    }, [isPendingAssistantResponse])

    useEffect(() => {
        setCtaChipsDismissed(false)
    }, [ctaChips])

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
    const lastAssistantTurnIndex = turns.reduce((last, turn, i) => (turn.role === "assistant" && turn.text.length > 0 ? i : last), -1)
    const showCtaChips = (ctaChips?.length ?? 0) > 0 && !ctaChipsDismissed && isLatestTextComplete && !isPendingAssistantResponse

    return (
        <div className={`h-full w-full bg-background backdrop-blur-sm shadow-lg transition-opacity duration-300 opacity-100 rounded-lg flex flex-col relative`}>
            <div ref={scrollContainerRef} className="flex-1 flex flex-col-reverse overflow-y-auto p-4 select-text">
                <div className="flex-grow" />
                <div ref={contentRef} className="space-y-1">
                    {turns.map((turn, index) => (
                        <TurnView
                            key={index}
                            {...turn}
                            isLatestAssistantTurn={index === lastAssistantTurnIndex}
                            onAssistantTextDisplayComplete={() => setIsLatestTextComplete(true)}
                            onApprove={onApprove}
                            onReject={onReject}
                            onMultipleChoiceAnswer={onMultipleChoiceAnswer}
                        />
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

            <AnimatePresence>
                {showCtaChips && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-wrap gap-2 px-4 pt-3 pb-2"
                    >
                        {ctaChips!.map(chip => (
                            <Button
                                key={chip.label}
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    onSendMessage(chip.prompt)
                                    setCtaChipsDismissed(true)
                                    onCtaChipClick?.(chip)
                                }}
                                className="rounded-full px-4 h-11 text-sm font-normal text-muted-foreground hover:text-foreground border-border/60 hover:border-border bg-secondary/40 hover:bg-secondary/80 transition-all duration-200 shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                {chip.label}
                            </Button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-shrink-0">
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
    )
})
