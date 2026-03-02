import { ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { AnimatePresence, Easing, motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { FileText, MessageCircle, Rocket, RotateCcw, Users } from "lucide-react"

import { TemplateCard } from "@/components/Agents/TemplateCard"
import { convertRunHistoryEventsToTurns } from "@/components/RunHistory/RunHistoryChatDrawer/runHistoryEventsToTurns"
import { Chat, ChatHandle } from "@/components/chat/Chat"
import { ChatEventPayload } from "@/components/chat/hooks/useCompletionSocket"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBuilderChatHistory } from "@/hooks/api/useBuilderChatHistory"
import { useTemplates } from "@/hooks/api/useTemplates"
import { useBuilderSession } from "@/hooks/useBuilderSession"
import { ModelRequest, SendModelRequest } from "@/shared/ModelEvents"
import { AgentTemplate, TemplateCategory } from "@/shared/types"
import { cancelBuilderChatSession, sendBuilderMessage, sendBuilderMultipleChoiceAnswer, subscribeToBuilderChat } from "@/socket"

const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; icon: LucideIcon }[] = [
    { id: "users", label: "Understand Users", icon: Users },
    { id: "sync", label: "Stay in Sync", icon: MessageCircle },
    { id: "track", label: "Track Everything", icon: FileText },
    { id: "ship", label: "Ship Fast", icon: Rocket }
]

const AGENT_SETUP_PLACEHOLDERS = [
    "An agent that reads my Slack every day and tells me only what actually matters",
    "Something that tracks GitHub PRs across all my repos and nudges me when I need to act",
    "Automatically update Linear and post in Slack when my PRs get merged",
    "Generate my standup update from GitHub, Slack, and calendar activity",
    "Notify me when a PR is blocked or waiting on review too long",
    "Watch CI failures and alert the right people before things pile up",
    "Tell me if we're actually ready to ship without checking five different tools",
    "Draft weekly release notes from merged PRs and commits"
]

const ANIMATION_DURATION = 1.0
const ANIMATION_EASE: Easing = [0.4, 0, 0.2, 1]

const panelVariants = {
    enter: { opacity: 0, y: 8 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 }
}

type AgentBuilderLayoutProps = {
    header: ReactNode
}

