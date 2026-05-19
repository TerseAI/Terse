import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"

import remarkGfm from "remark-gfm"

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
        <div className="text-foreground text-md leading-relaxed text-wrap-pretty select-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {visibleText}
            </ReactMarkdown>
        </div>
    )
}

export default TokenStream
