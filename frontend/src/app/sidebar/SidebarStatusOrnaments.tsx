import { useEffect, useRef, useState } from "react"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import type { ProjectDeployStatus } from "terse-types/types"

import { cn } from "@/lib/utils"

type OrnamentPhase = "idle" | "active" | "success" | "failure"

const SUCCESS_DURATION_MS = 1850
const FAILURE_DURATION_MS = 520
const CUBES = [
    {
        name: "top",
        paths: ["M10 1.8 14 4.1 10 6.4 6 4.1 10 1.8Z", "M6 4.1v4.6l4 2.3 4-2.3V4.1M10 6.4V11"]
    },
    {
        name: "left",
        paths: ["m5.1 8.8 4 2.3-4 2.3-4-2.3 4-2.3Z", "M1.1 11.1v4.6l4 2.3 4-2.3v-4.6m-4 2.3V18"]
    },
    {
        name: "right",
        paths: ["m14.9 8.8 4 2.3-4 2.3-4-2.3 4-2.3Z", "M10.9 11.1v4.6l4 2.3 4-2.3v-4.6m-4 2.3V18"]
    }
] as const

function useOrnamentPhase(active: boolean, outcome: "success" | "failure" | null): OrnamentPhase {
    const previousActive = useRef(active)
    const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [phase, setPhase] = useState<OrnamentPhase>(active ? "active" : "idle")

    useEffect(() => {
        if (completionTimer.current) {
            clearTimeout(completionTimer.current)
            completionTimer.current = null
        }

        if (active) {
            setPhase("active")
        } else if (previousActive.current && outcome) {
            setPhase(outcome)
            completionTimer.current = setTimeout(
                () => {
                    setPhase("idle")
                    completionTimer.current = null
                },
                outcome === "success" ? SUCCESS_DURATION_MS : FAILURE_DURATION_MS
            )
        } else if (previousActive.current) {
            setPhase("idle")
        }

        previousActive.current = active
    }, [active, outcome])

    useEffect(() => {
        return () => {
            if (completionTimer.current) clearTimeout(completionTimer.current)
        }
    }, [])

    return phase
}

function deployOutcome(status: ProjectDeployStatus | undefined): "success" | "failure" | null {
    if (status === "SUCCEEDED") return "success"
    if (status === "FAILED" || status === "ROLLED_BACK") return "failure"
    return null
}

export function ProjectStatusOrnament({ status }: { status?: ProjectDeployStatus }) {
    const shouldReduceMotion = useReducedMotion() ?? false
    const phase = useOrnamentPhase(status === "IN_PROGRESS", deployOutcome(status))
    const successActive = phase === "success"

    return (
        <span className="sidebar-project-ornament-wrap" aria-hidden="true">
            <svg className={cn("sidebar-project-ornament", `sidebar-project-ornament--${phase}`)} viewBox="0 0 20 20" fill="none">
                <motion.g
                    initial={false}
                    animate={successActive ? { opacity: 0, scale: shouldReduceMotion ? 1 : 0.86, rotate: shouldReduceMotion ? 0 : -3 } : { opacity: 1, scale: 1, rotate: 0 }}
                    transition={shouldReduceMotion ? { duration: 0.12 } : successActive ? { duration: 0.24, ease: [0.4, 0, 1, 1] } : { delay: 0.18, duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: "10px 10px" }}
                >
                    {CUBES.map(cube => (
                        <g key={cube.name} className={cn("sidebar-project-ornament__cube", `sidebar-project-ornament__cube--${cube.name}`)}>
                            {cube.paths.map(path => (
                                <path key={path} d={path} />
                            ))}
                        </g>
                    ))}
                </motion.g>

                <AnimatePresence initial={false}>
                    {successActive && (
                        <motion.g
                            key="success"
                            className="sidebar-project-ornament__success-check"
                            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, rotate: -8, y: 0.8 }}
                            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: [0, 1, 1, 1], scale: [0.72, 1.08, 0.97, 1], rotate: [-8, 2, -0.5, 0], y: [0.8, -0.35, 0, 0] }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: -0.8 }}
                            transition={shouldReduceMotion ? { duration: 0.12 } : { delay: 0.12, duration: 0.7, times: [0, 0.48, 0.76, 1], ease: [0.16, 1, 0.3, 1] }}
                            style={{ transformOrigin: "10px 10px" }}
                        >
                            <motion.path
                                d="m3.7 10.2 4.15 4.15L16.4 5.8"
                                initial={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0.001, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.16, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            />
                        </motion.g>
                    )}
                </AnimatePresence>
                <path className="sidebar-project-ornament__cross" d="m6.7 6.7 6.6 6.6m0-6.6-6.6 6.6" />
            </svg>
        </span>
    )
}
