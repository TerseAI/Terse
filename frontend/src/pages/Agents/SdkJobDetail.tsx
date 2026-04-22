import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Tab, TabGroup, TabList } from "@headlessui/react"
import { Clock, Code, Info, Lightbulb, Loader2, MoreVertical, Pause, Play, Radar, Server, Trash2, Zap } from "lucide-react"
import { toast } from "sonner"
import { CONFIG_DETAILS, ConfigType } from "terse-types"
import { FrontendRoutes } from "terse-types"
import type { AgentTrigger, FrequencyUnit, SdkJobServerCheckResponse, SerializedEvent } from "terse-types"

import BreadCrumb from "../../components/BreadCrumb"
import ToolCallParameters from "../../components/ToolCallParameters"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu"
import { SidebarTrigger } from "../../components/ui/sidebar"
import { useAgent, useAgentMutations } from "../../hooks/api/useAgents"
import { useSampleEvents } from "../../hooks/api/useSampleEvents"
import { BackendProvider } from "../../services/backend"

import { IconForConfigType } from "./components/Integration"
import { SdkJobServerCheckDialog } from "./components/SdkJobServerCheckDialog"
import { WebhookTriggerCard } from "./components/WebhookTriggerCard"
import { AgentFileExplorer } from "./tabs/AgentFileExplorer"
import AgentImprovementsTab, { useAgentPendingCount } from "./tabs/AgentImprovementsTab"
import AgentRunHistoryTab from "./tabs/AgentRunHistoryTab"

function formatWebMonitorFrequency(frequency: { number: number; unit: FrequencyUnit }) {
    const amount = Math.max(1, frequency.number)
    const { unit } = frequency
    return amount === 1 ? `Every ${unit}` : `Every ${amount} ${unit}s`
}

function WebMonitorTriggerCard({ trigger }: { trigger: AgentTrigger }) {
    if (trigger.config.configType !== ConfigType.WEBMONITOR) {
        return null
    }

    const { query, frequency, outputSchema } = trigger.config

    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
                <Radar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">Web Monitor</span>
                <span className="ml-auto text-[11px] font-medium tabular-nums text-muted-foreground">{formatWebMonitorFrequency(frequency)}</span>
            </div>
            <div className="px-3 py-3">
                <p className="text-sm leading-relaxed text-foreground break-words">{query}</p>
            </div>
            {outputSchema ? (
                <div className="border-t border-border/40 px-3 pb-3 pt-2.5">
                    <ToolCallParameters
                        parameters={JSON.stringify({
                            ...(outputSchema.jsonSchema.properties ? { properties: outputSchema.jsonSchema.properties } : {}),
                            ...(outputSchema.jsonSchema.required ? { required: outputSchema.jsonSchema.required } : {})
                        })}
                        label="Structured output"
                        collapsed={true}
                    />
                </div>
            ) : null}
        </div>
    )
}

