import { useState } from "react"

import { Chat } from "@/components/chat/Chat"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { RunHistoryRecord, RunHistoryStatus, RunHistoryTrigger } from "@/shared/RunHistoryTypes"

import RunHistoryChatAdapter from "./RunHistoryChatAdapter"
import RunHistoryChatDrawerHeader from "./RunHistoryChatDrawerHeader"

type Props = {
    runId: string
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    runNumber?: number
    totalEvents?: number
    status: RunHistoryStatus
    trigger: RunHistoryTrigger
    filtered: boolean
    runs?: RunHistoryRecord[]
    currentRunIndex?: number
    onNavigate?: (runId: string) => void
    isFullscreen?: boolean
    onFullscreenChange?: (fullscreen: boolean) => void
    isInitialOpen?: boolean
}

export default function RunHistoryChatDrawer({
    runId,
    isOpen,
    onOpenChange,
    runNumber,
    totalEvents,
    status,
    trigger,
    filtered,
    runs,
    currentRunIndex,
    onNavigate,
    isFullscreen: externalIsFullscreen = false,
    onFullscreenChange,
    isInitialOpen = true
}: Props) {
    const [internalFullscreen, setInternalFullscreen] = useState(false)

    const isFullscreen = onFullscreenChange ? externalIsFullscreen : internalFullscreen

    const handleFullscreenChange = (fullscreen: boolean) => {
        if (onFullscreenChange) {
            onFullscreenChange(fullscreen)
        } else {
            setInternalFullscreen(fullscreen)
        }
    }

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange} direction="right" shouldScaleBackground={isInitialOpen} handleOnly>
            <DrawerContent
                className={cn(
                    "flex flex-col overflow-hidden",
                    isFullscreen ? "!w-screen !h-screen !max-w-none !max-h-none !rounded-none !m-0" : "!w-full sm:!w-[600px] md:!w-[700px] lg:!w-[800px] !max-w-[100vw] h-full",
                    !isInitialOpen && "[&[data-state=open]]:!animate-none [&[data-state=closed]]:!animate-none [&+*]:!animate-none"
                )}
            >
                {isOpen && (
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
                                                    initialTurns={initialTurns}
                                                    subscribeToEvents={subscribeToEvents}
                                                    sendMessage={sendMessage}
                                                    addUserTurnsLocally={true}
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
                )}
            </DrawerContent>
        </Drawer>
    )
}
