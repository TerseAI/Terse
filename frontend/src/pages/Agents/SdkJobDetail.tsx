import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Tab, TabGroup, TabList } from "@headlessui/react"
import { Loader2, MoreVertical, Pause, Play, Server, Trash2, Zap } from "lucide-react"
import { DateTime } from "luxon"
import { toast } from "sonner"
import { CONFIG_DETAILS, ConfigType, FrontendRoutes } from "terse-types"
import type { AgentTrigger, SdkJobServerCheckResponse } from "terse-types"
import type { SdkSampleEventRef as SampleEventRef } from "terse-types"
import type { Agent } from "terse-types/types"

import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip"
import { useAgent, useAgentMutations } from "../../hooks/api/useAgents"
import { useSampleEvents } from "../../hooks/api/useSampleEvents"
import { cn } from "../../lib/utils"
import { BackendProvider } from "../../services/backend"
import { formatTimestamp } from "../../utility/timeUtils"
import { CenteredMessage, Dot, PageFrame, SectionLabel } from "../Projects/ProjectDetailShared"

import { SdkJobServerCheckDialog } from "./components/SdkJobServerCheckDialog"
import { TriggerDetailCard } from "./components/TriggerDetailCard"
import AgentImprovementsTab, { useAgentPendingCount } from "./tabs/AgentImprovementsTab"
import AgentRunHistoryTab from "./tabs/AgentRunHistoryTab"

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

        const triggerId = agent.triggers?.[0]?.id
        if (!triggerId) {
            toast.error("No trigger configured for this job")
            return
        }
        setIsManualTriggering(true)
        try {
            await BackendProvider.triggerManually(triggerId, "Manual trigger from SDK job detail page")
            toast.success("Job triggered")
            setSelectedTab(0)
        } catch {
            toast.error("Failed to trigger job")
        } finally {
            setIsManualTriggering(false)
        }
    }

    const handleSelectEvent = async (event: SampleEventRef) => {
        await triggerWithEvent(event)
        setSelectedTab(0)
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
            <PageFrame>
                <CenteredMessage text="Loading job…" />
            </PageFrame>
        )
    }

    const triggers = agent.triggers ?? []
    const hasSelfHostedJobUrl = agent.source === "SDK" && !!agent.metadata?.remoteServerUrl
    const triggerCount = triggers.length
    const canTrigger = agent.isActive && triggerCount > 0

    return (
        <TooltipProvider delayDuration={200}>
            <PageFrame>
                <JobHeading
                    agent={agent}
                    triggerCount={triggerCount}
                    canTrigger={canTrigger}
                    isBusy={isBusy}
                    isFetchingSamples={isFetchingSamples}
                    onTriggerNow={handleTriggerNow}
                    onToggleActive={handleToggleActive}
                    onDelete={() => setShowDeleteDialog(true)}
                />

                <TriggersSection triggers={triggers} />

                {hasSelfHostedJobUrl ? <EnvironmentSection remoteServerUrl={agent.metadata?.remoteServerUrl ?? null} isVerifying={isVerifyingServer} onVerify={handleVerifyServer} /> : null}

                <ActivitySection agentId={agentId} pendingCount={pendingCount} selectedTab={selectedTab} onTabChange={setSelectedTab} />
            </PageFrame>

            <Dialog open={showDeleteDialog} onOpenChange={open => !open && setShowDeleteDialog(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete job</DialogTitle>
                        <DialogDescription>
                            This will permanently delete <span className="text-foreground font-semibold">{agent.name}</span> and all associated run history. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? "Deleting…" : "Delete job"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <SdkJobServerCheckDialog open={showServerCheckDialog} result={serverCheckResult} onClose={() => setShowServerCheckDialog(false)} />

            <SampleEventsDialog
                events={sampleEvents}
                open={showSamplesDialog}
                isFetching={isFetchingSamples}
                isTriggering={isEventTriggering}
                onSelect={handleSelectEvent}
                onClose={closeSamplesDialog}
            />
        </TooltipProvider>
    )
}

function JobHeading({
    agent,
    triggerCount,
    canTrigger,
    isBusy,
    isFetchingSamples,
    onTriggerNow,
    onToggleActive,
    onDelete
}: {
    agent: Agent
    triggerCount: number
    canTrigger: boolean
    isBusy: boolean
    isFetchingSamples: boolean
    onTriggerNow: () => void
    onToggleActive: () => void
    onDelete: () => void
}) {
    const updatedAbsolute = agent.updatedAt ? DateTime.fromISO(agent.updatedAt).toFormat("LLL d, yyyy · h:mm:ss a") : null
    const updatedRelative = agent.updatedAt ? formatTimestamp(agent.updatedAt) : null
    const primaryTriggerLabel = primaryTriggerSummary(agent.triggers ?? [])

    return (
        <header>
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h1 className="text-foreground truncate text-[clamp(1.625rem,2.5vw,2rem)] leading-tight font-semibold tracking-tight">{agent.name}</h1>
                        {agent.isActive ? <ActiveBadge /> : <PausedBadge />}
                    </div>

                    <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span>Deployed via SDK</span>
                        {triggerCount === 1 && primaryTriggerLabel ? (
                            <>
                                <Dot />
                                <span>
                                    Triggered by <span className="text-foreground font-medium">{primaryTriggerLabel}</span>
                                </span>
                            </>
                        ) : triggerCount > 1 ? (
                            <>
                                <Dot />
                                <span className="tabular-nums">{triggerCount} triggers</span>
                            </>
                        ) : null}
                        {updatedRelative ? (
                            <>
                                <Dot />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="tabular-nums cursor-default">Updated {updatedRelative}</span>
                                    </TooltipTrigger>
                                    {updatedAbsolute ? <TooltipContent>{updatedAbsolute}</TooltipContent> : null}
                                </Tooltip>
                            </>
                        ) : null}
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onTriggerNow} disabled={isBusy || !canTrigger} title={!canTrigger ? "Requires an active job with at least one trigger" : undefined}>
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                        {isFetchingSamples ? "Fetching events…" : "Trigger now"}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Job actions">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onToggleActive}>
                                {agent.isActive ? (
                                    <>
                                        <Pause className="h-4 w-4" />
                                        Pause job
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-4 w-4" />
                                        Resume job
                                    </>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={onDelete}>
                                <Trash2 className="h-4 w-4" />
                                Delete job
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    )
}

function ActiveBadge() {
    return (
        <Badge variant="secondary" className="text-foreground shrink-0">
            <span aria-hidden className="bg-success relative flex h-1.5 w-1.5 rounded-full">
                <span className="bg-success absolute inset-0 animate-ping rounded-full opacity-60" />
            </span>
            Active
        </Badge>
    )
}

function PausedBadge() {
    return (
        <Badge variant="secondary" className="text-muted-foreground shrink-0">
            <span aria-hidden className="bg-muted-foreground/50 h-1.5 w-1.5 rounded-full" />
            Paused
        </Badge>
    )
}

function primaryTriggerSummary(triggers: AgentTrigger[]): string | null {
    const first = triggers[0]
    if (!first) return null
    const type = first.config.configType
    if (type === ConfigType.WEBHOOK_INPUT) return "Webhook"
    if (type === ConfigType.WEBMONITOR) return "Web monitor"
    const details = CONFIG_DETAILS[type as keyof typeof CONFIG_DETAILS]
    return details?.name ?? null
}

function TriggersSection({ triggers }: { triggers: AgentTrigger[] }) {
    return (
        <section className="mt-8">
            <SectionLabel>Triggers</SectionLabel>
            {triggers.length === 0 ? (
                <TriggersEmpty />
            ) : (
                <div className="space-y-2.5">
                    {triggers.map(trigger => (
                        <TriggerDetailCard key={trigger.id} trigger={trigger} />
                    ))}
                </div>
            )}
        </section>
    )
}

function TriggersEmpty() {
    return (
        <div className="border-border/60 bg-muted/10 rounded-lg border px-6 py-8 text-center">
            <p className="text-foreground text-sm">No triggers configured.</p>
            <p className="text-muted-foreground mt-1 text-xs">Add a trigger in your SDK project to connect this job to events or schedules.</p>
        </div>
    )
}

function EnvironmentSection({ remoteServerUrl, isVerifying, onVerify }: { remoteServerUrl: string | null; isVerifying: boolean; onVerify: () => void }) {
    return (
        <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-4">
                <SectionLabel className="mb-0">Environment</SectionLabel>
                <Button variant="outline" size="sm" onClick={onVerify} disabled={isVerifying}>
                    {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Server className="h-3.5 w-3.5" />}
                    Verify server
                </Button>
            </div>
            <div className="border-border/60 bg-muted/10 overflow-hidden rounded-lg border">
                <div className="px-4 py-3">
                    <div className="text-muted-foreground text-[10px] font-medium tracking-[0.14em] uppercase">Remote server</div>
                    <div className="mt-1.5 text-sm">
                        {remoteServerUrl ? <code className="text-foreground font-mono text-[13px] break-all">{remoteServerUrl}</code> : <span className="text-muted-foreground">—</span>}
                    </div>
                </div>
            </div>
        </section>
    )
}

function ActivitySection({ agentId, pendingCount, selectedTab, onTabChange }: { agentId: string; pendingCount: number; selectedTab: number; onTabChange: (i: number) => void }) {
    return (
        <section className="mt-10">
            <TabGroup selectedIndex={selectedTab} onChange={onTabChange}>
                <TabList className="border-border/60 flex items-baseline gap-6 border-b">
                    <StreamTab label="Activity" />
                    <StreamTab label="Improvements" badge={pendingCount} />
                </TabList>

                <div className="pt-5">{selectedTab === 0 ? <AgentRunHistoryTab agentId={agentId} /> : <AgentImprovementsTab agentId={agentId} source="SDK" />}</div>
            </TabGroup>
        </section>
    )
}

function StreamTab({ label, badge }: { label: string; badge?: number }) {
    return (
        <Tab
            className={({ selected }) =>
                cn(
                    "group focus:outline-none",
                    "relative -mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-[10px] font-semibold tracking-[0.18em] uppercase transition-colors",
                    selected ? "text-foreground border-foreground" : "text-muted-foreground hover:text-foreground border-transparent"
                )
            }
        >
            <span>{label}</span>
            {badge && badge > 0 ? (
                <span className="bg-primary text-primary-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold tabular-nums">{badge}</span>
            ) : null}
        </Tab>
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
    events: SampleEventRef[]
    open: boolean
    isFetching: boolean
    isTriggering: boolean
    onSelect: (event: SampleEventRef) => void
    onClose: () => void
}) {
    return (
        <Dialog open={open} onOpenChange={v => !v && !isFetching && onClose()}>
            <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
                <DialogHeader>
                    <DialogTitle>{isFetching ? "Fetching sample events…" : "Select a sample event"}</DialogTitle>
                    <DialogDescription>
                        {isFetching
                            ? "Pulling recent events from your connected integrations. This may take a few seconds."
                            : `Pick an event to trigger your job with. ${events.length} sample event${events.length !== 1 ? "s" : ""} found.`}
                    </DialogDescription>
                </DialogHeader>
                {isFetching ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                        <p className="text-muted-foreground text-sm">Fetching sample events…</p>
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {events.map((event, i) => (
                            <button
                                key={i}
                                className="border-border/60 hover:bg-muted/40 w-full space-y-1.5 rounded-lg border p-3 text-left transition-colors disabled:opacity-50"
                                onClick={() => onSelect(event)}
                                disabled={isTriggering}
                            >
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                        {event.serializedEvent.integrationType}
                                    </Badge>
                                    <span className="truncate text-sm font-medium">
                                        {event.serializedEvent.display?.title || `${event.serializedEvent.integrationType}/${event.serializedEvent.eventType}`}
                                    </span>
                                    <Zap className="text-muted-foreground ml-auto h-3.5 w-3.5 shrink-0" />
                                </div>
                                <div className="text-muted-foreground bg-muted/50 rounded-md p-2 text-xs">{event.serializedEvent.display?.subtitle || event.serializedEvent.eventType}</div>
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
