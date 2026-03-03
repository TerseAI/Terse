import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"

import { Tab, TabGroup, TabList } from "@headlessui/react"
import { Clock, MessageSquare, Settings, X } from "lucide-react"

import BreadCrumb from "../../components/BreadCrumb"
import { BuilderChat, BuilderChatHandle } from "../../components/chat/BuilderChat"
import { Button } from "../../components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../components/ui/sheet"
import { SidebarTrigger } from "../../components/ui/sidebar"
import { useAgent } from "../../hooks/api/useAgents"
import { useTemplates } from "../../hooks/api/useTemplates"
import { useIsMobile } from "../../hooks/use-mobile"
import { useTemplateHydration } from "../../hooks/useTemplateHydration"
import { safeStorageGet, safeStorageSet } from "../../lib/storage"
import { cn } from "../../lib/utils"
import { useModelContext } from "../../services/ModelContextProvider"
import { AgentNotificationSettings, AgentPrompt, TransientAgentOutput, TransientAgentTrigger } from "../../shared/types"
import { AgentInputsDonatedState, AgentNameDonatedState, AgentOutputsDonatedState, AgentPromptDonatedState } from "../../utility/AgentModelDonation"
import { toTransientAgentOutput, toTransientAgentTrigger } from "../../utility/AgentUtils"

import SdkJobDetail from "./SdkJobDetail"
import AgentRunHistoryTab from "./tabs/AgentRunHistoryTab"
import AgentSetupTab, { AgentSetupTabProps } from "./tabs/AgentSetupTab"

const CHAT_PANEL_WIDTH_MIN = 0.2
const CHAT_PANEL_WIDTH_MAX = 0.6
const CHAT_PANEL_WIDTH_DEFAULT = 0.3
const CHAT_PANE_TRANSITION_MS = 200
const CHAT_CONTENT_FADE_MS = 150
const AGENT_DETAIL_TABS = ["setup", "history"] as const

