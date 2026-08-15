import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Tab, TabGroup, TabList } from "@headlessui/react"
import { Loader2, MoreVertical, Play, Server, Trash2, Zap } from "lucide-react"
import { DateTime } from "luxon"
import { toast } from "sonner"
import { FrontendRoutes } from "terse-types"
import type { AgentTrigger, SdkJobServerCheckResponse } from "terse-types"
import type { SdkSampleEventRef as SampleEventRef } from "terse-types"
import type { Agent } from "terse-types/types"

import { PageFrame } from "@/components/PageFrame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BackendProvider } from "@/lib/http"
import { cn } from "@/lib/utils"
import { useAgent, useAgentMutations } from "@/modules/agents/api/useAgents"
import { useSampleEvents } from "@/modules/notifications/api/useSampleEvents"
import { CenteredMessage, DetailField, SectionLabel } from "@/modules/projects/components/ProjectDetailShared"
import { formatTimestamp } from "@/utils/time"

import { SdkJobServerCheckDialog } from "./SdkJobServerCheckDialog"
import { TriggerDetailRow } from "./TriggerDetailRow"
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
    const [isTogglingActive, setIsTogglingActive] = useState(false)
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
        setIsTogglingActive(true)
        try {
            await updateAgent({
                id: agentId,
                data: { isActive: !agent.isActive },
                mutateAgent: mutate
            })
            toast.success(agent.isActive ? "Job paused" : "Job resumed")
        } catch {
            toast.error("Failed to update job status")
        } finally {
            setIsTogglingActive(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await deleteAgent(agentId)
            toast.success("Job deleted")
            navigate(FrontendRoutes.HOME)
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
    const hasSelfHostedJobUrl = !!agent.metadata?.remoteServerUrl
    const triggerCount = triggers.length
    const canTrigger = agent.isActive && triggerCount > 0

    return (
        <TooltipProvider delayDuration={200}>
            <PageFrame>
                <JobHeading
                    agent={agent}
                    canTrigger={canTrigger}
                    isBusy={isBusy}
                    isFetchingSamples={isFetchingSamples}
                    isTogglingActive={isTogglingActive}
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
    canTrigger,
    isBusy,
    isFetchingSamples,
    isTogglingActive,
    onTriggerNow,
    onToggleActive,
    onDelete
}: {
    agent: Agent
    canTrigger: boolean
    isBusy: boolean
    isFetchingSamples: boolean
    isTogglingActive: boolean
    onTriggerNow: () => void
    onToggleActive: () => void
    onDelete: () => void
}) {
    const updatedAbsolute = agent.updatedAt ? DateTime.fromISO(agent.updatedAt).toFormat("LLL d, yyyy · h:mm:ss a") : null
    const updatedRelative = agent.updatedAt ? formatTimestamp(agent.updatedAt) : null
    const triggerLabel = !canTrigger ? "Requires an active job with at least one trigger" : isFetchingSamples ? "Fetching events…" : "Trigger now"

    return (
        <header>
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1">
                    <h1 className="text-foreground truncate text-2xl leading-tight font-semibold tracking-tight">{agent.name}</h1>

                    <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                        <JobActiveToggle isActive={agent.isActive} isPending={isTogglingActive} onToggle={onToggleActive} />

                        {updatedRelative ? (
                            <>
                                <span aria-hidden className="text-muted-foreground/40">
                                    ·
                                </span>
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

                <div className="flex h-8 shrink-0 items-center">
                    <div className="border-border/60 flex h-8 items-center rounded-md border">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="inline-flex">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={onTriggerNow}
                                        disabled={isBusy || !canTrigger}
                                        aria-label={triggerLabel}
                                        className="rounded-r-none max-md:size-8 hover:bg-muted/60"
                                    >
                                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>{triggerLabel}</TooltipContent>
                        </Tooltip>

                        <span aria-hidden className="bg-border/60 h-4 w-px" />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label="Job actions" className="rounded-l-none max-md:size-8 hover:bg-muted/60">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                                    <Trash2 className="h-4 w-4" />
                                    Delete job
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </header>
    )
}

function JobActiveToggle({ isActive, isPending, onToggle }: { isActive: boolean; isPending: boolean; onToggle: () => void }) {
    return (
        <div className="flex shrink-0 items-center gap-2">
            <Switch
                id="job-active"
                checked={isActive}
                onCheckedChange={onToggle}
                disabled={isPending}
                aria-label={isActive ? "Pause job" : "Resume job"}
                className="h-4.5 w-8 data-[state=checked]:bg-success/85 data-[state=checked]:[&_[data-slot=switch-thumb]]:bg-white [&_[data-slot=switch-thumb]]:size-3.5 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-3.5"
            />
            <label htmlFor="job-active" className={cn("cursor-pointer text-xs select-none", isActive ? "text-foreground" : "text-muted-foreground")}>
                {isActive ? "Active" : "Paused"}
            </label>
        </div>
    )
}

function TriggersSection({ triggers }: { triggers: AgentTrigger[] }) {
    return (
        <section className="mt-6">
            <SectionLabel>Triggers</SectionLabel>
            {triggers.length === 0 ? (
                <TriggersEmpty />
            ) : (
                <div className="divide-border/40 overflow-hidden rounded-lg border bg-card divide-y">
                    {triggers.map(trigger => (
                        <TriggerDetailRow key={trigger.id} trigger={trigger} />
                    ))}
                </div>
            )}
        </section>
    )
}

function TriggersEmpty() {
    return (
        <div className="border-border/60 rounded-lg border px-4 py-5">
            <p className="text-foreground text-sm">No triggers configured.</p>
            <p className="text-muted-foreground mt-1 text-xs">Add a trigger in your SDK project to connect this job to events or schedules.</p>
        </div>
    )
}

function EnvironmentSection({ remoteServerUrl, isVerifying, onVerify }: { remoteServerUrl: string | null; isVerifying: boolean; onVerify: () => void }) {
    return (
        <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-4">
                <SectionLabel className="mb-0">Environment</SectionLabel>
                <Button variant="outline" size="sm" onClick={onVerify} disabled={isVerifying}>
                    {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Server className="h-3.5 w-3.5" />}
                    Verify server
                </Button>
            </div>
            <dl>
                <DetailField label="Remote server">
                    {remoteServerUrl ? <code className="font-mono text-[13px] break-all">{remoteServerUrl}</code> : <span className="text-muted-foreground">—</span>}
                </DetailField>
            </dl>
        </section>
    )
}

function ActivitySection({ agentId, pendingCount, selectedTab, onTabChange }: { agentId: string; pendingCount: number; selectedTab: number; onTabChange: (i: number) => void }) {
    return (
        <section className="mt-6">
            <TabGroup selectedIndex={selectedTab} onChange={onTabChange}>
                <TabList className="border-border/60 flex items-baseline gap-6 border-b">
                    <StreamTab label="Activity" />
                    <StreamTab label="Improvements" badge={pendingCount} />
                </TabList>

                <div className="pt-3">{selectedTab === 0 ? <AgentRunHistoryTab agentId={agentId} /> : <AgentImprovementsTab agentId={agentId} />}</div>
            </TabGroup>
        </section>
    )
}

function StreamTab({ label, badge }: { label: string; badge?: number }) {
    return (
        <Tab
            className={({ selected }) =>
                cn(
                    "group relative -mb-px inline-flex items-center gap-2 rounded-sm px-1 pb-3 text-sm font-medium outline-none transition-colors duration-150 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:scale-x-0 after:bg-foreground after:transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected ? "text-foreground after:scale-x-100" : "text-muted-foreground hover:text-foreground"
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
                                type="button"
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
