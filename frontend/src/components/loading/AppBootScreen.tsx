import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

interface AppBootScreenProps {
    className?: string
    /**
     * Delay before rendering anything visible. Auth typically resolves in <500ms,
     * so holding back prevents a jarring flash of the boot screen on the common
     * fast path. On genuinely slow auth the screen fades in and stays.
     */
    revealAfterMs?: number
}

const STATUS_TIERS = [
    { atMs: 3_000, copy: "Just a moment…" },
    { atMs: 8_000, copy: "Still restoring your session…" },
    { atMs: 15_000, copy: "Taking longer than usual — check your connection." }
] as const

/**
 * Full-viewport boot screen shown while the app resolves auth / initial state.
 *
 * Behaviour:
 * - Renders an sr-only announcement immediately so assistive tech is informed.
 * - Holds back visual render until auth has been slow for `revealAfterMs` ms.
 * - When it does appear, the Terse mark assembles itself once (T, then the
 *   yellow / teal / coral dots in sequence). Once assembled, the dots breathe
 *   on slightly desynchronized cycles so the screen stays alive through the
 *   wait without reading as a spinner.
 * - A polite status line fades in progressively if the wait keeps dragging.
 *
 * All animations are transform/opacity only; the global `prefers-reduced-motion`
 * rule in index.css flattens them for users who ask.
 */
function AppBootScreen({ className, revealAfterMs = 400 }: AppBootScreenProps) {
    const [visible, setVisible] = useState(false)
    const [tier, setTier] = useState(-1)

    useEffect(() => {
        const revealTimer = window.setTimeout(() => setVisible(true), revealAfterMs)
        const tierTimers = STATUS_TIERS.map((t, i) =>
            window.setTimeout(() => setTier(i), revealAfterMs + t.atMs)
        )

        return () => {
            window.clearTimeout(revealTimer)
            tierTimers.forEach(window.clearTimeout)
        }
    }, [revealAfterMs])

    if (!visible) {
        return (
            <div role="status" aria-label="Loading Terse" className="sr-only">
                Loading Terse
            </div>
        )
    }

    const statusCopy = tier >= 0 ? STATUS_TIERS[tier].copy : null

    return (
        <div
            role="status"
            aria-label="Loading Terse"
            className={cn(
                "relative grid h-full min-h-[100dvh] place-items-center overflow-hidden bg-background",
                className
            )}
        >
            <div className="flex flex-col items-center gap-7">
                <svg
                    viewBox="0 0 64 64"
                    aria-hidden
                    className="h-[clamp(7rem,18vmin,11rem)] w-[clamp(7rem,18vmin,11rem)]"
                >
                    <path className="app-boot-t" d="M2 4 h38 v12 h-13 v44 h-12 v-44 h-13 z" fill="#2a8a8a" />

                    <circle className="app-boot-dot app-boot-dot-1" cx="50" cy="14" r="7" fill="#f5c542" />
                    <circle className="app-boot-dot app-boot-dot-2" cx="50" cy="32" r="7" fill="#2a8a8a" />
                    <circle className="app-boot-dot app-boot-dot-3" cx="50" cy="50" r="7" fill="#e85a5a" />
                </svg>

                <p
                    key={tier}
                    aria-live="polite"
                    className={cn(
                        "min-h-[1.25rem] max-w-[32ch] text-center text-[0.8125rem] leading-tight text-muted-foreground",
                        statusCopy ? "app-boot-status" : "opacity-0"
                    )}
                >
                    {statusCopy ?? "\u00A0"}
                </p>
            </div>

            <style>{`
                @keyframes app-boot-t-in {
                    from { opacity: 0; transform: translateY(4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                @keyframes app-boot-dot-in {
                    from { opacity: 0; transform: scale(0.4); }
                    to   { opacity: 1; transform: scale(1); }
                }

                @keyframes app-boot-dot-pulse {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.55; }
                }

                @keyframes app-boot-status-in {
                    from { opacity: 0; transform: translateY(2px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                .app-boot-t {
                    transform-box: fill-box;
                    transform-origin: center;
                    animation: app-boot-t-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
                }

                .app-boot-dot {
                    transform-box: fill-box;
                    transform-origin: center;
                }

                .app-boot-dot-1 {
                    animation:
                        app-boot-dot-in 360ms cubic-bezier(0.16, 1, 0.3, 1) 280ms both,
                        app-boot-dot-pulse 2400ms ease-in-out 800ms infinite;
                }
                .app-boot-dot-2 {
                    animation:
                        app-boot-dot-in 360ms cubic-bezier(0.16, 1, 0.3, 1) 380ms both,
                        app-boot-dot-pulse 2700ms ease-in-out 1600ms infinite;
                }
                .app-boot-dot-3 {
                    animation:
                        app-boot-dot-in 360ms cubic-bezier(0.16, 1, 0.3, 1) 480ms both,
                        app-boot-dot-pulse 2500ms ease-in-out 2300ms infinite;
                }

                .app-boot-status {
                    animation: app-boot-status-in 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
                }
            `}</style>
        </div>
    )
}

export default AppBootScreen