function ChatSidebarTrigger({ className, onClick, isOpen, ...props }: React.ComponentProps<typeof Button> & { isOpen: boolean }) {
    return (
        <Button
            variant="outline"
            size="icon"
            className={cn("h-7 w-7 shrink-0 border-border shadow-sm", className)}
            onClick={event => {
                onClick?.(event)
                event.currentTarget.blur()
            }}
            {...props}
        >
            <span className="relative inline-flex h-4 w-4 items-center justify-center align-middle">
                <MessageSquare className={cn("absolute inset-0 h-3 w-3 transition-all duration-200 ease-out", isOpen ? "opacity-0 scale-75 -rotate-90" : "opacity-100 scale-100 rotate-0")} />
                <X className={cn("absolute inset-0 h-3 w-3 transition-all duration-200 ease-out", isOpen ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-75 rotate-90")} />
            </span>
            <span className="sr-only">Toggle Sidebar</span>
        </Button>
    )
}

function ResizeHandle({
    currentFraction,
    containerRef,
    onResize,
    controlsId,
    disabled = false,
    onResizeStart,
    onResizeEnd
}: {
    currentFraction: number
    containerRef: React.RefObject<HTMLDivElement | null>
    onResize: (fraction: number) => void
    controlsId: string
    disabled?: boolean
    onResizeStart?: () => void
    onResizeEnd?: () => void
}) {
    const pointerStateRef = useRef<{
        pointerId: number | null
        startX: number
        startFraction: number
        latestX: number
        frameId: number | null
    }>({
        pointerId: null,
        startX: 0,
        startFraction: 0,
        latestX: 0,
        frameId: null
    })
    const onResizeStartRef = useRef(onResizeStart)
    const onResizeEndRef = useRef(onResizeEnd)

    useEffect(() => {
        onResizeStartRef.current = onResizeStart
    }, [onResizeStart])

    useEffect(() => {
        onResizeEndRef.current = onResizeEnd
    }, [onResizeEnd])

    const clampFraction = useCallback((fraction: number) => {
        return Math.max(CHAT_PANEL_WIDTH_MIN, Math.min(CHAT_PANEL_WIDTH_MAX, fraction))
    }, [])

    const stopDragging = useCallback(() => {
        const state = pointerStateRef.current
        const wasDragging = state.pointerId !== null
        if (state.frameId !== null) {
            window.cancelAnimationFrame(state.frameId)
        }
        pointerStateRef.current = {
            pointerId: null,
            startX: 0,
            startFraction: 0,
            latestX: 0,
            frameId: null
        }
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        if (wasDragging) {
            onResizeEndRef.current?.()
        }
    }, [])

    useEffect(() => {
        return () => stopDragging()
    }, [stopDragging])

    useEffect(() => {
        if (disabled) {
            stopDragging()
        }
    }, [disabled, stopDragging])

    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize builder chat"
            aria-controls={controlsId}
            aria-valuemin={CHAT_PANEL_WIDTH_MIN * 100}
            aria-valuemax={CHAT_PANEL_WIDTH_MAX * 100}
            aria-valuenow={Math.round(currentFraction * 100)}
            aria-valuetext={`${Math.round(currentFraction * 100)}% chat panel width`}
            tabIndex={disabled ? -1 : 0}
            onPointerDown={e => {
                if (disabled) return
                if (e.button !== 0) return
                if (pointerStateRef.current.pointerId !== null) return
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                pointerStateRef.current = {
                    pointerId: e.pointerId,
                    startX: e.clientX,
                    startFraction: currentFraction,
                    latestX: e.clientX,
                    frameId: null
                }
                onResizeStartRef.current?.()
                document.body.style.cursor = "col-resize"
                document.body.style.userSelect = "none"
            }}
            onPointerMove={e => {
                const state = pointerStateRef.current
                if (state.pointerId !== e.pointerId) return
                state.latestX = e.clientX
                if (state.frameId !== null) return
                state.frameId = window.requestAnimationFrame(() => {
                    const nextState = pointerStateRef.current
                    nextState.frameId = null
                    const container = containerRef.current
                    if (!container) return
                    const containerWidth = container.getBoundingClientRect().width
                    if (containerWidth <= 0) return
                    const deltaX = nextState.latestX - nextState.startX
                    const deltaFraction = -deltaX / containerWidth
                    onResize(clampFraction(nextState.startFraction + deltaFraction))
                })
            }}
            onPointerUp={e => {
                if (pointerStateRef.current.pointerId !== e.pointerId) return
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId)
                }
                stopDragging()
            }}
            onPointerCancel={e => {
                if (pointerStateRef.current.pointerId !== e.pointerId) return
                stopDragging()
            }}
            onLostPointerCapture={() => stopDragging()}
            onKeyDown={e => {
                if (disabled) return
                const step = e.shiftKey ? 0.05 : 0.02
                if (e.key === "ArrowLeft") {
                    e.preventDefault()
                    onResize(clampFraction(currentFraction + step))
                } else if (e.key === "ArrowRight") {
                    e.preventDefault()
                    onResize(clampFraction(currentFraction - step))
                } else if (e.key === "Home") {
                    e.preventDefault()
                    onResize(CHAT_PANEL_WIDTH_MIN)
                } else if (e.key === "End") {
                    e.preventDefault()
                    onResize(CHAT_PANEL_WIDTH_MAX)
                }
            }}
            className="h-full w-full cursor-col-resize border-r border-border bg-border/50 hover:bg-border transition-colors"
        />
    )
}

const CHAT_PANEL_WIDTH_FRACTION_KEY = "chatPanelWidthFraction"

function getChatPanelWidthFraction() {
    const storedWidth = safeStorageGet(CHAT_PANEL_WIDTH_FRACTION_KEY, localStorage)
    if (storedWidth) {
        const parsedWidth = parseFloat(storedWidth)
        if (isFinite(parsedWidth) && parsedWidth >= CHAT_PANEL_WIDTH_MIN && parsedWidth <= CHAT_PANEL_WIDTH_MAX) {
            return parsedWidth
        }
    }
    return CHAT_PANEL_WIDTH_DEFAULT
}

