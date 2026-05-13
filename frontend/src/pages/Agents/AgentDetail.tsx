import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"

import { Tab, TabGroup, TabList } from "@headlessui/react"
import { Clock, Lightbulb, Settings } from "lucide-react"
import { AgentNotificationSettings, AgentPrompt, TransientAgentOutput, TransientAgentTrigger } from "terse-types"

import BreadCrumb from "../../components/BreadCrumb"
import { SidebarTrigger } from "../../components/ui/sidebar"
import { useAgent } from "../../hooks/api/useAgents"
import { FeatureFlags, useFeatureFlag } from "../../hooks/useFeatureFlag"
import { toTransientAgentOutput, toTransientAgentTrigger } from "../../utility/AgentUtils"

import SdkJobDetail from "./SdkJobDetail"
import AgentImprovementsTab, { useAgentPendingCount } from "./tabs/AgentImprovementsTab"
import AgentRunHistoryTab from "./tabs/AgentRunHistoryTab"
import AgentSetupTab, { AgentSetupTabProps } from "./tabs/AgentSetupTab"

const AGENT_DETAIL_TABS = ["setup", "history", "improvements"] as const

function AgentDetail() {
    const { id } = useParams<{ id: string }>()
    const [searchParams, setSearchParams] = useSearchParams()

    // Only pass agentId if it's not "new"
    const agentId: string | null = id && id !== "new" ? id : null

    const showImprovementsTab = useFeatureFlag(FeatureFlags.AGENT_IMPROVEMENTS_TAB)
    const activeTabs = showImprovementsTab ? AGENT_DETAIL_TABS : AGENT_DETAIL_TABS.filter(t => t !== "improvements")
    const pendingImprovementCount = useAgentPendingCount(showImprovementsTab ? agentId : null)

    // Fetch agent data using useSWR
    const { agent, isLoading: isFetching, isError: agentFetchError, mutate } = useAgent(agentId)

    // Local state for editing - use transient types for the editing interface
    const [name, setName] = useState<string | null>(null)
    const [inputs, setInputs] = useState<TransientAgentTrigger[]>([])
    const [outputs, setOutputs] = useState<TransientAgentOutput[]>([])
    const [prompt, setPrompt] = useState<AgentPrompt | undefined>(undefined)
    const [isActive, setIsActive] = useState<boolean>(true)
    const [requireApproval, setRequireApproval] = useState<boolean>(false)
    const [toolApprovals, setToolApprovals] = useState<string[]>([])
    const [notificationSettings, setNotificationSettings] = useState<AgentNotificationSettings>({
        enabled: true,
        actionTypes: ["approve", "delete"]
    })

    // Sync local state with fetched data - convert from AgentTrigger/Output to Transient types
    useEffect(() => {
        if (agent) {
            setName(agent.name)
            setInputs(agent.triggers.map(toTransientAgentTrigger))
            setOutputs(agent.outputs ? agent.outputs.map(toTransientAgentOutput) : [])
            setPrompt(agent.prompt)
            setIsActive(agent.isActive)
            setRequireApproval(agent.requireApproval ?? false)
            setToolApprovals(agent.toolApprovals || [])
            setNotificationSettings(agent.notificationSettings ?? { enabled: false, actionTypes: [] })
        }
    }, [agent, agentId])

    const getTabIndex = (queryTab: string | null) => {
        const resolvedTab = queryTab ?? "setup"
        return Math.max(
            0,
            activeTabs.findIndex(tab => tab === resolvedTab)
        )
    }

    const tabFromQuery = searchParams.get("tab")
    const [selectedIndex, setSelectedIndex] = useState(() => {
        return getTabIndex(tabFromQuery)
    })

    // Update selected index when URL or available tabs change
    useEffect(() => {
        const tabFromQuery = searchParams.get("tab")
        const newIndex = getTabIndex(tabFromQuery)
        setSelectedIndex(newIndex)
    }, [searchParams, getTabIndex])

    // Determine if we're still loading
    // - For existing agents: wait for agent data
    const isLoading = isFetching

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
        agentCreator: agent?.createdByUserId,
        mutate,
        updatedAt: agent?.updatedAt
    }

    // SDK-sourced agents get a simplified detail view
    if (agentId && agent?.source === "SDK") {
        return <SdkJobDetail agentId={agentId} />
    }

    // Show error state if agent fetch failed
    if (agentId && agentFetchError && !agent) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-2">
                    <div className="text-muted-foreground text-sm">Failed to load agent.</div>
                    <button
                        onClick={() => mutate()}
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                    >
                        Try again
                    </button>
                </div>
            </div>
        )
    }

    // Show loading state while determining agent source for existing agents
    if (agentId && isFetching && !agent) {
        return (
            <div className="flex h-full items-center justify-center" aria-busy="true">
                <div className="text-muted-foreground text-sm" role="status">
                    Loading...
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full min-w-0 overflow-y-auto @container/agent-detail-pane">
            <div className="flex items-center gap-4 px-2 py-2.5">
                <SidebarTrigger />
                <div className="hidden @2xl/agent-detail-pane:block">
                    <BreadCrumb inline />
                </div>
            </div>
            <TabGroup
                selectedIndex={selectedIndex}
                onChange={index => {
                    setSelectedIndex(index)
                    const next = activeTabs[index]
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
                    {showImprovementsTab && (
                        <Tab
                            className={({ selected }) =>
                                `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`
                            }
                        >
                            <Lightbulb className="h-4 w-4" />
                            <span>Improvements</span>
                            {pendingImprovementCount > 0 && (
                                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                    {pendingImprovementCount}
                                </span>
                            )}
                        </Tab>
                    )}
                </TabList>
            </TabGroup>
            <div className="min-w-0">
                {selectedIndex === 0 ? (
                    <AgentSetupTab {...agentProps} />
                ) : selectedIndex === 1 ? (
                    <AgentRunHistoryTab agentId={agentId} onTriggerNow={() => {}} />
                ) : showImprovementsTab ? (
                    <AgentImprovementsTab agentId={agentId} />
                ) : null}
            </div>
        </div>
    )
}

export default AgentDetail
