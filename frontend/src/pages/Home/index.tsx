import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, ArrowUpRight, RotateCcw } from "lucide-react"

import { convertRunHistoryEventsToTurns } from "@/components/RunHistory/RunHistoryChatDrawer/runHistoryEventsToTurns"
import { RunHistoryRow } from "@/components/RunHistory/RunHistoryRow"
import { Chat, ChatHandle } from "@/components/chat/Chat"
import { ChatEventPayload } from "@/components/chat/hooks/useCompletionSocket"
import { Button } from "@/components/ui/button"
import { useAgents } from "@/hooks/api/useAgents"
import { useStats } from "@/hooks/api/useStats"
import { cn } from "@/lib/utils"
import { FrontendRoutes } from "@/shared/FrontendRoutes"
import { ModelRequest, SendModelRequest } from "@/shared/ModelEvents"
import { RunHistoryRecordWithAgent } from "@/shared/RunHistoryTypes"
import { cancelBuilderChatSession, sendBuilderMessage, subscribeToBuilderChat } from "@/socket"
import { formatNumber, getTrend } from "@/utility/timeUtils"

import { Skeleton } from "@/components/ui/skeleton"
import { useBuilderChatHistory } from "../../hooks/api/useBuilderChatHistory"
import { useBuilderSession } from "../../hooks/useBuilderSession"
import { useRunHistoryChatDrawer } from "../../services/RunHistoryChatDrawerContext"

import { HomeEmptyState } from "./components/HomeEmptyState"

