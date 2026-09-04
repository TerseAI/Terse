import { useMemo } from "react"

import { ModelRequest } from "terse-types/ModelEvents"
import { RunHistoryStatus } from "terse-types/RunHistoryTypes"
import type { RunHistoryModelSocketEvent } from "terse-types/RunHistoryTypes"

import { cancelAgentChatRun, sendChatMessage, sendToolApprovalResponse, subscribeToChatEvents } from "@/lib/socket"
import { useChatHistory } from "@/modules/chat/api/useChatHistory"
import { AwaitingResponseAnimation } from "@/modules/chat/components/AwaitingResponseAnimation"
import { Chat } from "@/modules/chat/components/Chat"
import { type ChatEventSubscription } from "@/modules/chat/hooks/useCompletionSocket"
import type { Turn } from "@/modules/chat/turnModel"

import { RunHistoryChatEmptyMessages } from "./RunHistoryChatEmptyMessages"
import { RunHistoryChatHistorySkeleton } from "./RunHistoryChatHistorySkeleton"
import { convertRunHistoryEventsToTurns } from "./runHistoryEventsToTurns"

type RunHistoryChatAdapterProps = {
    runId: string
    status: RunHistoryStatus
    children?: (props: {
        initialTurns: Turn[]
        isLoading: boolean
        runId: string
        startTimestamp?: string
        endTimestamp?: string
        triggerEvent: string | null
        triggerEventType: string | null
        isTriggerEventTruncated: boolean
        subscribeToEvents?: ChatEventSubscription | null
        sendMessage: (message: ModelRequest) => void
        handleApprove: (stepId: string) => void
        handleReject: (stepId: string) => void
        handleCancellation: () => void
        currentStatus: RunHistoryStatus
        canRetryFromFailure: boolean
        isRunPending: boolean
    }) => React.ReactNode
}

export default function RunHistoryChatAdapter({ runId, status, children }: RunHistoryChatAdapterProps) {
    // Fetch History (API)
    const { events, isLoading, startTimestamp, endTimestamp, status: apiStatus, canRetryFromFailure, triggerEvent, triggerEventType, isTriggerEventTruncated } = useChatHistory(runId)

    // Use API status if available, otherwise fall back to prop status
    const currentStatus = apiStatus ?? status
    const isRunPending = currentStatus === RunHistoryStatus.IN_PROGRESS || currentStatus === RunHistoryStatus.AWAITING_APPROVAL

    // Convert to Turns
    const turns = convertRunHistoryEventsToTurns(events)
    // Create subscription function for run history — subscribe whenever runId is valid.
    // We don't gate on isActiveRun/status because the status in the drawer is a stale
    // snapshot from when the drawer was opened. The server won't send events for
    // completed runs anyway, so subscribing for non-active runs is harmless.
    const subscribeToEvents: ChatEventSubscription | null = useMemo(() => {
        if (!runId) return null

        return (callback: (payload: RunHistoryModelSocketEvent) => void) => {
            return subscribeToChatEvents(runId, callback)
        }
    }, [runId])

    // Create send message function for run history
    const sendMessage = (message: ModelRequest) => {
        sendChatMessage(runId, message)
    }

    const handleApprove = (stepId: string, options?: Parameters<typeof sendToolApprovalResponse>[3]) => {
        sendToolApprovalResponse(runId, stepId, true, options)
    }

    const handleReject = (stepId: string, options?: Parameters<typeof sendToolApprovalResponse>[3]) => {
        sendToolApprovalResponse(runId, stepId, false, options)
    }

    const handleCancellation = () => {
        cancelAgentChatRun(runId)
    }

    if (isLoading) {
        return (
            <div className="flex h-full min-h-[280px] flex-col bg-background rounded-lg">
                <div className="flex-1 overflow-hidden p-4">
                    <RunHistoryChatHistorySkeleton />
                </div>
            </div>
        )
    }

    if (children) {
        return (
            <>
                {children({
                    initialTurns: turns,
                    isLoading,
                    runId,
                    startTimestamp,
                    endTimestamp,
                    triggerEvent,
                    triggerEventType,
                    isTriggerEventTruncated,
                    subscribeToEvents,
                    sendMessage,
                    currentStatus,
                    canRetryFromFailure,
                    isRunPending,
                    handleApprove,
                    handleReject,
                    handleCancellation
                })}
            </>
        )
    }

    const emptyPlaceholder =
        turns.length === 0 && isRunPending ? (
            <div className="p-4">
                <AwaitingResponseAnimation />
            </div>
        ) : isLoading ? (
            <RunHistoryChatHistorySkeleton />
        ) : (
            <RunHistoryChatEmptyMessages />
        )

    return (
        <Chat
            initialTurns={turns}
            subscribeToEvents={subscribeToEvents}
            sendMessage={sendMessage}
            addUserTurnsLocally={true}
            onHandleApprove={handleApprove}
            onHandleReject={handleReject}
            onHandleCancellation={handleCancellation}
            EmptyContentPlaceholder={emptyPlaceholder}
        />
    )
}
