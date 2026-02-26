import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, ArrowUpRight, ExternalLink, MessageSquare, RotateCcw, Zap } from "lucide-react"

import { convertRunHistoryEventsToTurns } from "@/components/RunHistory/RunHistoryChatDrawer/runHistoryEventsToTurns"
import RunHistoryStatusBadge from "@/components/RunHistory/RunHistoryStatusBadge"
import { Chat, ChatHandle } from "@/components/chat/Chat"
import { ChatEventPayload } from "@/components/chat/hooks/useCompletionSocket"
import { Button } from "@/components/ui/button"
import { useAgents } from "@/hooks/api/useAgents"
import { useStats } from "@/hooks/api/useStats"
import { cn } from "@/lib/utils"
import { IconForIntegration } from "@/pages/Agents/components/Integration"
import { FrontendRoutes } from "@/shared/FrontendRoutes"
import { ModelRequest, SendModelRequest } from "@/shared/ModelEvents"
import { RunHistoryRecordWithAgent } from "@/shared/RunHistoryTypes"
import { cancelBuilderChatSession, sendBuilderMessage, subscribeToBuilderChat } from "@/socket"
import { formatTimestamp } from "@/utility/timeUtils"

import { useBuilderChatHistory } from "../../hooks/api/useBuilderChatHistory"
import { useBuilderSession } from "../../hooks/useBuilderSession"
import { useRunHistoryChatDrawer } from "../../services/RunHistoryChatDrawerContext"

import { HomeEmptyState } from "./components/HomeEmptyState"

function Home() {
    const { agents: allAgents, isLoading: isLoadingAllAgents } = useAgents({ limit: 1 })
    const { stats, isLoading: isLoadingStats } = useStats()
    const navigate = useNavigate()
    const { openDrawer } = useRunHistoryChatDrawer()

    // Builder chat state
    const { sessionId, resetSessionId } = useBuilderSession()
    const [hasStartedChat, setHasStartedChat] = useState(false)
    const chatRef = useRef<ChatHandle>(null)
    const { events: historyEvents, isLoading: isHistoryLoading } = useBuilderChatHistory(sessionId)
    const [initialTurns, setInitialTurns] = useState<ReturnType<typeof convertRunHistoryEventsToTurns>>([])
    useEffect(() => {
        const turns = convertRunHistoryEventsToTurns(historyEvents.map(event => ({ ...event, isHistorical: true })))
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

    // Show nothing (empty container) while initial data is loading
    if (isInitialLoading) {
        return <div className="flex flex-col h-full w-full" />
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
            <motion.div
                className="flex flex-col mx-auto max-w-3xl w-full px-6 pb-3"
                initial={{}}
                animate={hasStartedChat ? { flexGrow: 1, minHeight: 0 } : {}}
                transition={{ duration: ANIMATION_DURATION, ease: ANIMATION_EASE }}
            >
                {hasStartedChat && (
                    <div className="flex justify-end px-2 pt-2 pb-3">
                        <button onClick={handleClearChat} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <RotateCcw className="h-3 w-3" />
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
                        onCancel={handleCancel}
                        onUserMessage={handleUserMessage}
                        addUserTurnsLocally={true}
                        inputSize={hasStartedChat ? "small" : "large"}
                        placeholders={hasStartedChat ? [] : HOME_PLACEHOLDERS}
                    />
                </div>
            </motion.div>

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
                                            <h2 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">Stats</h2>
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

                                        <div className="rounded-2xl border border-border/60 bg-card/30 backdrop-blur-sm overflow-hidden divide-y divide-border/40">
                                            {recentRuns.map(run => (
                                                <RunRow key={run.id} run={run} onOpenChat={handleOpenChat} />
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
// Stat Helpers
// ---------------------------------------------------------------------------

function getTrend(change: string): "up" | "down" {
    return change.startsWith("+") || (!change.startsWith("-") && change !== "0%") ? "up" : "down"
}

function formatNumber(num: number): string {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
    return num.toLocaleString()
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatPill({ label, value, change }: { label: string; value: string; change: string }) {
    const trend = getTrend(change)
    return (
        <div className="group relative flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-border hover:bg-card hover:shadow-sm">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
            <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
                <span className={cn("text-xs font-medium", trend === "up" ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>{change}</span>
            </div>
        </div>
    )
}

function RunRow({ run, onOpenChat }: { run: RunHistoryRecordWithAgent; onOpenChat: (run: RunHistoryRecordWithAgent) => void }) {
    const navigate = useNavigate()

    const title = run.trigger.title || run.trigger.source
    const writeActions = (run.actions ?? []).filter(a => a.type !== "read")

    return (
        <div className="group flex items-center gap-4 px-4 py-3 rounded-xl transition-colors duration-150 hover:bg-muted/40">
            {/* Integration icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
                <IconForIntegration integration={run.trigger.integration} />
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{title}</span>
                    {run.trigger.url && (
                        <a
                            href={run.trigger.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <button
                        onClick={() => navigate(FrontendRoutes.AGENTS.DETAIL(run.agentId))}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]"
                        title={run.agentName}
                    >
                        {run.agentName}
                    </button>
                    {run.trigger.subheader && (
                        <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground truncate">{run.trigger.subheader}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Write actions count */}
            {writeActions.length > 0 && (
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="w-3 h-3" />
                    <span>
                        {writeActions.length} action{writeActions.length !== 1 ? "s" : ""}
                    </span>
                </div>
            )}

            {/* Status */}
            <RunHistoryStatusBadge status={run.status} filtered={run.filtered} className="hidden sm:flex" />

            {/* Timestamp */}
            <span className="text-xs text-muted-foreground whitespace-nowrap w-16 text-right">{formatTimestamp(run.timestamp)}</span>

            {/* Chat button */}
            <Button variant="ghost" size="icon-sm" onClick={() => onOpenChat(run)} className="opacity-0 group-hover:opacity-100 transition-opacity" title="View run details">
                <MessageSquare className="w-3.5 h-3.5" />
            </Button>
        </div>
    )
}
export default Home
