import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"

import remarkGfm from "remark-gfm"

const markdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-3 mt-7 text-2xl font-semibold tracking-[-0.02em] first:mt-0">{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-2.5 mt-6 text-xl font-semibold tracking-[-0.015em] first:mt-0">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-2 mt-5 text-lg font-semibold first:mt-0">{children}</h3>,
    h4: ({ children }: { children?: React.ReactNode }) => <h4 className="mb-2 mt-5 font-semibold first:mt-0">{children}</h4>,
    p: ({ children }: { children?: React.ReactNode }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
    code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
        const isBlock = (className ?? "").includes("language-")
        if (isBlock) {
            return <code className={className}>{children}</code>
        }
        return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.875em]">{children}</code>
    },
    pre: ({ children }: { children?: React.ReactNode }) => (
        <pre className="my-4 overflow-x-auto rounded-xl border border-[var(--code-border)] bg-[var(--code-bg)] p-4 font-mono text-[0.8125rem] leading-5">{children}</pre>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>
}

// Reveal pacing in characters per tick. Tuned to feel like the previous
// per-token throttle (~3 tokens / 20ms ≈ 15-30 chars / 20ms for typical English).
const REVEAL_TICK_MS = 20
const REVEAL_MIN_CHARS = 3
const REVEAL_CATCHUP_DIVISOR = 8

function TokenStream({ text, disableAnimation = false }: { text: string; disableAnimation?: boolean }) {
    // `visibleText` is the throttled prefix of `text`. We render Markdown
    // on this string directly — same render path while streaming and after,
    // so headings, bold, code fences, etc. form *live* as characters arrive
    // (the Claude / ChatGPT UX). No mode switch means no flicker.
    const [visibleText, setVisibleText] = useState(disableAnimation ? text : "")

    // When animation is disabled (e.g. historical messages on initial load),
    // jump straight to the full text.
    useEffect(() => {
        if (disableAnimation) {
            setVisibleText(text)
        }
    }, [text, disableAnimation])

    // If text shrinks (e.g. switching to a different message) or was cleared,
    // reset visibleText so we re-stream from the start instead of showing a
    // mismatched prefix.
    useEffect(() => {
        if (disableAnimation) return
        if (text.length < visibleText.length || (text.length === 0 && visibleText.length > 0)) {
            setVisibleText("")
        }
    }, [text, disableAnimation, visibleText.length])

    // Reveal more of `text` on a steady interval. Catches up faster on long
    // bursts so we never lag visibly behind the producer.
    useEffect(() => {
        if (disableAnimation) return
        if (visibleText === text) return
        const interval = setInterval(() => {
            setVisibleText(current => {
                if (current === text) return current
                if (!text.startsWith(current)) {
                    // Producer text drifted (e.g. message swap) — snap to current text.
                    return text
                }
                const remaining = text.length - current.length
                const chunk = Math.min(remaining, Math.max(REVEAL_MIN_CHARS, Math.floor(remaining / REVEAL_CATCHUP_DIVISOR)))
                return text.slice(0, current.length + chunk)
            })
        }, REVEAL_TICK_MS)
        return () => clearInterval(interval)
    }, [text, visibleText, disableAnimation])

    return (
        <div className="max-w-[72ch] text-[0.9375rem] leading-7 text-foreground text-wrap-pretty select-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {visibleText}
            </ReactMarkdown>
        </div>
    )
}

export default TokenStream
