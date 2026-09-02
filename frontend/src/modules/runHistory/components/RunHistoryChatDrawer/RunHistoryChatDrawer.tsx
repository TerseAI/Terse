import { useEffect, useRef, useState } from "react"

import { RunHistoryRecord, RunHistoryStatus } from "terse-types/RunHistoryTypes"

import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { AwaitingResponseAnimation } from "@/modules/chat/components/AwaitingResponseAnimation"
import { Chat, type ChatHandle } from "@/modules/chat/components/Chat"

import RunHistoryChatAdapter from "./RunHistoryChatAdapter"
import RunHistoryChatDrawerHeader from "./RunHistoryChatDrawerHeader"
import { RunHistoryChatEmptyMessages } from "./RunHistoryChatEmptyMessages"
import { RunHistoryChatHistorySkeleton } from "./RunHistoryChatHistorySkeleton"
import TriggerPayloadViewer from "./TriggerPayloadViewer"

type Props = {
    runs: RunHistoryRecord[]
    currentRunIndex: number
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onNavigate?: (runId: string) => void
    onFullscreenChange?: (fullscreen: boolean) => void
}

function formatEventTypeLabel(value: string | null): string | null {
    if (!value) return null

    return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function RunHistoryChatDrawer({ isOpen, onOpenChange, runs, currentRunIndex, onNavigate, onFullscreenChange }: Props) {
    const [internalFullscreen, setInternalFullscreen] = useState(false)
    const [isTriggerPayloadOpen, setIsTriggerPayloadOpen] = useState(false)
    const chatRef = useRef<ChatHandle>(null)

    const isFullscreen = internalFullscreen

    const handleFullscreenChange = (fullscreen: boolean) => {
        if (onFullscreenChange) {
            onFullscreenChange(fullscreen)
        } else {
            setInternalFullscreen(fullscreen)
        }
    }

    const runId = runs[currentRunIndex].id
    const agentId = runs[currentRunIndex].agentId
    const runNumber = currentRunIndex + 1
    const totalEvents = runs.length
    const status = runs[currentRunIndex].status
    const trigger = runs[currentRunIndex].trigger
    const filtered = runs[currentRunIndex].filtered
    const isTest = runs[currentRunIndex].isTest
    const isManuallyTriggered = runs[currentRunIndex].isManuallyTriggered
    const triggeredByUserId = runs[currentRunIndex].triggeredByUserId
    const replayOfRunId = runs[currentRunIndex].replayOfRunId
    const executionRegion = runs[currentRunIndex].executionRegion

    useEffect(() => {
        setIsTriggerPayloadOpen(false)
    }, [runId])

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange} direction="right" handleOnly>
            <DrawerContent
                className={cn(
                    "flex flex-col overflow-hidden",
                    isFullscreen ? "!w-screen !h-screen !max-w-none !max-h-none !rounded-none !m-0" : "!w-full sm:!w-[600px] md:!w-[700px] lg:!w-[800px] !max-w-[100vw] h-full"
                )}
            >
                <RunHistoryChatAdapter key={runId} runId={runId} status={status}>
                    {({
                        initialTurns,
                        isLoading,
                        subscribeToEvents,
                        sendMessage,
                        handleApprove,
                        handleReject,
                        handleCancellation,
                        currentStatus,
                        isRunPending,
                        triggerEvent,
                        triggerEventType,
                        isTriggerEventTruncated
                    }) => {
                        const isFiltered = currentStatus === RunHistoryStatus.SKIPPED
                        const formattedTriggerEventType = formatEventTypeLabel(triggerEventType)
                        const emptyPlaceholder =
                            initialTurns.length === 0 && isRunPending ? (
                                <div className="p-4">
                                    <AwaitingResponseAnimation />
                                </div>
                            ) : isLoading ? (
                                <RunHistoryChatHistorySkeleton />
                            ) : (
                                <RunHistoryChatEmptyMessages />
                            )

                        return (
                            <>
                                <div className="shrink-0 border-b border-border/70">
                                    <RunHistoryChatDrawerHeader
                                        trigger={trigger}
                                        runId={runId}
                                        agentId={agentId}
                                        runNumber={runNumber}
                                        totalEvents={totalEvents}
                                        status={currentStatus}
                                        filtered={isFiltered || filtered}
                                        isTest={isTest}
                                        isManuallyTriggered={isManuallyTriggered}
                                        triggeredByUserId={triggeredByUserId}
                                        replayOfRunId={replayOfRunId}
                                        executionRegion={executionRegion}
                                        runs={runs}
                                        currentRunIndex={currentRunIndex}
                                        onNavigate={onNavigate}
                                        isFullscreen={isFullscreen}
                                        onFullscreenChange={handleFullscreenChange}
                                        hasTriggerPayload={!!triggerEvent}
                                        isTriggerPayloadOpen={isTriggerPayloadOpen}
                                        onToggleTriggerPayload={() => setIsTriggerPayloadOpen(open => !open)}
                                    />
                                    <TriggerPayloadViewer event={triggerEvent} eventType={formattedTriggerEventType} isTruncated={isTriggerEventTruncated} isOpen={isTriggerPayloadOpen} />
                                </div>
                                <div className={cn("flex-1 overflow-hidden min-h-0 bg-background select-text", isFullscreen && "mx-auto w-full")}>
                                    <div className="flex flex-col h-full relative">
                                        <div className="flex-1 min-h-0">
                                            <Chat
                                                ref={chatRef}
                                                initialTurns={initialTurns}
                                                subscribeToEvents={subscribeToEvents}
                                                sendMessage={sendMessage}
                                                addUserTurnsLocally={true}
                                                onHandleApprove={handleApprove}
                                                onHandleReject={handleReject}
                                                onHandleCancellation={handleCancellation}
                                                EmptyContentPlaceholder={emptyPlaceholder}
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
