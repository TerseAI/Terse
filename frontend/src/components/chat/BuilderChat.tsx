import { useCallback, useEffect, useMemo, useRef } from "react"

import { Bot, MessageSquare, Plug, Settings } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

import { convertRunHistoryEventsToTurns } from "@/components/RunHistory/RunHistoryChatDrawer/RunHistoryChatAdapter"
import { useBuilderChatHistory } from "@/hooks/api/useBuilderChatHistory"
import { ModelRequest, SendModelRequest } from "@/shared/ModelEvents"
import { sendBuilderMessage, sendBuilderMultipleChoiceAnswer, subscribeToBuilderChat } from "@/socket"

import { Chat } from "./Chat"
import { ChatEventPayload } from "./hooks/useCompletionSocket"

type BuilderChatProps = {
    getStateJSON: () => string
    agentId?: string | null
}

export function BuilderChat({ getStateJSON, agentId }: BuilderChatProps) {
    const generatedId = useMemo(() => uuidv4(), [])
    const sessionId = agentId ?? generatedId
    const previousAgentIdRef = useRef<string | null | undefined>(agentId)

    // Fetch history only when we have an agentId (existing session)
    const { events: historyEvents, isLoading: isHistoryLoading } = useBuilderChatHistory(agentId)

    // Convert history events to turns (mark as historical to disable animation)
    const initialTurns = agentId && historyEvents.length > 0 ? convertRunHistoryEventsToTurns(historyEvents.map(event => ({ ...event, isHistorical: true }))) : undefined

    useEffect(() => {
        // Only reset if agentId actually changed (not on initial mount)
        if (previousAgentIdRef.current !== undefined && previousAgentIdRef.current !== agentId) {
            // The key change will handle the reset, but we can log it for debugging
            console.log("[BuilderChat] Agent changed, resetting chat", {
                previous: previousAgentIdRef.current,
                current: agentId,
                sessionId
            })
        }
        previousAgentIdRef.current = agentId
    }, [agentId, sessionId])

    const subscribeToEvents = (callback: (payload: ChatEventPayload) => void) => {
        console.log("[BuilderChat] subscribeToEvents called", { sessionId })
        const unsubscribe = subscribeToBuilderChat(sessionId, payload => {
            console.log("[BuilderChat] Event received", payload.event.type)
            callback({
                runHistoryModelEvent: payload.event
            })
        })
        console.log("[BuilderChat] Subscription created")
        return unsubscribe
    }

    const sendMessage = useCallback(
        (message: ModelRequest) => {
            if (message.type === "SendModelRequest") {
                const enrichedMessage: { type: "SendModelRequest" } & SendModelRequest = {
                    ...message,
                    ui_state: getStateJSON()
                }
                sendBuilderMessage(sessionId, enrichedMessage)
            } else {
                sendBuilderMessage(sessionId, message)
            }
        },
        [sessionId, getStateJSON]
    )

    const handleMultipleChoiceAnswer = useCallback(
        (questionId: string, value: string) => {
            sendBuilderMultipleChoiceAnswer(sessionId, questionId, value)
        },
        [sessionId]
    )

    // Show loading state while fetching history for existing sessions
    if (agentId && isHistoryLoading) {
        return (
            <div className="h-full flex items-center justify-center p-2">
                <div className="text-muted-foreground">Loading conversation...</div>
            </div>
        )
    }

    return (
        <div className="h-full flex min-h-0 p-2">
            <Chat
                key={sessionId}
                subscribeToEvents={subscribeToEvents}
                sendMessage={sendMessage}
                addUserTurnsLocally={true}
                initialTurns={initialTurns}
                EmptyContentPlaceholder={<BuilderChatEmptyState />}
                onMultipleChoiceAnswer={handleMultipleChoiceAnswer}
            />
        </div>
    )
}

function BuilderChatEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto">
            <div className="mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Welcome to Terse AI Chat</h3>
                <p className="text-muted-foreground mb-6">I'm here to help manage your AI agents that automate work for your software team.</p>
            </div>

            <div className="space-y-4 text-left w-full">
                <div className="rounded-lg border bg-card p-4">
                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-5 h-5 text-primary" />
                        </div>
                        Manage Agents
                    </h4>
                    <p className="text-sm text-muted-foreground">
                        Tell me about a problem you want to automate, and I'll help you manage your agent with triggers, outputs, prompts, and knowledge bases.
                    </p>
                </div>

                <div className="rounded-lg border bg-card p-4">
                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Plug className="w-5 h-5 text-primary" />
                        </div>
                        Connect Integrations
                    </h4>
                    <p className="text-sm text-muted-foreground">I can help you connect Slack, Notion, GitHub, Linear, and other integrations to power your agents.</p>
                </div>

                <div className="rounded-lg border bg-card p-4">
                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Settings className="w-5 h-5 text-primary" />
                        </div>
                        Configure Settings
                    </h4>
                    <p className="text-sm text-muted-foreground">Modify existing agents, update integration settings, or adjust how your agents work.</p>
                </div>
            </div>
        </div>
    )
}
