import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { AnimatePresence, Easing, motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { FileText, Loader2, MessageCircle, Rocket, Users } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

import { TemplateCard } from "@/components/Agents/TemplateCard"
import { Chat, ChatHandle } from "@/components/chat/Chat"
import { ChatEventPayload } from "@/components/chat/hooks/useCompletionSocket"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTemplates } from "@/hooks/api/useTemplates"
import { ModelRequest, SendModelRequest } from "@/shared/ModelEvents"
import { AgentTemplate, TemplateCategory } from "@/shared/types"
import { sendBuilderMessage, subscribeToBuilderChat } from "@/socket"

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
    const { templates, isLoading } = useTemplates()
    const [hasStartedChat, setHasStartedChat] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("users")
    const chatRef = useRef<ChatHandle>(null)
    const appliedDeepLinkKey = useRef<string | null>(null)
    const [searchParams] = useSearchParams()

    // Generate a session ID for this setup flow
    const sessionId = useMemo(() => uuidv4(), [])

    const handleTemplateSelect = useCallback((template: AgentTemplate) => {
        chatRef.current?.setInput(template.chatPrompt)
        chatRef.current?.focus()
    }, [])

    // Apply deep link params: templateId (pre-populate from template + set category) and/or prompt (arbitrary user input)
    useEffect(() => {
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
    }, [searchParams, templates])

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

    const chatSectionVariants = {
        initial: {},
        expanded: {
            flexGrow: 1,
            minHeight: 0
        }
    }

    const templatesVariants = {
        visible: {
            opacity: 1,
            filter: "blur(0px)",
            y: 0
        },
        hidden: {
            opacity: 0,
            filter: "blur(8px)",
            y: 300
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
                variants={chatSectionVariants}
                initial="initial"
                animate={hasStartedChat ? "expanded" : "initial"}
                transition={{
                    duration: ANIMATION_DURATION,
                    ease: ANIMATION_EASE
                }}
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

            {/* Templates Section - wrapper collapses immediately, content fades out */}
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
                            variants={templatesVariants}
                            initial="visible"
                            animate="visible"
                            exit="hidden"
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
                                                    {isLoading ? (
                                                        <div className="col-span-full flex items-center justify-center py-8">
                                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                                        </div>
                                                    ) : (
                                                        (() => {
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
                                                        })()
                                                    )}
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
