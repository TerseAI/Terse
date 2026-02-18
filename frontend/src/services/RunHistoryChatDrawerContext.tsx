import { createContext, useCallback, useContext, useState } from "react"

import RunHistoryChatDrawer from "@/components/RunHistory/RunHistoryChatDrawer"
import { RunHistoryRecord } from "@/shared/RunHistoryTypes"

export type DrawerConfig = {
    runs: RunHistoryRecord[]
    currentRunIndex: number
    onNavigate?: (runId: string) => void
    onClose?: () => void
    isInitialOpen?: boolean
}

type ContextValue = {
    openDrawer: (config: DrawerConfig) => void
    closeDrawer: () => void
}

const RunHistoryChatDrawerContext = createContext<ContextValue | null>(null)

export function RunHistoryChatDrawerProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfig] = useState<DrawerConfig | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    const openDrawer = (newConfig: DrawerConfig) => {
        setConfig(newConfig)
        setIsOpen(true)
    }

    const closeDrawer = () => {
        setIsOpen(false)
    }

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            config?.onClose?.()
            closeDrawer()
        }
    }

    return (
        <RunHistoryChatDrawerContext.Provider value={{ openDrawer, closeDrawer }}>
            {children}
            {config && (
                <RunHistoryChatDrawer
                    isOpen={isOpen}
                    onOpenChange={handleOpenChange}
                    runs={config.runs}
                    currentRunIndex={config.currentRunIndex}
                    onNavigate={config.onNavigate}
                    isInitialOpen={config.isInitialOpen}
                />
            )}
        </RunHistoryChatDrawerContext.Provider>
    )
}

export function useRunHistoryChatDrawer() {
    const ctx = useContext(RunHistoryChatDrawerContext)
    if (!ctx) throw new Error("useRunHistoryChatDrawer must be used within RunHistoryChatDrawerProvider")
    return ctx
}
