import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown } from "lucide-react"

import { type ModelRequest } from "../../shared/ModelEvents"

import { AwaitingResponseAnimation } from "./AwaitingResponseAnimation"
import ChatInput, { type ChatInputHandle } from "./ChatInput"
import { type Turn, TurnView } from "./Turn"

interface ChatLayoutProps {
    turns: Turn[]
    isPendingAssistantResponse: boolean
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
}

export interface ChatLayoutHandle {
    scrollToBottom: () => void
    focus: () => void
}

export const ChatLayout = forwardRef<ChatLayoutHandle, ChatLayoutProps>(function ChatLayout(
    {
        turns,
        isPendingAssistantResponse,
        onSendMessage,
        input,
        setInput,
        placeholders = ["Type a message..."],
        EmptyContentPlaceholder,
        onApprove,
        onReject,
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
    const hasCompletedInitialScrollRef = useRef(false)
    const scrollRafIdRef = useRef<number | null>(null)
    const chatInputRef = useRef<ChatInputHandle>(null)

    const cancelPendingScrollRaf = useCallback(() => {
        if (scrollRafIdRef.current !== null) {
            window.cancelAnimationFrame(scrollRafIdRef.current)
            scrollRafIdRef.current = null
        }
    }, [])

    const getDistanceFromBottom = useCallback((container: HTMLDivElement) => {
        return container.scrollHeight - container.scrollTop - container.clientHeight
    }, [])

    // Check if user is near the bottom and update state accordingly.
    const checkScrollPosition = useCallback(() => {
        const container = scrollContainerRef.current
        if (!container) return false

        const threshold = 100
        const distanceFromBottom = getDistanceFromBottom(container)
        const isNearBottom = distanceFromBottom <= threshold

        isNearBottomRef.current = isNearBottom
        setShowScrollIndicator(prev => (prev === !isNearBottom ? prev : !isNearBottom))

        return distanceFromBottom <= 1
    }, [getDistanceFromBottom])

    // Keep trying for a few frames so delayed layout/measurement still lands exactly at bottom.
    const ensureScrollToBottom = useCallback(
        (maxFrames = 45, restart = false) => {
            const container = scrollContainerRef.current
            if (!container) return

            if (restart) {
                cancelPendingScrollRaf()
            } else if (scrollRafIdRef.current !== null) {
                return
            }

            let frame = 0
            const tick = () => {
                const activeContainer = scrollContainerRef.current
                if (!activeContainer) {
                    scrollRafIdRef.current = null
                    return
                }

                activeContainer.scrollTop = activeContainer.scrollHeight
                frame += 1

                const distanceFromBottom = getDistanceFromBottom(activeContainer)
                if (distanceFromBottom <= 1) {
                    hasCompletedInitialScrollRef.current = true
                    isNearBottomRef.current = true
                    setShowScrollIndicator(false)
                    scrollRafIdRef.current = null
                    return
                }

                if (frame >= maxFrames) {
                    scrollRafIdRef.current = null
                    checkScrollPosition()
                    return
                }

                scrollRafIdRef.current = window.requestAnimationFrame(tick)
            }

            scrollRafIdRef.current = window.requestAnimationFrame(tick)
        },
        [cancelPendingScrollRaf, checkScrollPosition, getDistanceFromBottom]
    )

    // Set up scroll listener
    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        checkScrollPosition()
        container.addEventListener("scroll", checkScrollPosition, { passive: true })

        return () => {
            container.removeEventListener("scroll", checkScrollPosition)
        }
    }, [checkScrollPosition])

    // Watch content and container size changes (streaming text, drawer/layout resize).
    useEffect(() => {
        const content = contentRef.current
        const container = scrollContainerRef.current
        if (!content || !container) return

        const resizeObserver = new ResizeObserver(() => {
            if (!hasCompletedInitialScrollRef.current) {
                ensureScrollToBottom()
                return
            }

            if (isNearBottomRef.current) {
                container.scrollTop = container.scrollHeight
                setShowScrollIndicator(false)
                return
            }

            checkScrollPosition()
        })

        resizeObserver.observe(content)
        resizeObserver.observe(container)

        return () => {
            resizeObserver.disconnect()
        }
    }, [checkScrollPosition, ensureScrollToBottom])

    // Trigger initial anchoring and keep following new turns while user is pinned.
    useEffect(() => {
        if (turns.length === 0) {
            hasCompletedInitialScrollRef.current = false
            isNearBottomRef.current = true
            setShowScrollIndicator(false)
            cancelPendingScrollRaf()
            return
        }

        if (!hasCompletedInitialScrollRef.current) {
            ensureScrollToBottom()
            return
        }

        if (isNearBottomRef.current) {
            const container = scrollContainerRef.current
            if (!container) return
            container.scrollTop = container.scrollHeight
            setShowScrollIndicator(false)
        }
    }, [cancelPendingScrollRaf, ensureScrollToBottom, turns])

    useEffect(() => {
        return () => {
            cancelPendingScrollRaf()
        }
    }, [cancelPendingScrollRaf])

    // Expose scrollToBottom and focus to parent via ref
    useImperativeHandle(
        ref,
        () => ({
            scrollToBottom: () => {
                isNearBottomRef.current = true
                setShowScrollIndicator(false)
                ensureScrollToBottom(45, true)
            },
            focus: () => {
                chatInputRef.current?.focus()
            }
        }),
        [ensureScrollToBottom]
    )

    // Smooth scroll for button click
    const handleScrollButtonClick = () => {
        const container = scrollContainerRef.current
        if (!container) return

        hasCompletedInitialScrollRef.current = true
        isNearBottomRef.current = true
        setShowScrollIndicator(false)
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
    }

    const handleSendMessage = useCallback(
        (message: string) => {
            hasCompletedInitialScrollRef.current = true
            isNearBottomRef.current = true
            setShowScrollIndicator(false)
            ensureScrollToBottom(45, true)
            onSendMessage(message)
        },
        [ensureScrollToBottom, onSendMessage]
    )

    return (
        <div className={`h-full w-full backdrop-blur-sm shadow-lg transition-opacity duration-300 opacity-100 rounded-lg flex flex-col relative`}>
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 select-text">
                <div ref={contentRef} className="space-y-4">
                    {turns.map((turn, index) => (
                        <TurnView key={index} {...turn} onApprove={onApprove} onReject={onReject} onMultipleChoiceAnswer={onMultipleChoiceAnswer} />
                    ))}

                    {isPendingAssistantResponse && <AwaitingResponseAnimation />}

                    {turns.length === 0 && EmptyContentPlaceholder}

                    {/* Scroll anchor element */}
                    <div className="h-1" />
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
                    ref={chatInputRef}
                    sendMessage={handleSendMessage}
                    input={input}
                    setInput={setInput}
                    placeholders={placeholders}
                    disabled={isPendingAssistantResponse}
                    inputSize={inputSize}
                    showPlaceholderChips={showPlaceholderChips}
                />
            </div>
        </div>
    )
})
