import { useRef, useState } from "react"

import { Chat, type ChatHandle } from "@/components/chat/Chat"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { RunHistoryRecord, RunHistoryStatus } from "@/shared/RunHistoryTypes"

import RunHistoryChatAdapter from "./RunHistoryChatAdapter"
import RunHistoryChatDrawerHeader from "./RunHistoryChatDrawerHeader"

type Props = {
    runs: RunHistoryRecord[]
    currentRunIndex: number
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onNavigate?: (runId: string) => void
    onFullscreenChange?: (fullscreen: boolean) => void
    isInitialOpen?: boolean
}

export default function RunHistoryChatDrawer({ isOpen, onOpenChange, runs, currentRunIndex, onNavigate, onFullscreenChange, isInitialOpen = true }: Props) {
    const [internalFullscreen, setInternalFullscreen] = useState(false)
    const chatRef = useRef<ChatHandle>(null)

    const isFullscreen = internalFullscreen

    const handleFullscreenChange = (fullscreen: boolean) => {
        if (onFullscreenChange) {
            onFullscreenChange(fullscreen)
        } else {
            setInternalFullscreen(fullscreen)
        }
    }

    const runId = runs?.[currentRunIndex ?? 0]?.id
    const runNumber = currentRunIndex + 1
    const totalEvents = runs.length
    const status = runs[currentRunIndex].status
    const trigger = runs[currentRunIndex].trigger
    const filtered = runs[currentRunIndex].filtered

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange} direction="right" shouldScaleBackground={isInitialOpen} handleOnly>
            <DrawerContent
                className={cn(
                    "flex flex-col overflow-hidden",
                    isFullscreen ? "!w-screen !h-screen !max-w-none !max-h-none !rounded-none !m-0" : "!w-full sm:!w-[600px] md:!w-[700px] lg:!w-[800px] !max-w-[100vw] h-full",
                    !isInitialOpen && "[&[data-state=open]]:!animate-none [&[data-state=closed]]:!animate-none [&+*]:!animate-none"
                )}
            >
                <RunHistoryChatAdapter key={runId} runId={runId} status={status}>
                    {({ initialTurns, isLoading, subscribeToEvents, sendMessage, handleApprove, handleReject, currentStatus }) => {
                        const isFiltered = currentStatus === RunHistoryStatus.SKIPPED

                        return (
                            <>
                                <RunHistoryChatDrawerHeader
                                    trigger={trigger}
                                    runNumber={runNumber}
                                    totalEvents={totalEvents}
                                    status={currentStatus}
                                    filtered={isFiltered || filtered}
                                    runs={runs}
                                    currentRunIndex={currentRunIndex}
                                    onNavigate={onNavigate}
                                    isFullscreen={isFullscreen}
                                    onFullscreenChange={handleFullscreenChange}
                                />
                                <div className={cn("flex-1 overflow-hidden min-h-0 bg-background select-text", isFullscreen && "mx-auto w-full")}>
                                    <div className="flex flex-col h-full relative">
                                        <div className="flex-1 min-h-0">
                                            <Chat
                                                ref={chatRef}
                                                initialTurns={initialTurns}
                                                subscribeToEvents={subscribeToEvents}
                                                sendMessage={sendMessage}
                                                onHandleApprove={handleApprove}
                                                onHandleReject={handleReject}
                                                EmptyContentPlaceholder={
                                                    isLoading ? (
                                                        <div className="p-4 text-center text-muted-foreground">Loading history...</div>
                                                    ) : (
                                                        <div className="p-4 text-center text-muted-foreground">No events found</div>
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )
                    }}
                </RunHistoryChatAdapter>
            </DrawerContent>
        </Drawer>
    )
}