function Home() {
    const { agents: allAgents, isLoading: isLoadingAllAgents } = useAgents({ limit: 1 })
    const { stats, isLoading: isLoadingStats } = useStats("1mo")
    const navigate = useNavigate()
    const { openDrawer } = useRunHistoryChatDrawer()

    // Builder chat state
    const { sessionId, resetSessionId } = useBuilderSession()
    const [hasStartedChat, setHasStartedChat] = useState(false)
    const chatRef = useRef<ChatHandle>(null)
    const { events: historyEvents, isLoading: isHistoryLoading } = useBuilderChatHistory(sessionId)
    const [initialTurns, setInitialTurns] = useState<ReturnType<typeof convertRunHistoryEventsToTurns>>([])
    useEffect(() => {
        const turns = convertRunHistoryEventsToTurns(historyEvents)
        setInitialTurns(turns)
        if (turns.length > 0) {
            setHasStartedChat(true)
        }
    }, [historyEvents])

    // Unified loading: wait for agents + chat history before deciding what to show.
    // This prevents the flicker where the "has agents" view briefly shows before
    // switching to the empty state (or vice versa).
    const isInitialLoading = isLoadingAllAgents || isHistoryLoading

    // Builder chat callbacks (must be before any early returns — Rules of Hooks)
    const subscribeToEvents = useCallback(
        (callback: (payload: ChatEventPayload) => void) => {
            return subscribeToBuilderChat(sessionId, payload => {
                callback({ runHistoryModelEvent: payload.event })
            })
        },
        [sessionId]
    )

    const sendMessage = useCallback(
        (message: ModelRequest) => {
            if (!hasStartedChat) setHasStartedChat(true)

            if (message.type === "SendModelRequest") {
                const enrichedMessage: { type: "SendModelRequest" } & SendModelRequest = {
                    ...message,
                    ui_state: JSON.stringify({ page: "agent-setup" })
                }
                sendBuilderMessage(sessionId, enrichedMessage)
            } else {
                sendBuilderMessage(sessionId, message)
            }
        },
        [sessionId, hasStartedChat]
    )

    const handleUserMessage = useCallback(() => {
        if (!hasStartedChat) setHasStartedChat(true)
    }, [hasStartedChat])

    const handleCancel = async () => {
        const response = await cancelBuilderChatSession(sessionId)
        return response.accepted
    }

    // Run drawer handlers
    const handleOpenChat = (run: RunHistoryRecordWithAgent) => {
        openDrawer({
            runs: recentRuns,
            initialRunIndex: recentRuns.findIndex(r => r.id === run.id)
        })
    }

    const handleClearChat = () => {
        resetSessionId()
        setHasStartedChat(false)
    }

    // Show skeleton while initial data is loading
    if (isInitialLoading) {
        return (
            <div className="flex flex-col h-full w-full" aria-busy="true">
                <div className="mx-auto max-w-3xl w-full px-6 mt-8 mb-4">
                    <Skeleton className="h-8 w-64 mx-auto mb-2" />
                    <Skeleton className="h-4 w-80 mx-auto" />
                </div>
                <div className="mx-auto max-w-3xl w-full px-6 pb-3">
                    <Skeleton className="h-16 w-full rounded-2xl" />
                </div>
                <div className="mx-auto max-w-4xl w-full px-6 pb-8 space-y-6 mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Skeleton className="h-20 rounded-2xl" />
                        <Skeleton className="h-20 rounded-2xl" />
                        <Skeleton className="h-20 rounded-2xl" />
                    </div>
                    <div className="rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 px-4 py-3">
                                <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                                <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />
                                <Skeleton className="h-3 w-12" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // Show empty state if user has no agents
    const hasNoAgents = allAgents.length === 0
    if (hasNoAgents) {
        return <HomeEmptyState />
    }

    // Data
    const recentRuns = stats?.recentRuns || []
    const totalEvents = stats?.totalEventsProcessed ?? 0
    const actionsTaken = stats?.actionsTaken ?? 0
    const numberOfAgents = stats?.numberOfAgents ?? 0

    return (
        <div className="flex flex-col h-full w-full">
            {/* ── Hero + Prompt ─────────────────────────────────────── */}
            <div
                style={{
                    height: hasStartedChat ? 0 : "auto",
                    overflow: "visible",
                    marginTop: hasStartedChat ? 0 : 32,
                    marginBottom: 0
                }}
            >
                <AnimatePresence>
                    {!hasStartedChat && (
                        <motion.div
                            className="mx-auto max-w-3xl w-full px-6"
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0, filter: "blur(8px)" }}
                            transition={{ duration: ANIMATION_DURATION / 4, ease: ANIMATION_EASE }}
                        >
                            <div className="text-center mb-2">
                                <h1 className="text-3xl font-semibold text-foreground tracking-tight">What can I help you build?</h1>
                                <p className="text-muted-foreground mt-2 text-base">
                                    Describe an agent and I'll set it up for you, or{" "}
                                    <button
                                        onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}
                                        className="inline-flex items-center gap-1 text-foreground font-medium hover:underline underline-offset-4 transition-colors"
                                    >
                                        browse templates
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Chat Input / Full Chat ────────────────────────────── */}
            <div className={cn("flex flex-col mx-auto max-w-3xl w-full px-6 pb-3 min-h-0", hasStartedChat && "flex-1")}>
                {hasStartedChat && (
                    <div className="flex justify-end px-2 pt-2 pb-3">
                        <button onClick={handleClearChat} aria-label="Reset chat" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <RotateCcw className="h-3 w-3" aria-hidden="true" />
                            Reset chat
                        </button>
                    </div>
                )}
                <div className="flex-1 min-h-0 w-full">
                    <Chat
                        ref={chatRef}
                        key={sessionId}
                        initialTurns={initialTurns}
                        subscribeToEvents={subscribeToEvents}
                        sendMessage={sendMessage}
                        onHandleCancellation={handleCancel}
                        onUserMessage={handleUserMessage}
                        addUserTurnsLocally={true}
                        inputSize={hasStartedChat ? "small" : "large"}
                        placeholders={hasStartedChat ? [] : HOME_PLACEHOLDERS}
                    />
                </div>
            </div>

            {/* ── Dashboard (stats + runs) — collapses when chatting ── */}
            <div
                className="relative"
                style={{
                    height: hasStartedChat ? 0 : "auto",
                    overflow: hasStartedChat ? "hidden" : "visible",
                    transition: "none"
                }}
            >
                <AnimatePresence>
                    {!hasStartedChat && (
                        <motion.div className="w-full" initial={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(8px)", y: 40 }} transition={{ duration: ANIMATION_DURATION, ease: ANIMATION_EASE }}>
                            <div className="mx-auto max-w-4xl w-full px-6 pb-8 space-y-6">
                                {/* ── Divider ─────────────────────────────── */}
                                <div className="flex items-center gap-4 pt-2">
                                    <div className="h-px flex-1 bg-border/60" />
                                </div>

                                {/* ── Stats Row ──────────────────────────── */}
                                {!isLoadingStats && stats && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">Stats</h2>
                                                <span className="text-xs text-muted-foreground/60">Last 30 days</span>
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={() => navigate(FrontendRoutes.STATS)}>
                                                View all stats
                                                <ArrowUpRight className="w-3 h-3" />
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <StatPill label="Events processed" value={formatNumber(totalEvents)} change={stats.totalEventsProcessedChange} />
                                            <StatPill label="Actions taken" value={formatNumber(actionsTaken)} change={stats.actionsTakenChange} />
                                            <StatPill label="Active Agents" value={formatNumber(numberOfAgents)} change={stats.numberOfAgentsChange} />
                                        </div>
                                    </div>
                                )}

                                {/* ── Recent Runs ────────────────────────── */}
                                {recentRuns.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h2 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">Recent Activity</h2>
                                            {recentRuns.length > 0 && (
                                                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={() => navigate(FrontendRoutes.ACTIVITY)}>
                                                    View all
                                                    <ArrowUpRight className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>

                                        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
                                            {recentRuns.map(run => (
                                                <RunHistoryRow key={run.id} run={run} onOpenChat={handleOpenChat} className="rounded-xl" />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANIMATION_DURATION = 0.8
const ANIMATION_EASE = [0.4, 0, 0.2, 1] as const

const HOME_PLACEHOLDERS = [
    "An agent that reads my Slack every day and tells me only what actually matters",
    "Track GitHub PRs across all my repos and nudge me when I need to act",
    "Automatically update Linear and post in Slack when my PRs get merged",
    "Draft weekly release notes from merged PRs and commits"
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatPill({ label, value, change }: { label: string; value: string; change: string }) {
    const trend = getTrend(change)
    return (
        <div className="group relative flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-card px-5 py-4 transition-all duration-300 hover:border-border hover:shadow-sm">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
            <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
                <span className={cn("text-xs font-medium", trend === "up" ? "text-success" : "text-danger")}>{change}</span>
            </div>
        </div>
    )
}

export default Home
