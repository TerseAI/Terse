import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"

import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react"
import { Clock, MessageSquare, PanelRightIcon, Settings } from "lucide-react"

import { BuilderChat } from "../../components/chat/BuilderChat"
import { Button } from "../../components/ui/button"
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

function ChatSidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", className)}
            onClick={event => {
                onClick?.(event)
            }}
            {...props}
        >
            <PanelRightIcon className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
        </Button>
    )
}

function AgentDetail() {
    const { id, templateId } = useParams<{ id: string; templateId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const { getStateJSON, donate } = useModelContext()
    const [builderChatOpen, setBuilderChatOpen] = useState(true)

    // Cmd++i (Ctrl+i on Windows) toggles the builder chat panel
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
        <div
            className="grid h-[calc(100%+44px)] -mt-[44px] pl-2"
            style={{
                gridTemplateColumns: builderChatOpen ? "14fr 6fr" : "19fr 1fr",
                transition: "grid-template-columns 200ms ease-in-out"
            }}
        >
            <div className="h-full min-h-0 col-span-1 pt-[46px]">
                <div className="mx-auto h-full min-h-0 flex flex-col">
                    <TabGroup
                        selectedIndex={selectedIndex}
                        className="h-full flex flex-col"
                        onChange={index => {
                            setSelectedIndex(index)
                            const next = tabs[index]
                            const nextParams = new URLSearchParams(searchParams)
                            nextParams.set("tab", next)
                            setSearchParams(nextParams, { replace: true })
                        }}
                    >
                        <TabList className="flex gap-2 border-b border-input items-center">
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
                        <TabPanels className="flex-1 min-h-0 flex">
                            <TabPanel className="flex-1 min-h-0 h-full flex flex-col">
                                <AgentSetupTab {...agentProps} />
                            </TabPanel>
                            <TabPanel className="flex-1 min-h-0 flex flex-col">
                                <AgentRunHistoryTab agentId={agentId} />
                            </TabPanel>
                        </TabPanels>
                    </TabGroup>
                </div>
            </div>
            <div className={cn("border-l border-border h-full min-h-0 col-span-1 flex flex-col overflow-hidden", builderChatOpen && "pl-2")}>
                <div className={cn("shrink-0 flex pt-0.5 pr-1", builderChatOpen ? "" : "justify-center")}>
                    <ChatSidebarTrigger onClick={() => setBuilderChatOpen(prev => !prev)} title={builderChatOpen ? "Close builder chat (⌘⇧C)" : "Open builder chat (⌘⇧C)"} />
                </div>
                {builderChatOpen && (
                    <div className="flex-1 min-w-0 min-h-0 w-full">
                        <BuilderChat getStateJSON={() => getStateJSON()} agentId={agentId} />
                    </div>
                )}
            </div>
        </div>
    )
}

export default AgentDetail
