import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { type ModelRequest } from "../../shared/ModelEvents"

import { AwaitingResponseAnimation } from "./AwaitingResponseAnimation"
import ChatInput, { type ChatInputHandle } from "./ChatInput"
import { type Turn, TurnView } from "./Turn"

export type CTAChip = { label: string; description?: string; prompt: string }

const CHIPS_PER_PAGE = 3

const chipsContainerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
    exit: { opacity: 0, transition: { duration: 0.12 } }
}

const chipItemVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const } }
}

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
    const [ctaChipPage, setCtaChipPage] = useState(0)
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
        setCtaChipPage(0)
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
    const totalChipPages = Math.ceil((ctaChips?.length ?? 0) / CHIPS_PER_PAGE)
    const visibleChips = ctaChips?.slice(ctaChipPage * CHIPS_PER_PAGE, (ctaChipPage + 1) * CHIPS_PER_PAGE) ?? []

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

            <div aria-live="polite" aria-atomic="true">
                <AnimatePresence>
                    {showCtaChips && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.2 }}
                            role="group"
                            aria-label="Suggested next steps"
                            className="flex flex-col gap-2 px-0 pb-2"
                        >
                            {totalChipPages > 1 && (
                                <div className="flex items-center justify-end gap-1">
                                    <span className="text-xs text-muted-foreground/60 mr-1">
                                        {ctaChipPage + 1}/{totalChipPages}
                                    </span>
                                    <button
                                        onClick={() => setCtaChipPage(p => Math.max(0, p - 1))}
                                        disabled={ctaChipPage === 0}
                                        className="p-0.5 rounded hover:bg-secondary disabled:opacity-30 transition-colors"
                                        aria-label="Previous suggestions"
                                    >
                                        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <button
                                        onClick={() => setCtaChipPage(p => Math.min(totalChipPages - 1, p + 1))}
                                        disabled={ctaChipPage === totalChipPages - 1}
                                        className="p-0.5 rounded hover:bg-secondary disabled:opacity-30 transition-colors"
                                        aria-label="Next suggestions"
                                    >
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                </div>
                            )}
                            <AnimatePresence mode="wait">
                                <motion.div key={ctaChipPage} variants={chipsContainerVariants} initial="hidden" animate="visible" exit="exit" className="grid grid-cols-3 gap-2">
                                    {visibleChips.map(chip => (
                                        <motion.button
                                            key={chip.label}
                                            variants={chipItemVariants}
                                            whileHover={{ y: -2, scale: 1.02, transition: { duration: 0.15, ease: [0.25, 1, 0.5, 1] } }}
                                            whileTap={{ scale: 0.97, transition: { duration: 0.1 } }}
                                            onClick={() => {
                                                onSendMessage(chip.prompt)
                                                setCtaChipsDismissed(true)
                                                onCtaChipClick?.(chip)
                                            }}
                                            className="flex flex-col items-start text-left px-4 py-3 rounded-xl border border-border bg-secondary/50 hover:bg-secondary hover:shadow-md transition-colors transition-shadow cursor-pointer"
                                        >
                                            <span className="text-sm font-semibold text-foreground leading-snug">{chip.label}</span>
                                            {chip.description && <span className="text-sm text-muted-foreground leading-snug mt-0.5">{chip.description}</span>}
                                        </motion.button>
                                    ))}
                                </motion.div>
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

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
