import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react"

import GlowingTextField, { type GlowingTextFieldHandle, Size } from "./GlowingTextField"

interface ChatInputProps {
    sendMessage: (message: string) => void
    input: string
    setInput: (input: string) => void
    placeholders: string[]
    disabled?: boolean
    inputSize?: "small" | "medium" | "large"
    showPlaceholderChips?: boolean
}

export interface ChatInputHandle {
    focus: () => void
}

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
    { sendMessage, input, setInput, placeholders, disabled = false, inputSize = "small", showPlaceholderChips = false },
    ref
) {
    const prevSelectedRef = useRef<number | null>(null)
    const glowingTextFieldRef = useRef<GlowingTextFieldHandle>(null)

    // Expose focus method to parent
    useImperativeHandle(ref, () => ({
        focus: () => glowingTextFieldRef.current?.focus()
    }))

    // Track focus override based on state transitions
    const focusOverride = (() => {
        const hadSelection = prevSelectedRef.current !== null
        const hasSelection = false

        // If we went from having a selection to no selection, force focus
        if (hadSelection && !hasSelection) {
            return true
        }

        // If we have a selection, force blur
        if (hasSelection) {
            return false
        }

        // Otherwise, no override
        return null
    })()

    // Update previous selection state
    useEffect(() => {
        prevSelectedRef.current = null
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            if (!disabled) {
                sanitizeAndSendMessage(input)
            }
        }
    }

    const sanitizeAndSendMessage = (message: string) => {
        // Trim whitespace and check if message is empty
        const sanitizedMessage = message.trim()

        if (!sanitizedMessage || sanitizedMessage.length === 0) {
            return // Don't send empty messages
        }

        // Basic sanitization for LLM input
        // Remove any potential script tags or dangerous content
        const cleanMessage = sanitizedMessage
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
            .replace(/javascript:/gi, "") // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, "") // Remove event handlers
            .trim()

        if (!cleanMessage) {
            return // Don't send if sanitization resulted in empty message
        }

        sendMessage(cleanMessage)
    }

    const handlePlaceholderSelect = useCallback(
        (placeholder: string) => {
            setInput(placeholder)
        },
        [setInput]
    )

    const sizeMapping = {
        small: { size: Size.Small, minRows: 1, showBorder: true },
        medium: { size: Size.Medium, minRows: 2, showBorder: true },
        large: { size: Size.Large, minRows: 4, showBorder: true }
    }
    const { size: textFieldSize, minRows, showBorder } = sizeMapping[inputSize]

    return (
        <div>
            <GlowingTextField
                ref={glowingTextFieldRef}
                isLoading={false}
                disabled={disabled}
                onInputChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                inputValue={input}
                placeholders={placeholders}
                size={textFieldSize}
                autoFocus={true}
                focusOverride={focusOverride}
                minRows={minRows}
                showBorder={showBorder}
                onSend={() => sanitizeAndSendMessage(input)}
                onPlaceholderSelect={handlePlaceholderSelect}
                showPlaceholderChips={showPlaceholderChips}
            />
        </div>
    )
})

export default ChatInput
