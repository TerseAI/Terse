import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"

import { Tab, TabGroup, TabList } from "@headlessui/react"
import { Clock, MessageSquare, PanelRightIcon, Settings, X } from "lucide-react"

import BreadCrumb from "../../components/BreadCrumb"
import { BuilderChat } from "../../components/chat/BuilderChat"
import { Button } from "../../components/ui/button"
import { SidebarTrigger } from "../../components/ui/sidebar"
import { useAgent } from "../../hooks/api/useAgents"
import { useTemplates } from "../../hooks/api/useTemplates"
import { useTemplateHydration } from "../../hooks/useTemplateHydration"
import { cn } from "../../lib/utils"
import { useModelContext } from "../../services/ModelContextProvider"
import { AgentNotificationSettings, AgentPrompt, TransientAgentOutput, TransientAgentTrigger, TransientKnowledgeBase } from "../../shared/types"
import { AgentInputsDonatedState, AgentKnowledgeBasesDonatedState, AgentNameDonatedState, AgentOutputsDonatedState, AgentPromptDonatedState } from "../../utility/AgentModelDonation"
import { toTransientAgentOutput, toTransientAgentTrigger, toTransientKnowledgeBase } from "../../utility/AgentUtils"

import AgentRunHistoryTab from "./tabs/AgentRunHistoryTab"
import AgentSetupTab, { AgentSetupTabProps } from "./tabs/AgentSetupTab"

const CHAT_PANEL_WIDTH_MIN = 0.2
const CHAT_PANEL_WIDTH_MAX = 0.6
const CHAT_PANEL_WIDTH_DEFAULT = 0.3

