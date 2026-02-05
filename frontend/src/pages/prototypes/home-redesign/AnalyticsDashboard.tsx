import { useCallback, useMemo, useRef, useState } from "react"

import { AnimatePresence, motion } from "framer-motion"
import { Activity, ArrowRight, Bot, GitPullRequest, MessageSquare, TrendingUp, Zap } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

import { Chat, ChatHandle } from "@/components/chat/Chat"
import { ChatEventPayload } from "@/components/chat/hooks/useCompletionSocket"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ModelRequest, SendModelRequest } from "@/shared/ModelEvents"
import { sendBuilderMessage, subscribeToBuilderChat } from "@/socket"

const QUICK_ACTION_PROMPTS = [
    "Summarize today's activity",
    "Check PR status",
    "What needs my attention?"
]

// Prominent metric card with visual emphasis
interface MetricTileProps {
    label: string
    value: string
    change: string
    trend: "up" | "down"
    icon: React.ElementType
}

function MetricTile({ label, value, change, trend, icon: Icon }: MetricTileProps) {
    const trendColor = trend === "up" ? "text-emerald-500" : "text-rose-500"
    const trendBg = trend === "up" ? "bg-emerald-500/10" : "bg-rose-500/10"

    return (
        <Card className="relative overflow-hidden">
            <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">{label}</p>
                        <p className="text-3xl font-bold mt-1">{value}</p>
                    </div>
                    <div className={`p-2.5 rounded-xl ${trendBg}`}>
                        <Icon className={`h-5 w-5 ${trendColor}`} />
                    </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                    <TrendingUp className={`h-3.5 w-3.5 ${trendColor}`} />
                    <span className={`text-sm font-medium ${trendColor}`}>{change}</span>
                    <span className="text-xs text-muted-foreground">vs last week</span>
                </div>
            </CardContent>
        </Card>
    )
}

// Mini sparkline chart (simplified for prototype)
function MiniChart() {
    const bars = [40, 65, 45, 80, 55, 70, 90]

    return (
        <div className="flex items-end gap-1 h-12">
            {bars.map((height, i) => (
                <div
                    key={i}
                    className="flex-1 bg-primary/20 rounded-sm transition-all hover:bg-primary/40"
                    style={{ height: `${height}%` }}
                />
            ))}
        </div>
    )
}

// Mock data
const MOCK_METRICS = [
    { label: "Events Processed", value: "1,247", change: "+23%", trend: "up" as const, icon: Activity },
    { label: "Actions Taken", value: "89", change: "+15%", trend: "up" as const, icon: Zap },
    { label: "PRs Monitored", value: "24", change: "+8%", trend: "up" as const, icon: GitPullRequest },
    { label: "Messages Sent", value: "156", change: "-5%", trend: "down" as const, icon: MessageSquare }
]

const MOCK_AGENTS = [
    { name: "PR Review Bot", status: "active", lastRun: "2 min ago", eventsToday: 23 },
    { name: "Slack Digest", status: "active", lastRun: "1 hour ago", eventsToday: 8 },
    { name: "CI Monitor", status: "idle", lastRun: "30 min ago", eventsToday: 15 }
]

export default function AnalyticsDashboard() {
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
                    ui_state: JSON.stringify({ page: "home-analytics-dashboard" })
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

    const handleQuickAction = useCallback((prompt: string) => {
        chatRef.current?.setInput(prompt)
        chatRef.current?.focus()
    }, [])

    return (
        <div className="flex flex-col h-full w-full overflow-auto">
            <div className="mx-auto max-w-6xl w-full p-8 space-y-6">
                {/* Header with Quick Task Bar */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Dashboard</h1>
                        <p className="text-sm text-muted-foreground">Your automation activity at a glance</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {QUICK_ACTION_PROMPTS.map((prompt, i) => (
                            <Button
                                key={i}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => handleQuickAction(prompt)}
                            >
                                {prompt}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {MOCK_METRICS.map(metric => (
                        <MetricTile key={metric.label} {...metric} />
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Activity Chart */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-medium">Event Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-32 flex items-end justify-between gap-2 px-2">
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
                                    const heights = [45, 72, 58, 85, 63, 40, 78]
                                    return (
                                        <div key={day} className="flex-1 flex flex-col items-center gap-2">
                                            <div
                                                className="w-full bg-primary/20 hover:bg-primary/40 rounded-md transition-all cursor-pointer"
                                                style={{ height: `${heights[i]}%` }}
                                            />
                                            <span className="text-xs text-muted-foreground">{day}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Active Agents */}
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-medium">Active Agents</CardTitle>
                                <Button variant="ghost" size="sm" className="text-xs gap-1">
                                    View all <ArrowRight className="h-3 w-3" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {MOCK_AGENTS.map(agent => (
                                <div
                                    key={agent.name}
                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 rounded-md bg-secondary">
                                            <Bot className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{agent.name}</p>
                                            <p className="text-xs text-muted-foreground">{agent.lastRun}</p>
                                        </div>
                                    </div>
                                    <Badge
                                        variant={agent.status === "active" ? "default" : "secondary"}
                                        className="text-xs"
                                    >
                                        {agent.eventsToday} today
                                    </Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Task Section */}
                <Card className="border-dashed">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <AnimatePresence mode="wait">
                                    {hasStartedChat ? (
                                        <motion.div
                                            key="chat"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="w-full"
                                        >
                                            <Chat
                                                ref={chatRef}
                                                key={sessionId}
                                                subscribeToEvents={subscribeToEvents}
                                                sendMessage={sendMessage}
                                                onUserMessage={handleUserMessage}
                                                addUserTurnsLocally={true}
                                                inputSize="small"
                                                placeholders={[]}
                                            />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="prompt"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                        >
                                            <Chat
                                                ref={chatRef}
                                                key={sessionId}
                                                subscribeToEvents={subscribeToEvents}
                                                sendMessage={sendMessage}
                                                onUserMessage={handleUserMessage}
                                                addUserTurnsLocally={true}
                                                inputSize="small"
                                                placeholders={["Ask a quick question or run a task..."]}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
