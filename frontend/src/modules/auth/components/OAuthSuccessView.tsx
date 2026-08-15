import { useEffect } from "react"

import { motion, useReducedMotion } from "framer-motion"

export default function OAuthSuccess() {
    useEffect(() => {
        // Notify parent window that OAuth was successful
        if (window.opener) {
            window.opener.postMessage({ type: "oauth-success" }, window.location.origin)
        }

        // Close the popup window after a short delay
        const timer = setTimeout(() => {
            window.close()
        }, 1000)

        return () => clearTimeout(timer)
    }, [])

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center justify-center gap-6 text-center px-6 max-w-2xl">
                <SuccessCheck />
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold leading-tight text-foreground">Integration connected</h1>
                    <p className="text-sm text-muted-foreground">You can close this window and return to Terse.</p>
                </div>
            </div>
        </div>
    )
}

function SuccessCheck() {
    const shouldReduceMotion = useReducedMotion() ?? false

    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-10 stroke-success" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <motion.path
                d="m4.8 10.3 3.6 3.6 6.8-7.4"
                initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0.001 }}
                animate={{ pathLength: 1 }}
                transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.06, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            />
        </svg>
    )
}
