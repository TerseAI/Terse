import { useMemo } from "react"

import { AwaitingResponseAnimation } from "@/components/chat/AwaitingResponseAnimation"
import { Chat } from "@/components/chat/Chat"
import { Turn } from "@/components/chat/Turn"
import { type ChatEventSubscription } from "@/components/chat/hooks/useCompletionSocket"
import { useChatHistory } from "@/hooks/api/useChatHistory"
import { ModelRequest } from "@/shared/ModelEvents"
import { RunHistoryStatus } from "@/shared/RunHistoryTypes"
import type { RunHistoryModelSocketEvent } from "@/shared/RunHistoryTypes"
import { cancelAgentChatRun, sendChatMessage, sendToolApprovalResponse, subscribeToChatEvents } from "@/socket"

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
        subscribeToEvents?: ChatEventSubscription | null
        sendMessage: (message: ModelRequest) => void
        handleApprove: (stepId: string) => void
        handleReject: (stepId: string) => void
        handleCancellation: () => void
        currentStatus: RunHistoryStatus
        isRunPending: boolean
    }) => React.ReactNode
}

export default function RunHistoryChatAdapter({ runId, status, children }: RunHistoryChatAdapterProps) {
    // Fetch History (API)
    const { events, isLoading, startTimestamp, endTimestamp, status: apiStatus } = useChatHistory(runId)

    // Parse server ISO timestamps to epoch ms for chronological ordering
    const historicalEvents = useMemo(
        () =>
            events.map(event => ({
                ...event
            })),
        [events]
    )

    // Use API status if available, otherwise fall back to prop status
    const currentStatus = apiStatus ?? status
    const isRunPending = currentStatus === RunHistoryStatus.IN_PROGRESS || currentStatus === RunHistoryStatus.AWAITING_APPROVAL

    // Convert to Turns
    const turns = useMemo(() => convertRunHistoryEventsToTurns(historicalEvents), [historicalEvents])

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

    const handleApprove = (stepId: string) => {
        sendToolApprovalResponse(runId, stepId, true)
    }

    const handleReject = (stepId: string) => {
        sendToolApprovalResponse(runId, stepId, false)
    }

    const handleCancellation = () => {
        cancelAgentChatRun(runId)
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
                    subscribeToEvents,
                    sendMessage,
                    currentStatus,
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
            <div className="p-4 text-center text-muted-foreground">Loading history...</div>
        ) : (
            <div className="p-4 text-center text-muted-foreground">No messages found</div>
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
