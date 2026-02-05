import { useCallback, useMemo, useRef, useState } from "react"

import { AnimatePresence, motion } from "framer-motion"
import { Activity, Bot, Clock, Zap } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

import { Chat, ChatHandle } from "@/components/chat/Chat"
import { ChatEventPayload } from "@/components/chat/hooks/useCompletionSocket"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ModelRequest, SendModelRequest } from "@/shared/ModelEvents"
import { sendBuilderMessage, subscribeToBuilderChat } from "@/socket"

const COMMAND_CENTER_PLACEHOLDERS = [
    "Build an agent that reads Slack every day and tells me what actually matters",
    "I want to get notified when PRs are waiting on review too long",
    "Create something that generates my standup from GitHub and Slack",
    "Help me connect my GitHub account"
]

// Compact stat display for the command center
interface QuickStatProps {
    label: string
    value: string
    icon: React.ElementType
    trend?: "up" | "down" | "neutral"
}

function QuickStat({ label, value, icon: Icon, trend = "neutral" }: QuickStatProps) {
    const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-rose-500" : "text-muted-foreground"

    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <div className="p-2 rounded-lg bg-secondary/50">
                <Icon className={`h-4 w-4 ${trendColor}`} />
            </div>
            <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-lg font-semibold">{value}</span>
            </div>
        </div>
    )
}

// Mock data for the prototype
const MOCK_STATS = [
    { label: "Events Today", value: "47", icon: Activity, trend: "up" as const },
    { label: "Active Agents", value: "3", icon: Bot, trend: "neutral" as const },
    { label: "Actions Taken", value: "12", icon: Zap, trend: "up" as const },
    { label: "Avg Response", value: "1.2s", icon: Clock, trend: "down" as const }
]

const MOCK_RECENT_ACTIVITY = [
    { agent: "PR Review Bot", action: "Notified you about 2 PRs needing review", time: "5 min ago" },
    { agent: "Slack Digest", action: "Summarized #engineering channel", time: "1 hour ago" },
    { agent: "CI Monitor", action: "Detected and reported failing build", time: "2 hours ago" }
]

export default function CommandCenter() {
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
                    ui_state: JSON.stringify({ page: "home-command-center" })
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

    return (
        <div className="flex flex-col h-full w-full">
            {/* Hero Section with Prompt */}
            <motion.div
                className="flex flex-col mx-auto max-w-4xl w-full px-8 pt-8"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <AnimatePresence>
                    {!hasStartedChat && (
                        <motion.div
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h1 className="text-3xl font-semibold mb-2">What can I help you with?</h1>
                            <p className="text-muted-foreground mb-6">
                                Build new agents, connect integrations, or ask about your existing automations.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className={`${hasStartedChat ? "flex-1 min-h-0" : ""}`}>
                    <Chat
                        ref={chatRef}
                        key={sessionId}
                        subscribeToEvents={subscribeToEvents}
                        sendMessage={sendMessage}
                        onUserMessage={handleUserMessage}
                        addUserTurnsLocally={true}
                        inputSize={hasStartedChat ? "small" : "large"}
                        placeholders={hasStartedChat ? [] : COMMAND_CENTER_PLACEHOLDERS}
                    />
                </div>
            </motion.div>

            {/* Stats and Activity Section - Collapses when chatting */}
            <AnimatePresence>
                {!hasStartedChat && (
                    <motion.div
                        className="flex-1 px-8 pb-8 overflow-auto"
                        initial={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.4 }}
                    >
                        <div className="mx-auto max-w-4xl w-full space-y-6 mt-8">
                            {/* Quick Stats Row */}
                            <Card className="overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border">
                                        {MOCK_STATS.map(stat => (
                                            <QuickStat key={stat.label} {...stat} />
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Recent Activity */}
                            <div>
                                <h2 className="text-sm font-medium text-muted-foreground mb-3">Recent Activity</h2>
                                <div className="space-y-2">
                                    {MOCK_RECENT_ACTIVITY.map((activity, idx) => (
                                        <Card key={idx} className="hover:bg-secondary/30 transition-colors cursor-pointer">
                                            <CardContent className="py-3 px-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 rounded-md bg-primary/10">
                                                        <Bot className="h-3.5 w-3.5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">{activity.agent}</p>
                                                        <p className="text-xs text-muted-foreground">{activity.action}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className="text-xs">
                                                    {activity.time}
                                                </Badge>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Expanded chat area when active */}
            {hasStartedChat && (
                <motion.div
                    className="flex-1 min-h-0 px-8 pb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                >
                    <div className="mx-auto max-w-4xl w-full h-full" />
                </motion.div>
            )}
        </div>
    )
}
