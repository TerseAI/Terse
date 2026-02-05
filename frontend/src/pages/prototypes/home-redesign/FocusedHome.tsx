import { useCallback, useMemo, useRef, useState } from "react"

import { AnimatePresence, Easing, motion } from "framer-motion"
import { MessageSquare } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

import { Chat, ChatHandle } from "@/components/chat/Chat"
import { ChatEventPayload } from "@/components/chat/hooks/useCompletionSocket"
import RunHistoryChatDrawer from "@/components/RunHistory/RunHistoryChatDrawer"
import RunHistoryStatusBadge from "@/components/RunHistory/RunHistoryStatusBadge"
import { Button } from "@/components/ui/button"
import { IconForIntegration } from "@/pages/Agents/components/Integration"
import { ModelRequest, SendModelRequest } from "@/shared/ModelEvents"
import { RunHistoryRecord } from "@/shared/RunHistoryTypes"
import { sendBuilderMessage, subscribeToBuilderChat } from "@/socket"
import { formatRelativeTime } from "@/utility/timeUtils"

const AGENT_SETUP_PLACEHOLDERS = [
    "An agent that reads my Slack every day and tells me only what actually matters",
    "Something that tracks GitHub PRs across all my repos and nudges me when I need to act",
    "Automatically update Linear and post in Slack when my PRs get merged",
    "Generate my standup update from GitHub, Slack, and calendar activity",
    "Notify me when a PR is blocked or waiting on review too long",
    "Watch CI failures and alert the right people before things pile up"
]

const ANIMATION_DURATION = 0.8
const ANIMATION_EASE: Easing = [0.4, 0, 0.2, 1]

// Mock data for recent runs - in production, this would come from an API
const MOCK_RECENT_RUNS: RunHistoryRecord[] = [
    {
        id: "run-1",
        agentId: "agent-1",
        timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        trigger: {
            event: "PR Merged",
            integration: "github",
            source: "terseai/platform",
            title: "feat: Add user authentication flow",
            subheader: "Pull Request #142"
        },
        filtered: false,
        decision: { action: "processed", reasoning: "PR was merged and requires notification" },
        actions: [
            { action: "Posted message", integration: "slack", target: "#engineering", details: "Notified team of merge", type: "create" }
        ],
        status: "success"
    },
    {
        id: "run-2",
        agentId: "agent-2",
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        trigger: {
            event: "Message Received",
            integration: "slack",
            source: "#product-updates",
            title: "New feature request from customer",
            subheader: "@sarah.chen"
        },
        filtered: false,
        decision: { action: "processed", reasoning: "Message contains actionable feedback" },
        actions: [
            { action: "Created ticket", integration: "linear", target: "PROD-234", details: "Created Linear issue from Slack message", type: "create" }
        ],
        status: "success"
    },
    {
        id: "run-3",
        agentId: "agent-1",
        timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        trigger: {
            event: "CI Failed",
            integration: "github",
            source: "terseai/api",
            title: "Build failed on main",
            subheader: "Workflow: test-suite"
        },
        filtered: false,
        decision: { action: "processed", reasoning: "CI failure requires immediate attention" },
        actions: [
            { action: "Posted alert", integration: "slack", target: "#ci-alerts", details: "Notified team of build failure", type: "create" }
        ],
        status: "success"
    },
    {
        id: "run-4",
        agentId: "agent-3",
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        trigger: {
            event: "Comment Added",
            integration: "figma",
            source: "Dashboard Redesign",
            title: "Feedback on metrics layout",
            subheader: "@design-team"
        },
        filtered: true,
        decision: { action: "skipped", reasoning: "Comment was a reply, not a new thread" },
        status: "skipped"
    },
    {
        id: "run-5",
        agentId: "agent-2",
        timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
        trigger: {
            event: "Issue Updated",
            integration: "linear",
            source: "ENG-567",
            title: "API performance optimization",
            subheader: "Status changed to In Review"
        },
        filtered: false,
        decision: { action: "processed", reasoning: "Status change requires Slack update" },
        actions: [
            { action: "Posted update", integration: "slack", target: "#engineering", details: "Shared status update", type: "create" }
        ],
        status: "success"
    }
]