export function AgentBuilderLayout({ header }: AgentBuilderLayoutProps) {
    const { templates, isLoading: isLoadingTemplates } = useTemplates()
    const { sessionId, resetSessionId } = useBuilderSession()
    const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("users")
    const chatRef = useRef<ChatHandle>(null)
    const appliedDeepLinkKey = useRef<string | null>(null)
    const [searchParams] = useSearchParams()

    // Load chat history for the persisted session
    const { events: historyEvents, isLoading: isHistoryLoading } = useBuilderChatHistory(sessionId)
    const [initialTurns, setInitialTurns] = useState<ReturnType<typeof convertRunHistoryEventsToTurns>>([])
    const [hasStartedChat, setHasStartedChat] = useState(false)

    // Unified loading: wait for both templates AND chat history before rendering.
    // This prevents the chatbox from appearing before templates, making a jumpy experience.
    const isInitialLoading = isHistoryLoading || isLoadingTemplates

    useEffect(() => {
        const turns = convertRunHistoryEventsToTurns(historyEvents)
        setInitialTurns(turns)
        if (turns.length > 0) {
            setHasStartedChat(true)
        }
    }, [historyEvents])

    const handleClearChat = () => {
        resetSessionId()
        setHasStartedChat(false)
    }

    const handleTemplateSelect = useCallback((template: AgentTemplate) => {
        chatRef.current?.setInput(template.chatPrompt)
        chatRef.current?.focus()
    }, [])

    // Apply deep link params: templateId (pre-populate from template + set category) and/or prompt (arbitrary user input)
    useEffect(() => {
        if (isInitialLoading) return
        const templateIdParam = searchParams.get("templateId")
        const promptParam = searchParams.get("prompt")

        if (!templateIdParam && !promptParam) return

        const key = `${templateIdParam ?? ""}|${promptParam ?? ""}`
        if (appliedDeepLinkKey.current === key) return

        // Chat content: custom prompt takes precedence over template's chatPrompt
        let chatContent: string | null = null
        if (promptParam) {
            chatContent = promptParam
        } else if (templateIdParam && templates.length > 0) {
            const matched = templates.find(t => t.id === templateIdParam)
            chatContent = matched?.chatPrompt ?? null
        }

        if (chatContent) {
            appliedDeepLinkKey.current = key
            chatRef.current?.setInput(chatContent)
            chatRef.current?.focus()
        }

        // Set category from template when templateId is present
        if (templateIdParam && templates.length > 0) {
            const matched = templates.find(t => t.id === templateIdParam)
            if (matched) {
                setSelectedCategory(matched.category)
            }
        }
    }, [searchParams, templates, isInitialLoading])

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
            // Mark that the user has started chatting
            if (!hasStartedChat) {
                setHasStartedChat(true)
            }

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
        if (!hasStartedChat) {
            setHasStartedChat(true)
        }
    }, [hasStartedChat])

    const handleMultipleChoiceAnswer = useCallback(
        (questionId: string, value: string) => {
            sendBuilderMultipleChoiceAnswer(sessionId, questionId, value)
        },
        [sessionId]
    )

    const handleCancel = useCallback(async () => {
        const response = await cancelBuilderChatSession(sessionId)
        return response.accepted
    }, [sessionId])

    // While data is loading, show an empty container to prevent layout shifts.
    if (isInitialLoading) {
        return <div className="flex flex-col h-full w-full" />
    }

    // Animation variants for synchronized transitions
    const headerVariants = {
        visible: {
            opacity: 1
        },
        hidden: {
            opacity: 0,
            filter: "blur(8px)"
        }
    }

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header - wrapper collapses immediately, content fades out */}
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
                            className="mx-auto max-w-5xl w-full"
                            variants={headerVariants}
                            initial="visible"
                            animate="visible"
                            exit="hidden"
                            transition={{
                                duration: ANIMATION_DURATION / 4,
                                ease: ANIMATION_EASE
                            }}
                        >
                            {header}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Chat Section - expands when chat starts */}
            <motion.div
                className="flex flex-col mx-auto max-w-5xl w-full pb-3"
                initial={{}}
                animate={hasStartedChat ? { flexGrow: 1, minHeight: 0 } : {}}
                transition={{
                    duration: ANIMATION_DURATION,
                    ease: ANIMATION_EASE
                }}
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
                        subscribeToEvents={subscribeToEvents}
                        sendMessage={sendMessage}
                        onHandleCancellation={handleCancel}
                        onUserMessage={handleUserMessage}
                        onMultipleChoiceAnswer={handleMultipleChoiceAnswer}
                        addUserTurnsLocally={true}
                        initialTurns={initialTurns}
                        inputSize={hasStartedChat ? "small" : "large"}
                        placeholders={hasStartedChat ? [] : AGENT_SETUP_PLACEHOLDERS}
                    />
                </div>
            </motion.div>

            {/* Templates Section - wrapper collapses immediately, content fades out */}
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
                        <motion.div
                            className="w-full"
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0, filter: "blur(8px)", y: 40 }}
                            transition={{
                                duration: ANIMATION_DURATION,
                                ease: ANIMATION_EASE
                            }}
                        >
                            <div className="p-6">
                                <div className="mx-auto max-w-5xl space-y-4">
                                    {/* Divider with "or" */}
                                    <div className="flex items-center gap-4">
                                        <div className="h-px flex-1 bg-border" />
                                        <span className="text-sm text-muted-foreground">or start with a template</span>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>

                                    {/* Category tabs */}
                                    <Tabs value={selectedCategory} onValueChange={v => setSelectedCategory(v as TemplateCategory)}>
                                        <TabsList variant="line" className="w-full">
                                            {TEMPLATE_CATEGORIES.map(({ id, label, icon: Icon }) => (
                                                <TabsTrigger key={id} value={id} variant="line" className="flex items-center gap-2">
                                                    <Icon className="h-4 w-4" />
                                                    <span>{label}</span>
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>
                                        <div className="pt-4 overflow-hidden">
                                            <AnimatePresence mode="wait" initial={false}>
                                                <motion.div
                                                    key={selectedCategory}
                                                    variants={panelVariants}
                                                    initial="enter"
                                                    animate="center"
                                                    exit="exit"
                                                    transition={{ duration: 0.2, ease: ANIMATION_EASE }}
                                                    className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                                                >
                                                    {(() => {
                                                        const categoryTemplates = templates.filter(t => t.category === selectedCategory)
                                                        return categoryTemplates.length > 0 ? (
                                                            categoryTemplates.map((template, index) => (
                                                                <motion.div
                                                                    key={template.id}
                                                                    initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                                                                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                                                    transition={{
                                                                        duration: 0.3,
                                                                        delay: index * 0.05,
                                                                        ease: ANIMATION_EASE
                                                                    }}
                                                                >
                                                                    <TemplateCard template={template} onSelect={handleTemplateSelect} />
                                                                </motion.div>
                                                            ))
                                                        ) : (
                                                            <Card className="col-span-full border-dashed">
                                                                <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                                                                    <p className="text-muted-foreground text-sm">No templates in this category yet</p>
                                                                </CardContent>
                                                            </Card>
                                                        )
                                                    })()}
                                                </motion.div>
                                            </AnimatePresence>
                                        </div>
                                    </Tabs>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
