import { AnimatePresence, type Transition, motion } from "framer-motion"

import { cn } from "@/lib/utils"

const DEFAULT_TRANSITION: Transition = {
    duration: 0.25,
    ease: [0.25, 1, 0.5, 1]
}

interface FadeSwitchProps {
    activeKey: string
    transition?: Transition
    className?: string
    children: React.ReactNode
}

/**
 * Crossfades between children whenever `activeKey` changes.
 * Wrap each state in a single element keyed by the same value you pass to `activeKey`.
 *
 * Usage:
 * ```tsx
 * <FadeSwitch activeKey={isLoading ? "loading" : "ready"}>
 *   {isLoading ? <Skeleton /> : <Content />}
 * </FadeSwitch>
 * ```
 */
export function FadeSwitch({ activeKey, transition = DEFAULT_TRANSITION, className, children }: FadeSwitchProps) {
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div key={activeKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition} className={cn(className)}>
                {children}
            </motion.div>
        </AnimatePresence>
    )
}
