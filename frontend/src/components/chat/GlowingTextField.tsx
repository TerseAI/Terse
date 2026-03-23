import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import TextareaAutosize from "react-textarea-autosize"

import { Button } from "@headlessui/react"
import { AnimatePresence, motion } from "framer-motion"
import { CircleStop, Send, Sparkles } from "lucide-react"

interface GlowingTextFieldProps {
    isLoading: boolean
    disabled: boolean
    onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
    inputValue: string
    placeholders?: string[]
    size?: Size
    shouldAllowKeyboardShortcutForFocus?: boolean
    autoFocus?: boolean
    focusOverride?: boolean | null // null = no override, true = focus, false = blur
    minRows?: number
    showBorder?: boolean
    onSend?: () => void // When provided, shows send button inside the text field
    onStop?: () => Promise<void> | void // When provided while generating, shows stop button inside the text field
    isGenerating?: boolean
    isCancelling?: boolean
    onPlaceholderSelect?: (placeholder: string) => void // When user clicks a placeholder suggestion
    showPlaceholderChips?: boolean // Show clickable placeholder chips below input
}

export enum Size {
    Small = "small",
    Medium = "medium",
    Large = "large"
}

export interface GlowingTextFieldHandle {
    focus: () => void
}

const GlowingTextField = forwardRef<GlowingTextFieldHandle, GlowingTextFieldProps>(function GlowingTextField(
    {
        isLoading,
        disabled,
        onInputChange,
        onKeyDown,
        inputValue,
        placeholders = [],
        size = Size.Medium,
        shouldAllowKeyboardShortcutForFocus = true,
        autoFocus = false,
        focusOverride = null,
        minRows,
        showBorder = false,
        onSend,
        onStop,
        isGenerating = false,
        isCancelling = false,
        onPlaceholderSelect,
        showPlaceholderChips = false
    },
    ref
) {
    const [displayedPlaceholder, setDisplayedPlaceholder] = useState<string>("")
    const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0)
    const [isTyping, setIsTyping] = useState(true)
    const [isFullyTyped, setIsFullyTyped] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const typewriterRef = useRef<{ charIndex: number; timeoutId: NodeJS.Timeout | null }>({ charIndex: 0, timeoutId: null })

    // Expose focus method to parent
    useImperativeHandle(ref, () => ({
        focus: () => textareaRef.current?.focus()
    }))

    // Handle focus override
    useEffect(() => {
        if (focusOverride === true) {
            textareaRef.current?.focus()
        } else if (focusOverride === false) {
            textareaRef.current?.blur()
        }
    }, [focusOverride])

    const isLarge = size === Size.Large

    // Track if user has typed substantial content (more than a short sentence)
    const hasSubstantialContent = inputValue.length > 100

    const getSizeClasses = () => {
        // Explicit line-height matching font size, with padding for vertical centering
        switch (size) {
            case Size.Small:
                return "text-sm leading-[14px] py-[13px] px-3"
            case Size.Large:
                return "text-lg leading-[18px] p-4"
            case Size.Medium:
            default:
                return "text-base leading-[16px] py-[14px] px-4"
        }
    }

    // Typewriter animation effect
    useEffect(() => {
        if (!placeholders || placeholders.length === 0 || inputValue.length > 0) {
            setDisplayedPlaceholder("")
            setIsFullyTyped(false)
            setIsTyping(false)
            return
        }

        const currentPlaceholder = placeholders[currentPlaceholderIndex]

        const typeNextChar = () => {
            if (typewriterRef.current.charIndex <= currentPlaceholder.length) {
                setDisplayedPlaceholder(currentPlaceholder.slice(0, typewriterRef.current.charIndex))
                typewriterRef.current.charIndex++
                typewriterRef.current.timeoutId = setTimeout(typeNextChar, 40)
            } else {
                setIsTyping(false)
                setIsFullyTyped(true)
                // Wait before moving to next placeholder
                typewriterRef.current.timeoutId = setTimeout(() => {
                    setIsTyping(true)
                    setIsFullyTyped(false)
                    typewriterRef.current.charIndex = 0
                    setCurrentPlaceholderIndex(prev => (prev + 1) % placeholders.length)
                }, 3000)
            }
        }

        // Reset and start typing
        typewriterRef.current.charIndex = 0
        setIsTyping(true)
        setIsFullyTyped(false)
        typeNextChar()

        return () => {
            if (typewriterRef.current.timeoutId) {
                clearTimeout(typewriterRef.current.timeoutId)
            }
        }
    }, [currentPlaceholderIndex, placeholders, inputValue])

    const handlePlaceholderClick = useCallback(
        (placeholder: string) => {
            if (onPlaceholderSelect) {
                onPlaceholderSelect(placeholder)
            }
            textareaRef.current?.focus()
        },
        [onPlaceholderSelect]
    )

    // Handle Tab to complete placeholder
    const handleKeyDownInternal = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Tab" && inputValue.length === 0 && displayedPlaceholder && onPlaceholderSelect) {
                e.preventDefault()
                const currentPlaceholder = placeholders[currentPlaceholderIndex]
                onPlaceholderSelect(currentPlaceholder)
                return
            }
            onKeyDown(e)
        },
        [inputValue, displayedPlaceholder, placeholders, currentPlaceholderIndex, onPlaceholderSelect, onKeyDown]
    )

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Command+K (Mac) or Ctrl+K (Windows/Linux)
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault()
                textareaRef.current?.focus()
            }
        }

        if (shouldAllowKeyboardShortcutForFocus) {
            document.addEventListener("keydown", handleKeyDown)
        }
        return () => {
            if (shouldAllowKeyboardShortcutForFocus) {
                document.removeEventListener("keydown", handleKeyDown)
            }
        }
    }, [shouldAllowKeyboardShortcutForFocus])

    // Get placeholders to show as chips (excluding current one being typed)
    const chipPlaceholders = placeholders.filter((_, idx) => idx !== currentPlaceholderIndex)
    const showStopButton = Boolean(onStop) && isGenerating
    const hasActionButton = Boolean(onSend) || showStopButton
    const actionRightPadding = hasActionButton ? "pr-14" : ""

    return (
        <div className={`flex flex-col w-full max-w-full overflow-visible`}>
            <div className="grid place-items-center overflow-visible">
                {isLoading && (
                    <div className="absolute inset-0 pointer-events-none overflow-visible">
                        <div className="absolute left-1/2 top-1/2 w-full h-full animate-rect-orbit overflow-visible">
                            <div className="absolute w-3 h-3 rounded-full bg-accent-primary/60 blur-sm -translate-x-1/2 -translate-y-1/2 overflow-visible" />
                        </div>
                    </div>
                )}

                <div
                    className={`
                            relative
                            w-full
                            rounded-lg
                            transition-[border-color]
                            duration-400
                            bg-card
                            ${showBorder ? "border-2 border-border focus-within:border-primary/50" : ""}
                        `}
                >
                    <TextareaAutosize
                        ref={textareaRef}
                        className={`
                                w-full
                                text-foreground
                                resize-none
                                ${getSizeClasses()}
                                ${actionRightPadding}
                                placeholder:text-muted-foreground
                                rounded-lg
                                focus:outline-none
                                bg-transparent
                                m-2 block
                            `}
                        onChange={onInputChange}
                        onKeyDown={handleKeyDownInternal}
                        value={inputValue}
                        disabled={disabled}
                        placeholder={displayedPlaceholder + (isTyping && inputValue.length === 0 ? "|" : "")}
                        minRows={minRows ?? (isLarge ? undefined : 1)}
                        maxRows={hasSubstantialContent ? 12 : isLarge ? 6 : 4}
                        autoFocus={autoFocus}
                    />
                    {/* Tab hint - shows when placeholder is fully typed and input is empty */}
                    {isFullyTyped && inputValue.length === 0 && onPlaceholderSelect && (
                        <div
                            aria-hidden="true"
                            className={`absolute flex items-center gap-1.5 text-xs text-muted-foreground/70 pointer-events-none animate-in fade-in duration-300 ${hasActionButton ? "right-14" : "right-4"} ${isLarge ? "bottom-4" : "top-1/2 -translate-y-1/2"}`}
                        >
                            <kbd className="px-1.5 py-0.5 bg-muted/30 border border-border/30 rounded text-[10px] font-mono">Tab</kbd>
                            <span>to use</span>
                        </div>
                    )}
                    {/* Stop button */}
                    {hasActionButton && showStopButton && (
                        <Button
                            onClick={onStop}
                            disabled={isCancelling}
                            className={`absolute right-3 rounded-md border border-foreground/15 hover:bg-foreground/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all p-1 ${isLarge ? "bottom-3" : "top-1/2 -translate-y-1/2"}`}
                            aria-label={isCancelling ? "Stopping generation" : "Stop generation"}
                        >
                            <CircleStop className="h-5 w-5 [&_rect]:fill-current [&_rect]:stroke-none" />
                        </Button>
                    )}
                    {/* Send button */}
                    {hasActionButton && !showStopButton && (
                        <Button
                            onClick={onSend}
                            disabled={disabled}
                            className={`absolute right-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all p-1 ${
                                inputValue.trim() ? "" : "opacity-50"
                            } ${isLarge ? "bottom-3" : "top-1/2 -translate-y-1/2"}`}
                            aria-label="Send message"
                        >
                            <Send className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Placeholder suggestion chips */}
            <AnimatePresence>
                {showPlaceholderChips && inputValue.length === 0 && chipPlaceholders.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        role="group"
                        aria-label="Suggested prompts"
                        className="flex flex-col gap-2 px-1 pt-1"
                    >
                        <div className="flex items-center gap-1.5 px-0.5" aria-hidden="true">
                            <Sparkles className="h-3 w-3 text-muted-foreground/40" />
                            <span className="text-xs text-muted-foreground/50">Try asking</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {chipPlaceholders.slice(0, 3).map(placeholder => (
                                <button
                                    key={placeholder}
                                    type="button"
                                    onClick={() => handlePlaceholderClick(placeholder)}
                                    aria-label={placeholder}
                                    className="min-h-11 flex items-center px-3 py-2 text-sm text-muted-foreground bg-secondary/50 hover:bg-secondary hover:text-foreground border border-border/50 hover:border-border rounded-full transition-all duration-200 truncate max-w-[200px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                >
                                    {placeholder}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
})

export default GlowingTextField