function AgentDetail() {
    const { id, templateId } = useParams<{ id: string; templateId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const { getStateJSON, donate } = useModelContext()
    const [builderChatOpen, setBuilderChatOpen] = useState(true)
    const [desktopChatPaneOpen, setDesktopChatPaneOpen] = useState(true)
    const [chatPanelWidthFraction, setChatPanelWidthFraction] = useState(getChatPanelWidthFraction)
    const [isChatPaneResizing, setIsChatPaneResizing] = useState(false)
    const [renderBuilderChatContent, setRenderBuilderChatContent] = useState(false)
    const [showBuilderChatContent, setShowBuilderChatContent] = useState(false)
    const layoutContainerRef = useRef<HTMLDivElement>(null)
    const builderChatRef = useRef<BuilderChatHandle>(null)
    const chatPaneId = useId()
    const isMobile = useIsMobile()

    function setChatPanelWidthFractionStorage(fraction: number) {
        setChatPanelWidthFraction(fraction)
        safeStorageSet(CHAT_PANEL_WIDTH_FRACTION_KEY, fraction.toString(), localStorage)
    }

    // Cmd+I (Ctrl+I on Windows) toggles the builder chat panel
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "i" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                setBuilderChatOpen(prev => !prev)
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])

    useEffect(() => {
        if (!desktopChatPaneOpen) {
            setIsChatPaneResizing(false)
        }
    }, [desktopChatPaneOpen])

    useEffect(() => {
        let openTimeoutId: number | null = null
        let closeTimeoutId: number | null = null
        let frameId: number | null = null

        if (isMobile) {
            setDesktopChatPaneOpen(false)
            setRenderBuilderChatContent(builderChatOpen)
            setShowBuilderChatContent(builderChatOpen)
            return () => {
                if (openTimeoutId !== null) window.clearTimeout(openTimeoutId)
                if (closeTimeoutId !== null) window.clearTimeout(closeTimeoutId)
                if (frameId !== null) window.cancelAnimationFrame(frameId)
            }
        }

        if (builderChatOpen) {
            setDesktopChatPaneOpen(true)
            // Keep content hidden during panel width transition to avoid text reflow jitter.
            setRenderBuilderChatContent(false)
            setShowBuilderChatContent(false)
            openTimeoutId = window.setTimeout(() => {
                setRenderBuilderChatContent(true)
                frameId = window.requestAnimationFrame(() => {
                    setShowBuilderChatContent(true)
                })
            }, CHAT_PANE_TRANSITION_MS)
        } else {
            // Fade content out before unmounting for symmetric in/out motion.
            setShowBuilderChatContent(false)
            closeTimeoutId = window.setTimeout(() => {
                setRenderBuilderChatContent(false)
                setDesktopChatPaneOpen(false)
            }, CHAT_CONTENT_FADE_MS)
        }

        return () => {
            if (openTimeoutId !== null) window.clearTimeout(openTimeoutId)
            if (closeTimeoutId !== null) window.clearTimeout(closeTimeoutId)
            if (frameId !== null) window.cancelAnimationFrame(frameId)
        }
    }, [builderChatOpen, isMobile])

    useEffect(() => {
        if (isMobile) {
            setIsChatPaneResizing(false)
            setBuilderChatOpen(false)
        }
    }, [isMobile])

    // Only pass agentId if it's not "new"
    const agentId: string | null = id && id !== "new" ? id : null

    // Fetch agent data using useSWR
    const { agent, isLoading: isFetching, mutate } = useAgent(agentId)

    // Fetch templates for template hydration
    const { templates, isLoading: isLoadingTemplates } = useTemplates()

    // Hydrate from template if templateId is provided
    const { hydratedState: templateHydratedState, templateFound } = useTemplateHydration(templateId, templates)

    // Track if we've already hydrated from a template to avoid re-hydration
    const [templateHydrated, setTemplateHydrated] = useState<string | null>(null)

    // Local state for editing - use transient types for the editing interface
    const [name, setName] = useState<string | null>(null)
    const [inputs, setInputs] = useState<TransientAgentTrigger[]>([])
    const [outputs, setOutputs] = useState<TransientAgentOutput[]>([])
    const [prompt, setPrompt] = useState<AgentPrompt | undefined>(undefined)
    const [isActive, setIsActive] = useState<boolean>(true)
    const [requireApproval, setRequireApproval] = useState<boolean>(false)
    const [toolApprovals, setToolApprovals] = useState<string[]>([])
    const [notificationSettings, setNotificationSettings] = useState<AgentNotificationSettings>({
        enabled: false,
        actionTypes: [],
        notifyOnRunFailure: false
    })

    // Sync local state with fetched data - convert from AgentTrigger/Output to Transient types
    useEffect(() => {
        if (!agentId) {
            // Check if we need to hydrate from a template
            if (templateId && templateFound && templateHydratedState && templateHydrated !== templateId) {
                // Hydrate from template
                setName(templateHydratedState.name)
                setPrompt(templateHydratedState.prompt)
                setIsActive(templateHydratedState.isActive)
                setRequireApproval(templateHydratedState.requireApproval)
                setToolApprovals(templateHydratedState.toolApprovals || [])
                setInputs(templateHydratedState.inputs)
                setOutputs(templateHydratedState.outputs)
                setNotificationSettings(templateHydratedState.notificationSettings)
                setTemplateHydrated(templateId)
                return
            }

            // Reset to blank state for new agent (no template)
            if (!templateId || templateHydrated === templateId) {
                // Only reset if there's no template or we've already handled it
                if (!templateId) {
                    setName(null)
                    setInputs([])
                    setOutputs([])
                    setPrompt(undefined)
                    setIsActive(true)
                    setRequireApproval(false)
                    setToolApprovals([])
                    setNotificationSettings({ enabled: false, actionTypes: [], notifyOnRunFailure: false })
                }
            }
        } else if (agent) {
            setName(agent.name)
            setInputs(agent.triggers.map(toTransientAgentTrigger))
            setOutputs(agent.outputs ? agent.outputs.map(toTransientAgentOutput) : [])
            setPrompt(agent.prompt)
            setIsActive(agent.isActive)
            setRequireApproval(agent.requireApproval ?? false)
            setToolApprovals(agent.toolApprovals || [])
            setNotificationSettings(agent.notificationSettings ?? { enabled: false, actionTypes: [], notifyOnRunFailure: false })
        }
    }, [agent, agentId, templateId, templateFound, templateHydratedState, templateHydrated])

    const tabFromQuery = searchParams.get("tab")
    const [selectedIndex, setSelectedIndex] = useState(() => {
        return Math.max(0, AGENT_DETAIL_TABS.indexOf((tabFromQuery as (typeof AGENT_DETAIL_TABS)[number]) || "setup"))
    })

    // Update selected index when URL changes
    useEffect(() => {
        const tabFromQuery = searchParams.get("tab")
        const newIndex = Math.max(0, AGENT_DETAIL_TABS.indexOf((tabFromQuery as (typeof AGENT_DETAIL_TABS)[number]) || "setup"))
        setSelectedIndex(newIndex)
    }, [searchParams])

    // Determine if we're still loading
    // - For existing agents: wait for agent data
    // - For template-based agents: wait for templates to load and hydrate
    const isLoading = isFetching || (!!templateId && (isLoadingTemplates || !templateFound || templateHydrated !== templateId))

    // Prepare props for child components
    // Note: inputs and outputs are already in TransientAgentTrigger/Output format
    const agentProps: AgentSetupTabProps = {
        agentId,
        name,
        setName,
        inputs,
        setInputs,
        outputs,
        setOutputs,
        prompt,
        setPrompt,
        isActive,
        setIsActive,
        requireApproval,
        setRequireApproval,
        toolApprovals,
        setToolApprovals,
        notificationSettings,
        setNotificationSettings,
        isLoading,
        mutate,
        updatedAt: agent?.updatedAt
    }

    const handleTriggerNow = () => {
        // Open builder chat if not already open
        if (!builderChatOpen) {
            setBuilderChatOpen(true)
        }
        // Pre-fill the chat input so the user can just hit Enter
        setTimeout(
            () => {
                builderChatRef.current?.setInput("I'd like to test this out right away")
                builderChatRef.current?.focus()
            },
            builderChatOpen ? 0 : CHAT_PANE_TRANSITION_MS + 100
        )
    }

    // Let the chat know about what's on the screen
    donate("Agent Name", new AgentNameDonatedState(name ?? ""))
    donate("Agent Inputs", new AgentInputsDonatedState(inputs))
    donate("Agent Skills", new AgentOutputsDonatedState(outputs))
    donate("Agent Prompt", new AgentPromptDonatedState(prompt ?? { text: "" }))

    // SDK-sourced agents get a simplified detail view
    if (agentId && agent?.source === "SDK") {
        return <SdkJobDetail agentId={agentId} />
    }

    // Show loading state while determining agent source for existing agents
    if (agentId && isFetching && !agent) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground text-sm">Loading...</div>
            </div>
        )
    }

    return (
        <div ref={layoutContainerRef} className="flex h-full min-w-0">
            <div
                className={cn("h-full min-h-0 min-w-0 overflow-y-auto @container/agent-detail-pane", !isChatPaneResizing && "transition-all duration-200 ease-in-out")}
                style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: `${desktopChatPaneOpen && !isMobile ? (1 - chatPanelWidthFraction) * 100 : 100}%`,
                    minWidth: desktopChatPaneOpen && !isMobile ? 320 : undefined
                }}
            >
                <div className="flex items-center gap-4 px-2 py-2.5">
                    <SidebarTrigger />
                    <div className="hidden @2xl/agent-detail-pane:block">
                        <BreadCrumb inline />
                    </div>
                    <div className="ml-auto">
                        <ChatSidebarTrigger
                            isOpen={builderChatOpen}
                            onClick={() => setBuilderChatOpen(prev => !prev)}
                            title={builderChatOpen ? "Close builder chat (⌘I / Ctrl+I)" : "Open builder chat (⌘I / Ctrl+I)"}
                        />
                    </div>
                </div>
                <TabGroup
                    selectedIndex={selectedIndex}
                    onChange={index => {
                        setSelectedIndex(index)
                        const next = AGENT_DETAIL_TABS[index]
                        const nextParams = new URLSearchParams(searchParams)
                        nextParams.set("tab", next)
                        setSearchParams(nextParams, { replace: true })
                    }}
                    className="pl-2"
                >
                    <TabList className="flex gap-2 border-b border-input items-center pt-2">
                        <Tab
                            className={({ selected }) =>
                                `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`
                            }
                        >
                            <Settings className="h-4 w-4" />
                            <span>Setup</span>
                        </Tab>
                        <Tab
                            className={({ selected }) =>
                                `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`
                            }
                        >
                            <Clock className="h-4 w-4" />
                            <span>Activity</span>
                        </Tab>
                    </TabList>
                </TabGroup>
                <div className="min-w-0">{selectedIndex === 0 ? <AgentSetupTab {...agentProps} /> : <AgentRunHistoryTab agentId={agentId} onTriggerNow={handleTriggerNow} />}</div>
            </div>
            {isMobile ? (
                <Sheet open={builderChatOpen} onOpenChange={setBuilderChatOpen}>
                    <SheetContent side="right" className="w-[90vw] max-w-md p-0">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Builder Chat</SheetTitle>
                            <SheetDescription>Build and edit this agent with chat.</SheetDescription>
                        </SheetHeader>
                        <div className="h-full min-h-0 w-full">
                            <BuilderChat ref={builderChatRef} getStateJSON={() => getStateJSON()} agentId={agentId} />
                        </div>
                    </SheetContent>
                </Sheet>
            ) : (
                <>
                    <div
                        className={cn("shrink-0 overflow-hidden", !isChatPaneResizing && "transition-all duration-200 ease-in-out")}
                        style={{
                            width: desktopChatPaneOpen ? 4 : 0,
                            opacity: desktopChatPaneOpen ? 1 : 0,
                            pointerEvents: desktopChatPaneOpen ? "auto" : "none"
                        }}
                    >
                        <ResizeHandle
                            currentFraction={chatPanelWidthFraction}
                            containerRef={layoutContainerRef}
                            onResize={setChatPanelWidthFractionStorage}
                            controlsId={chatPaneId}
                            disabled={!desktopChatPaneOpen}
                            onResizeStart={() => setIsChatPaneResizing(true)}
                            onResizeEnd={() => setIsChatPaneResizing(false)}
                        />
                    </div>
                    <div
                        id={chatPaneId}
                        data-chat-pane
                        className={cn("h-full min-h-0 flex flex-col overflow-hidden min-w-0", desktopChatPaneOpen ? "pl-2" : "pl-0", !isChatPaneResizing && "transition-all duration-200 ease-in-out")}
                        style={{
                            flexGrow: 0,
                            flexShrink: 0,
                            flexBasis: `${desktopChatPaneOpen ? chatPanelWidthFraction * 100 : 0}%`,
                            minWidth: desktopChatPaneOpen ? 280 : 0,
                            opacity: desktopChatPaneOpen ? 1 : 0,
                            pointerEvents: showBuilderChatContent ? "auto" : "none"
                        }}
                    >
                        {(desktopChatPaneOpen || renderBuilderChatContent) && (
                            <div className={cn("flex-1 min-w-0 min-h-0 w-full transition-opacity duration-150", showBuilderChatContent ? "opacity-100" : "opacity-0")}>
                                {renderBuilderChatContent && <BuilderChat ref={builderChatRef} getStateJSON={() => getStateJSON()} agentId={agentId} />}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

export default AgentDetail
