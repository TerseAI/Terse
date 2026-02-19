import { createContext, useCallback, useContext, useState } from "react"
import { useSearchParams } from "react-router-dom"

import RunHistoryChatDrawer from "@/components/RunHistory/RunHistoryChatDrawer"
import { RunHistoryRecord } from "@/shared/RunHistoryTypes"

const RUN_ID_PARAM = "runId"

export type DrawerConfig = {
    runs: RunHistoryRecord[]
    initialRunIndex: number
    isInitialOpen?: boolean
}

type ContextValue = {
    openDrawer: (config: DrawerConfig) => void
    closeDrawer: () => void
    openRunId: string | null
}

const RunHistoryChatDrawerContext = createContext<ContextValue | null>(null)

export function RunHistoryChatDrawerProvider({ children }: { children: React.ReactNode }) {
    const [_, setSearchParams] = useSearchParams()
    const [runs, setRuns] = useState<RunHistoryRecord[]>([])
    const [currentRunIndex, setCurrentRunIndex] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    const openRunId = isOpen ? (runs[currentRunIndex]?.id ?? null) : null

    const openDrawer = (newConfig: DrawerConfig) => {
        const run = newConfig.runs[newConfig.initialRunIndex]
        setRuns(newConfig.runs)
        setCurrentRunIndex(newConfig.initialRunIndex)
        setIsOpen(true)

        if (run) {
            setSearchParams(
                prev => {
                    const next = new URLSearchParams(prev)
                    next.set(RUN_ID_PARAM, run.id)
                    return next
                },
                { replace: true }
            )
        }
    }

    const closeDrawer = () => {
        setIsOpen(false)
        setSearchParams(
            prev => {
                const next = new URLSearchParams(prev)
                next.delete(RUN_ID_PARAM)
                return next
            },
            { replace: true }
        )
    }

    const handleOpenChange = (open: boolean) => {
        if (!open) closeDrawer()
    }

    const handleNavigate = useCallback(
        (runId: string) => {
            const newIndex = runs.findIndex(r => r.id === runId)
            if (newIndex === -1) return
            setCurrentRunIndex(newIndex)
            setSearchParams(
                prev => {
                    const next = new URLSearchParams(prev)
                    next.set(RUN_ID_PARAM, runId)
                    return next
                },
                { replace: true }
            )
        },
        [runs]
    )

    return (
        <RunHistoryChatDrawerContext.Provider value={{ openDrawer, closeDrawer, openRunId }}>
            {children}
            {runs.length > 0 && <RunHistoryChatDrawer isOpen={isOpen} onOpenChange={handleOpenChange} runs={runs} currentRunIndex={currentRunIndex} onNavigate={handleNavigate} />}
        </RunHistoryChatDrawerContext.Provider>
    )
}

export function useRunHistoryChatDrawer() {
    const ctx = useContext(RunHistoryChatDrawerContext)
    if (!ctx) throw new Error("useRunHistoryChatDrawer must be used within RunHistoryChatDrawerProvider")
    return ctx
}