export default function FocusedHome() {
    const [hasStartedChat, setHasStartedChat] = useState(false)
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
    const chatRef = useRef<ChatHandle>(null)

    const sessionId = useMemo(() => uuidv4(), [])

    const selectedRun = useMemo(() => {
        return MOCK_RECENT_RUNS.find(r => r.id === selectedRunId) || null
    }, [selectedRunId])

    const currentRunIndex = useMemo(() => {
        if (!selectedRunId) return undefined
        return MOCK_RECENT_RUNS.findIndex(r => r.id === selectedRunId)
    }, [selectedRunId])

    const subscribeToEvents = useCallback(
        (callback: (payload: ChatEventPayload) => void) => {
            const unsubscribe = subscribeToBuilderChat(sessionId, payload => {
                callback({ runHistoryModelEvent: payload.event })
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
                    ui_state: JSON.stringify({ page: "home" })
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

    const handleRunClick = (runId: string) => {
        setSelectedRunId(runId)
    }

    const handleDrawerClose = (open: boolean) => {
        if (!open) {
            setSelectedRunId(null)
        }
    }

    const handleNavigateToRun = (runId: string) => {
        setSelectedRunId(runId)
    }

    const headerVariants = {
        visible: { opacity: 1 },
        hidden: { opacity: 0, filter: "blur(8px)" }
    }

    const chatSectionVariants = {
        initial: { minHeight: 200 },
        expanded: { flexGrow: 1, minHeight: 0 }
    }

    const runsVariants = {
        visible: { opacity: 1, filter: "blur(0px)", y: 0 },
        hidden: { opacity: 0, filter: "blur(8px)", y: 200 }
    }

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div
                style={{
                    height: hasStartedChat ? 0 : "auto",
                    overflow: "visible",
                    marginTop: hasStartedChat ? 0 : 32,
                    marginBottom: hasStartedChat ? 0 : 8
                }}
            >
                <AnimatePresence>
                    {!hasStartedChat && (
                        <motion.div
                            className="mx-auto max-w-4xl w-full px-4"
                            variants={headerVariants}
                            initial="visible"
                            animate="visible"
                            exit="hidden"
                            transition={{ duration: ANIMATION_DURATION / 4, ease: ANIMATION_EASE }}
                        >
                            <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
                            <p className="text-muted-foreground mt-1">Describe what you want to build, or review recent activity below.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Chat Section */}
            <motion.div
                className="flex flex-col mx-auto max-w-4xl w-full pb-3 px-4"
                variants={chatSectionVariants}
                initial="initial"
                animate={hasStartedChat ? "expanded" : "initial"}
                transition={{ duration: ANIMATION_DURATION, ease: ANIMATION_EASE }}
            >
                <div className="flex-1 min-h-0 w-full">
                    <Chat
                        ref={chatRef}
                        key={sessionId}
                        subscribeToEvents={subscribeToEvents}
                        sendMessage={sendMessage}
                        onUserMessage={handleUserMessage}
                        addUserTurnsLocally={true}
                        inputSize={hasStartedChat ? "small" : "large"}
                        placeholders={hasStartedChat ? [] : AGENT_SETUP_PLACEHOLDERS}
                    />
                </div>
            </motion.div>

            {/* Recent Runs Section */}
            <div
                className="relative"
                style={{
                    height: hasStartedChat ? 0 : "auto",
                    overflow: "visible",
                    transition: "none"
                }}
            >
                <AnimatePresence>
                    {!hasStartedChat && (
                        <motion.div
                            className="w-full"
                            variants={runsVariants}
                            initial="visible"
                            animate="visible"
                            exit="hidden"
                            transition={{ duration: ANIMATION_DURATION, ease: ANIMATION_EASE }}
                        >
                            <div className="px-4 pb-8">
                                <div className="mx-auto max-w-4xl space-y-4">
                                    {/* Divider */}
                                    <div className="flex items-center gap-4">
                                        <div className="h-px flex-1 bg-border" />
                                        <span className="text-sm text-muted-foreground">recent activity</span>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>

                                    {/* Runs List */}
                                    <div className="space-y-2">
                                        {MOCK_RECENT_RUNS.map(run => (
                                            <RunListItem
                                                key={run.id}
                                                run={run}
                                                onClick={() => handleRunClick(run.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Run History Drawer */}
            {selectedRun && (
                <RunHistoryChatDrawer
                    runId={selectedRun.id}
                    isOpen={!!selectedRunId}
                    onOpenChange={handleDrawerClose}
                    status={selectedRun.status}
                    trigger={selectedRun.trigger}
                    filtered={selectedRun.filtered}
                    runs={MOCK_RECENT_RUNS}
                    currentRunIndex={currentRunIndex}
                    onNavigate={handleNavigateToRun}
                />
            )}
        </div>
    )
}

type RunListItemProps = {
    run: RunHistoryRecord
    onClick: () => void
}

function RunListItem({ run, onClick }: RunListItemProps) {
    const title = run.trigger.title || run.trigger.source
    const formattedTime = formatRelativeTime(run.timestamp)

    return (
        <button
            onClick={onClick}
            className="w-full text-left bg-card border border-border rounded-lg px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer group"
        >
            <div className="flex items-center gap-3">
                {/* Integration Icon */}
                <div className="text-muted-foreground size-5 flex-shrink-0">
                    <IconForIntegration integration={run.trigger.integration} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-foreground truncate font-medium" title={title}>
                            {title}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {run.trigger.subheader && (
                            <>
                                <span className="truncate" title={run.trigger.subheader}>
                                    {run.trigger.subheader}
                                </span>
                                <span>·</span>
                            </>
                        )}
                        <span className="flex-shrink-0">{formattedTime}</span>
                    </div>
                </div>

                {/* Status and Action */}
                <div className="flex items-center gap-3">
                    <RunHistoryStatusBadge status={run.status} filtered={run.filtered} />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="View details"
                    >
                        <MessageSquare className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </button>
    )
}