function ChatSidebarTrigger({ className, onClick, icon: Icon = PanelRightIcon, ...props }: React.ComponentProps<typeof Button> & { icon?: React.ComponentType<{ className?: string }> }) {
    return (
        <Button
            variant="outline"
            size="icon"
            className={cn("h-7 w-7 shrink-0 border-border shadow-sm", className)}
            onClick={event => {
                onClick?.(event)
            }}
            {...props}
        >
            <Icon className="h-3 w-3" />
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

function AgentDetail() {
    const { id, templateId } = useParams<{ id: string; templateId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const { getStateJSON, donate } = useModelContext()
    const [builderChatOpen, setBuilderChatOpen] = useState(true)
    const [chatPanelWidthFraction, setChatPanelWidthFraction] = useState(CHAT_PANEL_WIDTH_DEFAULT)
    const [isChatPaneResizing, setIsChatPaneResizing] = useState(false)
    const layoutContainerRef = useRef<HTMLDivElement>(null)
    const chatPaneId = useId()

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
        if (!builderChatOpen) {
            setIsChatPaneResizing(false)
        }
    }, [builderChatOpen])

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
    const [knowledgeBases, setKnowledgeBases] = useState<TransientKnowledgeBase[]>([])
    const [prompt, setPrompt] = useState<AgentPrompt | undefined>(undefined)
    const [isActive, setIsActive] = useState<boolean>(true)
    const [requireApproval, setRequireApproval] = useState<boolean>(false)
    const [toolApprovals, setToolApprovals] = useState<string[]>([])
    const [notificationSettings, setNotificationSettings] = useState<AgentNotificationSettings>({
        enabled: false,
        actionTypes: []
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
                setKnowledgeBases(templateHydratedState.knowledgeBases)
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
                    setKnowledgeBases([])
                    setPrompt(undefined)
                    setIsActive(true)
                    setRequireApproval(false)
                    setToolApprovals([])
                    setNotificationSettings({ enabled: false, actionTypes: [] })
                }
            }
        } else if (agent) {
            setName(agent.name)
            setInputs(agent.triggers.map(toTransientAgentTrigger))
            setOutputs(agent.outputs ? agent.outputs.map(toTransientAgentOutput) : [])
            setKnowledgeBases(agent.knowledgeBases?.map(toTransientKnowledgeBase) || [])
            setPrompt(agent.prompt)
            setIsActive(agent.isActive)
            setRequireApproval(agent.requireApproval ?? false)
            setToolApprovals(agent.toolApprovals || [])
            setNotificationSettings(agent.notificationSettings ?? { enabled: false, actionTypes: [] })
        }
    }, [agent, agentId, templateId, templateFound, templateHydratedState, templateHydrated])

    const tabs = ["setup", "history"] as const
    const tabFromQuery = searchParams.get("tab")
    const [selectedIndex, setSelectedIndex] = useState(() => {
        return Math.max(0, tabs.indexOf((tabFromQuery as (typeof tabs)[number]) || "setup"))
    })

    // Update selected index when URL changes
    useEffect(() => {
        const tabFromQuery = searchParams.get("tab")
        const newIndex = Math.max(0, tabs.indexOf((tabFromQuery as (typeof tabs)[number]) || "setup"))
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
        knowledgeBases,
        setKnowledgeBases,
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

    // Let the chat know about what's on the screen
    donate("Agent Name", new AgentNameDonatedState(name ?? ""))
    donate("Agent Inputs", new AgentInputsDonatedState(inputs))
    donate("Agent Skills", new AgentOutputsDonatedState(outputs))
    donate("Agent Knowledge Bases", new AgentKnowledgeBasesDonatedState(knowledgeBases))
    donate("Agent Prompt", new AgentPromptDonatedState(prompt ?? { text: "" }))

    return (
        <div ref={layoutContainerRef} className="flex h-full min-w-0">
            <div
                className={cn("h-full min-h-0 min-w-0 overflow-y-auto", !isChatPaneResizing && "transition-all duration-200 ease-in-out")}
                style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: `${builderChatOpen ? (1 - chatPanelWidthFraction) * 100 : 100}%`,
                    minWidth: builderChatOpen ? 320 : undefined
                }}
            >
                <div className="flex items-center gap-4 px-2 py-2.5">
                    <SidebarTrigger />
                    <BreadCrumb inline />
                    <div className="ml-auto">
                        <ChatSidebarTrigger
                            icon={builderChatOpen ? X : MessageSquare}
                            onClick={() => setBuilderChatOpen(prev => !prev)}
                            title={builderChatOpen ? "Close builder chat (⌘I / Ctrl+I)" : "Open builder chat (⌘I / Ctrl+I)"}
                        />
                    </div>
                </div>
                <TabGroup
                    selectedIndex={selectedIndex}
                    onChange={index => {
                        setSelectedIndex(index)
                        const next = tabs[index]
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
                <div className="min-w-0">{selectedIndex === 0 ? <AgentSetupTab {...agentProps} /> : <AgentRunHistoryTab agentId={agentId} />}</div>
            </div>
            <>
                <div
                    className={cn("shrink-0 overflow-hidden", !isChatPaneResizing && "transition-all duration-200 ease-in-out")}
                    style={{
                        width: builderChatOpen ? 4 : 0,
                        opacity: builderChatOpen ? 1 : 0,
                        pointerEvents: builderChatOpen ? "auto" : "none"
                    }}
                >
                    <ResizeHandle
                        currentFraction={chatPanelWidthFraction}
                        containerRef={layoutContainerRef}
                        onResize={setChatPanelWidthFraction}
                        controlsId={chatPaneId}
                        disabled={!builderChatOpen}
                        onResizeStart={() => setIsChatPaneResizing(true)}
                        onResizeEnd={() => setIsChatPaneResizing(false)}
                    />
                </div>
                <div
                    id={chatPaneId}
                    data-chat-pane
                    className={cn("h-full min-h-0 flex flex-col overflow-hidden min-w-0", builderChatOpen ? "pl-2" : "pl-0", !isChatPaneResizing && "transition-all duration-200 ease-in-out")}
                    style={{
                        flexGrow: 0,
                        flexShrink: 0,
                        flexBasis: `${builderChatOpen ? chatPanelWidthFraction * 100 : 0}%`,
                        minWidth: builderChatOpen ? 280 : 0,
                        opacity: builderChatOpen ? 1 : 0,
                        transform: builderChatOpen ? "translateX(0)" : "translateX(8px)",
                        pointerEvents: builderChatOpen ? "auto" : "none"
                    }}
                >
                    {builderChatOpen && (
                        <div className="flex-1 min-w-0 min-h-0 w-full">
                            <BuilderChat getStateJSON={() => getStateJSON()} agentId={agentId} />
                        </div>
                    )}
                </div>
            </>
        </div>
    )
}

export default AgentDetail
