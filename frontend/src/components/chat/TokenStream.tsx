import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"

import remarkGfm from "remark-gfm"

interface Token {
    id: string
    value: string
}

// Markdown component overrides apply the same Tailwind classes the old
// regex pipeline used, so the rendered output looks the same. react-markdown
// renders to React elements (never to raw HTML), so any literal <script>,
// <img onerror=...>, or other HTML in the assistant's stream is treated as
// text — the XSS path that the old dangerouslySetInnerHTML enabled is gone.
const markdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-2xl font-bold mb-4 mt-8">{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-xl font-bold mb-3 mt-6">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>,
    h4: ({ children }: { children?: React.ReactNode }) => <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
    code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
        const isBlock = (className ?? "").includes("language-")
        if (isBlock) {
            return <code className={className}>{children}</code>
        }
        return <code className="px-1 rounded font-mono text-sm">{children}</code>
    },
    pre: ({ children }: { children?: React.ReactNode }) => <pre className="rounded p-4 overflow-x-auto my-4 font-mono">{children}</pre>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside">{children}</ol>
}

function TokenStream({ text, disableAnimation = false, onComplete }: { text: string; disableAnimation?: boolean; onComplete?: () => void }) {
    const previousTextRef = useRef<string>("")
    const [tokens, setTokens] = useState<Token[]>([])
    const [buffer, setBuffer] = useState<string[]>([])
    const [finalText, setFinalText] = useState<string>("")
    const [showFormatted, setShowFormatted] = useState(false)
    const lastTextChangeRef = useRef<number>(Date.now())
    const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const bufferRef = useRef<string[]>([])
    const lastCompletedTextRef = useRef<string>("")

    // If animation is disabled, immediately show formatted text
    useEffect(() => {
        if (disableAnimation && text) {
            setFinalText(text)
            setShowFormatted(true)
            setTokens([])
            setBuffer([])
            bufferRef.current = []
        }
    }, [text, disableAnimation])

    // Track when text changes to detect streaming completion
    useEffect(() => {
        lastTextChangeRef.current = Date.now()
        // If we were showing formatted and text changed, reset to streaming mode
        if (showFormatted && text !== finalText && !disableAnimation) {
            setShowFormatted(false)
        }
    }, [text])

    // Diff text and buffer the new tokens
    useEffect(() => {
        if (disableAnimation) return

        const prev = previousTextRef.current
        if (text === prev || text.length < prev.length) return

        const diff = text.slice(prev.length)
        const newTokens = diff.split(/(\s+|\n+)/)

        setBuffer(prev => {
            const newBuffer = [...prev, ...newTokens]
            bufferRef.current = newBuffer
            return newBuffer
        })
        previousTextRef.current = text
    }, [text, disableAnimation])

    // Pop 1-3 tokens into `tokens` array every interval
    useEffect(() => {
        if (disableAnimation) return
        if (buffer.length === 0) return

        const interval = setInterval(() => {
            const next = buffer.slice(0, 3).map(value => ({
                id: crypto.randomUUID(),
                value
            }))

            setTokens(prev => [...prev, ...next])
            setBuffer(prev => {
                const newBuffer = prev.slice(3)
                bufferRef.current = newBuffer
                return newBuffer
            })
        }, 20)

        return () => clearInterval(interval)
    }, [buffer])

    // Handle when streaming finishes - use debounce approach for reliability
    useEffect(() => {
        if (disableAnimation) return
        if (text.length === 0) return

        // Clear any existing completion timer
        if (completionTimerRef.current) {
            clearTimeout(completionTimerRef.current)
            completionTimerRef.current = null
        }

        // Only check for completion when buffer is empty (all tokens rendered)
        if (buffer.length === 0) {
            // Check if enough time has passed since last text change (debounce)
            const timeSinceLastChange = Date.now() - lastTextChangeRef.current
            const delay = Math.max(0, 300 - timeSinceLastChange)

            completionTimerRef.current = setTimeout(() => {
                // Final check: buffer still empty (use ref to avoid stale closure)
                if (bufferRef.current.length === 0) {
                    setFinalText(text)
                    setShowFormatted(true)
                }
            }, delay + 200) // Add buffer for animation to settle
        }

        return () => {
            if (completionTimerRef.current) {
                clearTimeout(completionTimerRef.current)
                completionTimerRef.current = null
            }
        }
    }, [tokens, text, buffer.length, disableAnimation])

    // Fire onComplete when animation settles on the current text
    useEffect(() => {
        if (showFormatted && finalText === text && text.length > 0 && lastCompletedTextRef.current !== text) {
            lastCompletedTextRef.current = text
            onComplete?.()
        }
    }, [showFormatted, finalText, text, onComplete])

    // Show formatted version (only if finalText matches current text to avoid stale content)
    if (showFormatted && finalText === text) {
        return (
            <div className="text-foreground text-md leading-relaxed whitespace-pre-wrap text-wrap-pretty select-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {finalText}
                </ReactMarkdown>
            </div>
        )
    }

    // Show streaming tokens
    return (
        <div className="text-foreground text-md leading-relaxed whitespace-pre-wrap text-wrap-pretty select-text">
            {tokens.map(token => (
                <span key={token.id} className="animate-in fade-in-0 duration-150">
                    {token.value}
                </span>
            ))}
        </div>
    )
}

export default TokenStream
