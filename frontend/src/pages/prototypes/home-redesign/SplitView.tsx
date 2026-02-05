import { useCallback, useMemo, useRef, useState } from "react"

import { motion } from "framer-motion"
import { Activity, Bot, ChevronRight, Clock, GitPullRequest, MessageSquare, Sparkles, TrendingUp, Zap } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

import { Chat, ChatHandle } from "@/components/chat/Chat"
import { ChatEventPayload } from "@/components/chat/hooks/useCompletionSocket"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ModelRequest, SendModelRequest } from "@/shared/ModelEvents"
import { sendBuilderMessage, subscribeToBuilderChat } from "@/socket"

const SPLIT_VIEW_PLACEHOLDERS = [
    "What's happening in my workspace today?",
    "Help me catch up on what I missed",
    "Show me what needs my attention",
    "Create a new agent to monitor..."
]

// Context suggestion for the left panel
interface ContextSuggestionProps {
    icon: React.ElementType
    title: string
    description: string
    onClick: () => void
}

function ContextSuggestion({ icon: Icon, title, description, onClick }: ContextSuggestionProps) {
    return (
        <button
            onClick={onClick}
            className="w-full text-left p-3 rounded-lg border border-border/50 hover:border-border hover:bg-secondary/30 transition-all group"
        >
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-secondary/50 group-hover:bg-secondary transition-colors">
                    <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-2" />
            </div>
        </button>
    )
}

// Compact stat for the right panel
interface CompactStatProps {
    label: string
    value: string
    change?: string
    trend?: "up" | "down"
}

function CompactStat({ label, value, change, trend }: CompactStatProps) {
    const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-rose-500" : ""

    return (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{value}</span>
                {change && (
                    <span className={`text-xs ${trendColor}`}>{change}</span>
                )}
            </div>
        </div>
    )
}

// Mock data
const MOCK_SUGGESTIONS = [
    {
        icon: GitPullRequest,
        title: "Review 3 pending PRs",
        description: "2 from your team need immediate attention"
    },
    {
        icon: MessageSquare,
        title: "Catch up on #engineering",
        description: "47 messages since you last checked"
    },
    {
        icon: Activity,
        title: "Check CI status",
        description: "2 pipelines completed, 1 failed"
    }
]

const MOCK_STATS = [
    { label: "Events today", value: "247", change: "+18%", trend: "up" as const },
    { label: "Actions taken", value: "34", change: "+7%", trend: "up" as const },
    { label: "Response time", value: "1.3s", change: "-12%", trend: "up" as const },
    { label: "Success rate", value: "98.5%", change: "+0.3%", trend: "up" as const }
]

const MOCK_RECENT_RUNS = [
    { agent: "PR Review Bot", time: "2 min ago", status: "success" as const },
    { agent: "Daily Standup", time: "8 min ago", status: "success" as const },
    { agent: "Slack Watcher", time: "15 min ago", status: "success" as const },
    { agent: "CI Monitor", time: "23 min ago", status: "warning" as const }
]

export default function SplitView() {
    const [hasStartedChat, setHasStartedChat] = useState(false)
    const chatRef = useRef<ChatHandle>(null)
    const sessionId = useMemo(() => uuidv4(), [])

    const subscribeToEvents = useCallback(
        (callback: (payload: ChatEventPayload) => void) => {
            const unsubscribe = subscribeToBuilderChat(sessionId, payload => {
                callback({
                    runHistoryModelEvent: payload.event
                })
            })
            return unsubscribe
        },
        [sessionId]
    )

    const sendMessage = useCallback(
        (message: ModelRequest) => {
            if (!hasStartedChat) {
                setHasStartedChat(true)
            }

            if (message.type === "SendModelRequest") {
                const enrichedMessage: { type: "SendModelRequest" } & SendModelRequest = {
                    ...message,
                    ui_state: JSON.stringify({ page: "home-split-view" })
                }
                sendBuilderMessage(sessionId, enrichedMessage)
            } else {
                sendBuilderMessage(sessionId, message)
            }
        },
        [sessionId, hasStartedChat]
    )

    const handleUserMessage = useCallback(() => {
        if (!hasStartedChat) {
            setHasStartedChat(true)
        }
    }, [hasStartedChat])

    const handleSuggestionClick = useCallback((suggestion: typeof MOCK_SUGGESTIONS[0]) => {
        chatRef.current?.setInput(`Help me ${suggestion.title.toLowerCase()}`)
        chatRef.current?.focus()
    }, [])

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Left Panel - Conversational */}
            <div className="flex-1 flex flex-col border-r border-border min-w-0">
                <motion.div
                    className="flex flex-col h-full p-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            <h1 className="text-xl font-semibold">Your Workspace</h1>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Ask questions, run tasks, or explore what's happening
                        </p>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 min-h-0 flex flex-col">
                        <Chat
                            ref={chatRef}
                            key={sessionId}
                            subscribeToEvents={subscribeToEvents}
                            sendMessage={sendMessage}
                            onUserMessage={handleUserMessage}
                            addUserTurnsLocally={true}
                            inputSize={hasStartedChat ? "small" : "medium"}
                            placeholders={hasStartedChat ? [] : SPLIT_VIEW_PLACEHOLDERS}
                        />
                    </div>

                    {/* Context Suggestions - Hide when chatting */}
                    {!hasStartedChat && (
                        <motion.div
                            className="mt-6 space-y-2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                        >
                            <p className="text-xs font-medium text-muted-foreground mb-3">Suggested actions</p>
                            {MOCK_SUGGESTIONS.map((suggestion, i) => (
                                <ContextSuggestion
                                    key={i}
                                    {...suggestion}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                />
                            ))}
                        </motion.div>
                    )}
                </motion.div>
            </div>

            {/* Right Panel - Stats & Activity */}
            <motion.div
                className="w-80 lg:w-96 flex flex-col bg-secondary/20 overflow-auto"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
            >
                <div className="p-6 space-y-6">
                    {/* Quick Stats */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Today's Overview
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="divide-y divide-border/50">
                            {MOCK_STATS.map(stat => (
                                <CompactStat key={stat.label} {...stat} />
                            ))}
                        </CardContent>
                    </Card>

                    {/* Recent Agent Runs */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Recent Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {MOCK_RECENT_RUNS.map((run, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between py-2 hover:bg-secondary/50 rounded-lg px-2 -mx-2 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-1.5 rounded-md ${
                                            run.status === "success" ? "bg-emerald-500/10" : "bg-amber-500/10"
                                        }`}>
                                            <Bot className={`h-3.5 w-3.5 ${
                                                run.status === "success" ? "text-emerald-500" : "text-amber-500"
                                            }`} />
                                        </div>
                                        <span className="text-sm">{run.agent}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{run.time}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Active Agents Count */}
                    <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Zap className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Active Agents</p>
                                        <p className="text-xs text-muted-foreground">Running now</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="text-lg font-semibold px-3">
                                    3
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </motion.div>
        </div>
    )
}
