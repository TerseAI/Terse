import { useCallback, useMemo, useRef, useState } from "react"

import { AnimatePresence, Easing, motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { FileText, Loader2, MessageCircle, Rocket, Users } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

import { TemplateCard } from "@/components/Agents/TemplateCard"
import { Chat, ChatHandle } from "@/components/chat/Chat"
import { ChatEventPayload } from "@/components/chat/hooks/useCompletionSocket"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useTemplates } from "@/hooks/api/useTemplates"
import { ModelRequest, SendModelRequest } from "@/shared/ModelEvents"
import { AgentTemplate, TemplateCategory } from "@/shared/types"
import { sendBuilderMessage, subscribeToBuilderChat } from "@/socket"

const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; icon: LucideIcon }[] = [
    { id: "ship", label: "Ship Faster", icon: Rocket },
    { id: "users", label: "Understand Users", icon: Users },
    { id: "align", label: "Stay Aligned", icon: MessageCircle },
    { id: "track", label: "Track Everything", icon: FileText }
]

const AGENT_SETUP_PLACEHOLDERS = [
    "An agent that reads my Slack every day and tells me only what actually matters",
    "Something that tracks GitHub PRs across all my repos and nudges me when I need to act",
    "Automatically update Linear and post in Slack when my PRs get merged",
    "Generate my standup update from GitHub, Slack, and calendar activity",
    "Notify me when a PR is blocked or waiting on review too long",
    "Watch CI failures and alert the right people before things pile up",
    "Tell me if we’re actually ready to ship without checking five different tools",
    "Draft weekly release notes from merged PRs and commits"
]

const ANIMATION_DURATION = 0.8
const ANIMATION_EASE: Easing = [0.4, 0, 0.2, 1]

export default function AgentSetup() {
    const { templates, isLoading } = useTemplates()
    const [hasStartedChat, setHasStartedChat] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("ship")
    const chatRef = useRef<ChatHandle>(null)

    const filteredTemplates = useMemo(() => templates.filter(t => t.category === selectedCategory), [templates, selectedCategory])

    // Generate a session ID for this setup flow
    const sessionId = useMemo(() => uuidv4(), [])

    const handleTemplateSelect = (template: AgentTemplate) => {
        chatRef.current?.setInput(template.chatPrompt)
        chatRef.current?.focus()
    }

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
        initial: {
            minHeight: 200
        },
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
                            <h1 className="text-2xl font-semibold text-foreground">Create a new agent</h1>
                            <p className="text-muted-foreground mt-1">Describe what you want your agent to do, and we'll help you build it.</p>
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

                                    {/* Category chips */}
                                    <div className="flex flex-wrap justify-between items-center gap-2 py-1">
                                        {TEMPLATE_CATEGORIES.map(({ id, label, icon: Icon }) => (
                                            <motion.div
                                                key={id}
                                                initial={false}
                                                animate={{
                                                    scale: selectedCategory === id ? 1.02 : 1
                                                }}
                                                transition={{ duration: 0.2, ease: "easeOut" }}
                                            >
                                                <Button
                                                    variant={selectedCategory === id ? "secondary" : "outline"}
                                                    size="lg"
                                                    className="h-11 px-5 gap-2 text-base font-medium"
                                                    onClick={() => setSelectedCategory(id)}
                                                >
                                                    <Icon className="size-5 shrink-0" />
                                                    {label}
                                                </Button>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Templates Grid */}
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <AnimatePresence mode="wait">
                                            {filteredTemplates.length > 0 ? (
                                                <motion.div
                                                    key={selectedCategory}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -8 }}
                                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                                                >
                                                    {filteredTemplates.map((template, index) => (
                                                        <TemplateCard key={index} template={template} onSelect={handleTemplateSelect} />
                                                    ))}
                                                </motion.div>
                                            ) : (
                                                <motion.div key={`empty-${selectedCategory}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                                                    <Card className="border-dashed">
                                                        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                                                            <p className="text-muted-foreground text-sm">No templates in this category yet</p>
                                                        </CardContent>
                                                    </Card>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