export default function SdkJobDetail({ agentId }: { agentId: string }) {
    const navigate = useNavigate()
    const { agent, isLoading, mutate } = useAgent(agentId)
    const { deleteAgent, updateAgent } = useAgentMutations()

    const pendingCount = useAgentPendingCount(agentId)
    const [selectedTab, setSelectedTab] = useState(0)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isManualTriggering, setIsManualTriggering] = useState(false)
    const [isVerifyingServer, setIsVerifyingServer] = useState(false)
    const [serverCheckResult, setServerCheckResult] = useState<SdkJobServerCheckResponse | null>(null)
    const [showServerCheckDialog, setShowServerCheckDialog] = useState(false)

    const {
        isFetching: isFetchingSamples,
        isTriggering: isEventTriggering,
        events: sampleEvents,
        isDialogOpen: showSamplesDialog,
        hasIntegrationTriggers,
        fetchSamples,
        triggerWithEvent,
        closeDialog: closeSamplesDialog
    } = useSampleEvents(agent?.triggers ?? [], agentId)

    const handleToggleActive = async () => {
        if (!agent) return
        try {
            await updateAgent({
                id: agentId,
                data: { isActive: !agent.isActive },
                mutateAgent: mutate
            })
            toast.success(agent.isActive ? "Job paused" : "Job resumed")
        } catch {
            toast.error("Failed to update job status")
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await deleteAgent(agentId)
            toast.success("Job deleted")
            navigate(FrontendRoutes.AGENTS.SETUP)
        } catch {
            toast.error("Failed to delete job")
        } finally {
            setIsDeleting(false)
            setShowDeleteDialog(false)
        }
    }

    const handleTriggerNow = async () => {
        if (!agent) return

        if (hasIntegrationTriggers) {
            await fetchSamples()
            return
        }

        // Fall back to manual cron trigger for time-only jobs
        const triggerId = agent.triggers?.[0]?.id
        if (!triggerId) {
            toast.error("No trigger configured for this job")
            return
        }
        setIsManualTriggering(true)
        try {
            await BackendProvider.triggerManually(triggerId, "Manual trigger from SDK job detail page")
            toast.success("Job triggered")
            setSelectedTab(1)
        } catch {
            toast.error("Failed to trigger job")
        } finally {
            setIsManualTriggering(false)
        }
    }

    const handleSelectEvent = async (event: SerializedEvent) => {
        await triggerWithEvent(event)
        setSelectedTab(1)
    }

    const handleVerifyServer = async () => {
        if (!agent?.metadata?.remoteServerUrl) return

        setIsVerifyingServer(true)
        try {
            const result = await BackendProvider.verifySdkJobServer(agentId)
            setServerCheckResult(result)
            setShowServerCheckDialog(true)
        } catch {
            toast.error("Failed to verify server")
        } finally {
            setIsVerifyingServer(false)
        }
    }

    const isBusy = isFetchingSamples || isManualTriggering

    if (isLoading || !agent) {
        return (
            <div className="flex h-full items-center justify-center" aria-busy="true">
                <div className="text-muted-foreground text-sm" role="status">
                    Loading...
                </div>
            </div>
        )
    }

    const triggers = agent.triggers ?? []
    const hasSelfHostedJobUrl = agent.source === "SDK" && !!agent.metadata?.remoteServerUrl

    return (
        <div className="flex h-full min-w-0 flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 px-2 py-2.5">
                <SidebarTrigger />
                <div className="hidden sm:block">
                    <BreadCrumb inline />
                </div>
            </div>

            <div className="flex items-center gap-3 px-4 pb-2">
                <h1 className="text-lg font-semibold truncate">{agent.name}</h1>
                <Badge variant="outline" className={agent.isActive ? "text-success border-success" : "text-muted-foreground"}>
                    {agent.isActive ? "Active" : "Paused"}
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                    {hasSelfHostedJobUrl && (
                        <Button variant="outline" size="sm" onClick={handleVerifyServer} disabled={isVerifyingServer}>
                            {isVerifyingServer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
                            Verify Server
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleTriggerNow} disabled={isBusy || !agent.isActive || !agent.triggers?.length}>
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                        {isFetchingSamples ? "Fetching events…" : "Trigger Now"}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleToggleActive}>
                                {agent.isActive ? (
                                    <>
                                        <Pause className="h-4 w-4" />
                                        Pause Job
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-4 w-4" />
                                        Resume Job
                                    </>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                                <Trash2 className="h-4 w-4" />
                                Delete Job
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Tabs */}
            <TabGroup selectedIndex={selectedTab} onChange={setSelectedTab} className="flex flex-1 flex-col min-h-0 pl-2">
                <TabList className="flex gap-2 border-b border-input items-center pt-2">
                    <Tab
                        className={({ selected }) =>
                            `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`
                        }
                    >
                        <Info className="h-4 w-4" />
                        <span>Overview</span>
                    </Tab>
                    <Tab
                        className={({ selected }) =>
                            `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`
                        }
                    >
                        <Clock className="h-4 w-4" />
                        <span>Activity</span>
                    </Tab>
                    <Tab
                        className={({ selected }) =>
                            `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`
                        }
                    >
                        <Lightbulb className="h-4 w-4" />
                        <span>Improvements</span>
                        {pendingCount > 0 && (
                            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">{pendingCount}</span>
                        )}
                    </Tab>
                    <Tab
                        className={({ selected }) =>
                            `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`
                        }
                    >
                        <Code className="h-4 w-4" />
                        <span>Code</span>
                    </Tab>
                </TabList>

                <div className={selectedTab === 3 ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "min-h-0 flex-1 overflow-y-auto"}>
                    {selectedTab === 0 ? (
                        <OverviewTab triggers={triggers} updatedAt={agent.updatedAt} isActive={agent.isActive} />
                    ) : selectedTab === 1 ? (
                        <AgentRunHistoryTab agentId={agentId} />
                    ) : selectedTab === 2 ? (
                        <AgentImprovementsTab agentId={agentId} source="SDK" />
                    ) : (
                        <AgentFileExplorer agentId={agentId} />
                    )}
                </div>
            </TabGroup>

            {/* Delete dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={open => !open && setShowDeleteDialog(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Job</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-semibold">{agent.name}</span>? This action cannot be undone and will remove all associated run history.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? "Deleting..." : "Delete Job"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <SdkJobServerCheckDialog open={showServerCheckDialog} result={serverCheckResult} onClose={() => setShowServerCheckDialog(false)} />

            {/* Sample events picker dialog */}
            <SampleEventsDialog
                events={sampleEvents}
                open={showSamplesDialog}
                isFetching={isFetchingSamples}
                isTriggering={isEventTriggering}
                onSelect={handleSelectEvent}
                onClose={closeSamplesDialog}
            />
        </div>
    )
}

function SampleEventsDialog({
    events,
    open,
    isFetching,
    isTriggering,
    onSelect,
    onClose
}: {
    events: SerializedEvent[]
    open: boolean
    isFetching: boolean
    isTriggering: boolean
    onSelect: (event: SerializedEvent) => void
    onClose: () => void
}) {
    return (
        <Dialog open={open} onOpenChange={v => !v && !isFetching && onClose()}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{isFetching ? "Fetching Sample Events…" : "Select a Sample Event"}</DialogTitle>
                    <DialogDescription>
                        {isFetching
                            ? "Pulling recent events from your connected integrations. This may take a few seconds."
                            : `Pick an event to trigger your job with. ${events.length} sample event${events.length !== 1 ? "s" : ""} found.`}
                    </DialogDescription>
                </DialogHeader>
                {isFetching ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Fetching sample events…</p>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                        {events.map((event, i) => (
                            <button
                                key={i}
                                className="w-full text-left rounded-md border border-input p-3 space-y-1.5 hover:bg-accent/50 transition-colors disabled:opacity-50"
                                onClick={() => onSelect(event)}
                                disabled={isTriggering}
                            >
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                        {event.integrationType}
                                    </Badge>
                                    <span className="text-sm font-medium truncate">{event.debugLog}</span>
                                    <Zap className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                                </div>
                                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto bg-muted/50 rounded p-2">{event.formattedContent}</pre>
                            </button>
                        ))}
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isTriggering || isFetching}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function OverviewTab({ triggers, updatedAt, isActive }: { triggers: AgentTrigger[]; updatedAt: string | null; isActive: boolean }) {
    return (
        <div className="p-4 space-y-6 max-w-2xl">
            {/* Status */}
            <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                <p className="text-sm">{isActive ? "Active — this job is listening for events and running automatically." : "Paused — this job will not process any events until resumed."}</p>
            </div>

            {/* Triggers */}
            <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-muted-foreground">Triggers</h3>
                {triggers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No triggers configured.</p>
                ) : (
                    <div className="space-y-2">
                        {triggers.map(trigger => {
                            const configType = trigger.config.configType

                            if (configType === ConfigType.WEBHOOK_INPUT) {
                                return <WebhookTriggerCard key={trigger.id} trigger={trigger} />
                            }

                            if (configType === ConfigType.WEBMONITOR) {
                                return <WebMonitorTriggerCard key={trigger.id} trigger={trigger} />
                            }

                            const details = CONFIG_DETAILS[configType as keyof typeof CONFIG_DETAILS]
                            return (
                                <div key={trigger.id} className="flex items-center gap-2 rounded-md border border-input p-2.5">
                                    <div className="w-6 h-6 shrink-0">
                                        <IconForConfigType type={configType} />
                                    </div>
                                    <span className="text-sm">{details?.name ?? configType}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Source */}
            <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-muted-foreground">Source</h3>
                <p className="text-sm">Deployed via SDK. Configuration is managed in code.</p>
            </div>

            {/* Last deployed */}
            {updatedAt && (
                <div className="space-y-1.5">
                    <h3 className="text-sm font-medium text-muted-foreground">Last Deployed</h3>
                    <p className="text-sm">{new Date(updatedAt).toLocaleString()}</p>
                </div>
            )}
        </div>
    )
}
