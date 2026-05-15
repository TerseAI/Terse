import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { AlertTriangle, ArrowRight, Briefcase, CheckCircle2, CircleDot, KeyRound, Loader2, MoreVertical, Rocket, RotateCcw, Trash2, XCircle } from "lucide-react"
import { DateTime } from "luxon"
import { toast } from "sonner"
import { FrontendRoutes, buildRoute } from "terse-types"
import type { ProjectDeploy, ProjectDeployJobsDelta, ProjectDeployStatus, ProjectDetailResponse, ProjectSecretSummary } from "terse-types/types"

import { ALL_RUN_STATUSES, AgentRow, HEALTH_RANK, computeHealth, groupRunsByAgent } from "../../components/Agents/AgentHealthRow"
import BreadCrumb from "../../components/BreadCrumb"
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../components/ui/empty"
import { SidebarTrigger } from "../../components/ui/sidebar"
import { Skeleton } from "../../components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { useAgents } from "../../hooks/api/useAgents"
import { useAllRunHistory } from "../../hooks/api/useAllRunHistory"
import { useProjectMutations } from "../../hooks/api/useProject"
import { useProjectSecrets } from "../../hooks/api/useProjectSecrets"
import { cn } from "../../lib/utils"
import { formatDuration, formatTimestamp } from "../../utility/timeUtils"

const DEPLOYS_PREVIEW_LIMIT = 5

export function PageFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-full min-w-0 flex-col">
            <div className="flex items-center gap-4 px-2 py-2.5">
                <SidebarTrigger />
                <div className="hidden sm:block">
                    <BreadCrumb inline />
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10">{children}</div>
        </div>
    )
}

export function Heading({
    project,
    activeDeploy,
    latestDeploy
}: {
    project: Pick<ProjectDetailResponse, "name" | "isSelfHosted">
    activeDeploy: ProjectDeploy | null
    latestDeploy: ProjectDeploy | null
}) {
    const isDeploying = latestDeploy?.status === "IN_PROGRESS"

    return (
        <header>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-foreground text-[clamp(1.625rem,2.5vw,2rem)] leading-tight font-semibold tracking-tight">{project.name}</h1>
                <Badge variant="outline" className="text-muted-foreground border-border/80 shrink-0 text-[11px] font-medium">
                    {project.isSelfHosted ? "Self-hosted" : "Managed"}
                </Badge>
            </div>

            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {isDeploying ? (
                    <DeployingBadge />
                ) : activeDeploy ? (
                    <>
                        <LiveBadge />
                        <span className="tabular-nums">{formatTimestamp(activeDeploy.createdAt)}</span>
                        {activeDeploy.deployedBy ? (
                            <>
                                <Dot />
                                <span>
                                    by <span className="text-foreground font-medium">{activeDeploy.deployedBy.displayName}</span>
                                </span>
                            </>
                        ) : null}
                    </>
                ) : (
                    <Badge variant="secondary" className="text-foreground">
                        <CircleDot className="text-muted-foreground" />
                        No active deploy
                    </Badge>
                )}
            </div>
        </header>
    )
}

function DeployingBadge() {
    return (
        <Badge variant="secondary" className="text-foreground">
            <Loader2 className="text-warning animate-spin" />
            Deploying
        </Badge>
    )
}

export function JobsSection({ jobs }: { jobs: ProjectDetailResponse["jobs"] }) {
    const jobIds = new Set(jobs.map(j => j.id))
    const { agents: allAgents, isLoading: agentsLoading } = useAgents({ limit: 100 })
    const { runs, isLoading: runsLoading } = useAllRunHistory({
        page: 1,
        pageSize: 200,
        selectedStatuses: ALL_RUN_STATUSES
    })
    const isLoading = agentsLoading || runsLoading

    if (jobs.length === 0) {
        return (
            <section className="mt-8">
                <SectionLabel>Jobs</SectionLabel>
                <Empty className="mx-auto w-full max-w-lg border-solid border-border/60 bg-muted/10 p-6 md:p-8">
                    <EmptyHeader className="max-w-lg">
                        <EmptyMedia variant="icon">
                            <Briefcase className="text-primary" />
                        </EmptyMedia>
                        <EmptyTitle className="text-base">No jobs yet</EmptyTitle>
                        <EmptyDescription className="text-xs">
                            Define jobs in your SDK project, then run{" "}
                            <code className="text-foreground bg-muted border-border/60 rounded-sm border px-1.5 py-0.5 font-mono text-[11.5px]">terse deploy</code> to ship them to this project.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </section>
        )
    }

    const agents = allAgents.filter(a => jobIds.has(a.id))
    const runsByAgent = groupRunsByAgent(runs)
    const agentsWithHealth = agents
        .map(agent => ({ agent, health: computeHealth(agent, runsByAgent.get(agent.id) ?? []) }))
        .sort((a, b) => {
            const rank = HEALTH_RANK[a.health.status] - HEALTH_RANK[b.health.status]
            if (rank !== 0) return rank
            return a.agent.name.localeCompare(b.agent.name)
        })

    return (
        <section className="mt-8">
            <SectionLabel>Jobs</SectionLabel>
            <div className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-lg border">
                {isLoading ? (
                    <JobsSkeleton count={Math.min(jobs.length, 3)} />
                ) : (
                    <ul className="divide-border/60 divide-y">
                        {agentsWithHealth.map(({ agent, health }) => (
                            <AgentRow key={agent.id} agent={agent} health={health} />
                        ))}
                    </ul>
                )}
            </div>
        </section>
    )
}

function JobsSkeleton({ count }: { count: number }) {
    return (
        <div className="divide-border/60 divide-y">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-3 py-3.5">
                    <Skeleton className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export function DeploymentsSection({ projectId, deploys, isLoading }: { projectId: string; deploys: ProjectDeploy[] | undefined; isLoading: boolean }) {
    const total = deploys?.length ?? 0
    const visible = deploys?.slice(0, DEPLOYS_PREVIEW_LIMIT) ?? []
    const hasMore = total > DEPLOYS_PREVIEW_LIMIT
    const allDeploysHref = buildRoute(FrontendRoutes.PROJECTS.DEPLOYS, { id: projectId })

    return (
        <section className="mt-8">
            <SectionLabel>Deployments</SectionLabel>

            {isLoading ? (
                <DeploysSkeleton />
            ) : !deploys || deploys.length === 0 ? (
                <DeploysEmpty />
            ) : (
                <ol className="divide-border/60 border-border/60 divide-y overflow-hidden rounded-lg border">
                    {visible.map(d => (
                        <DeployRow key={d.id} deploy={d} />
                    ))}
                    {hasMore ? (
                        <li>
                            <Link
                                to={allDeploysHref}
                                className="text-muted-foreground hover:bg-muted/30 hover:text-foreground group flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs transition-colors"
                            >
                                See all {total} deployments
                                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        </li>
                    ) : null}
                </ol>
            )}
        </section>
    )
}

export function DeployRow({ deploy }: { deploy: ProjectDeploy }) {
    const relative = formatTimestamp(deploy.createdAt)
    const absolute = DateTime.fromISO(deploy.createdAt).toFormat("LLL d, yyyy · h:mm:ss a")
    const shortId = deploy.id.slice(-7)
    const durationLabel = deploy.durationMs !== null ? formatDuration(deploy.durationMs) : null
    const showFailureReason = deploy.status === "FAILED" && !!deploy.failureReason

    return (
        <li className="hover:bg-muted/30 grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors sm:grid-cols-[140px_auto_1fr_auto]">
            <DeployStatusBadge status={deploy.status} />

            <div className="flex min-w-0 items-center gap-2">
                <code className="text-muted-foreground font-mono text-[12px] tabular-nums">{shortId}</code>
                {deploy.isActive ? <LiveBadge /> : null}
                {deploy.jobsDelta ? <JobsDeltaSummary delta={deploy.jobsDelta} /> : null}
            </div>

            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="text-muted-foreground cursor-default text-xs tabular-nums">
                        {relative}
                        {durationLabel ? <span className="text-muted-foreground/60"> · in {durationLabel}</span> : null}
                    </span>
                </TooltipTrigger>
                <TooltipContent>{absolute}</TooltipContent>
            </Tooltip>

            <div className="col-span-3 flex items-center justify-end gap-2 sm:col-span-1">
                {deploy.deployedBy ? (
                    <>
                        <Avatar className="size-5">
                            {deploy.deployedBy.avatarUrl ? <AvatarImage src={deploy.deployedBy.avatarUrl} alt="" /> : null}
                            <AvatarFallback className="text-[9px] font-medium">{initialsOf(deploy.deployedBy.displayName)}</AvatarFallback>
                        </Avatar>
                        <span className="text-foreground max-w-[160px] truncate text-xs">{deploy.deployedBy.displayName}</span>
                    </>
                ) : (
                    <span className="text-muted-foreground text-xs">Unknown deployer</span>
                )}
            </div>

            {showFailureReason ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <p className="text-muted-foreground col-span-full mt-1 line-clamp-2 cursor-default text-xs sm:col-span-3 sm:col-start-2">{deploy.failureReason}</p>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md whitespace-pre-wrap">{deploy.failureReason}</TooltipContent>
                </Tooltip>
            ) : null}
        </li>
    )
}

function JobsDeltaSummary({ delta }: { delta: ProjectDeployJobsDelta }) {
    if (delta.added === 0 && delta.removed === 0) return null
    const totalChanges = delta.added + delta.removed
    return (
        <span className="flex items-center gap-1 text-xs tabular-nums">
            {delta.added > 0 ? <span className="text-success">+{delta.added}</span> : null}
            {delta.removed > 0 ? <span className="text-danger">-{delta.removed}</span> : null}
            <span className="text-muted-foreground">{totalChanges === 1 ? "job" : "jobs"}</span>
        </span>
    )
}

function DeployStatusBadge({ status }: { status: ProjectDeployStatus }) {
    const { Icon, iconClass, label } = deployStatusPresentation(status)
    return (
        <Badge variant="secondary" className="text-foreground">
            <Icon className={cn(iconClass, status === "IN_PROGRESS" && "animate-spin")} />
            {label}
        </Badge>
    )
}

export function deployStatusPresentation(status: ProjectDeployStatus): { Icon: typeof CheckCircle2; iconClass: string; label: string } {
    if (status === "SUCCEEDED") return { Icon: CheckCircle2, iconClass: "text-success", label: "Succeeded" }
    if (status === "FAILED") return { Icon: XCircle, iconClass: "text-danger", label: "Failed" }
    if (status === "IN_PROGRESS") return { Icon: Loader2, iconClass: "text-warning", label: "In progress" }
    return { Icon: RotateCcw, iconClass: "text-muted-foreground", label: "Rolled back" }
}

function LiveBadge() {
    return (
        <Badge variant="secondary" className="text-foreground">
            <span aria-hidden className="bg-success relative flex h-1.5 w-1.5 rounded-full">
                <span className="bg-success absolute inset-0 animate-ping rounded-full opacity-60" />
            </span>
            Live
        </Badge>
    )
}

export function DeploysEmpty() {
    return (
        <Empty className="mx-auto w-full max-w-lg border-solid border-border/60 bg-muted/10 p-6 md:p-8">
            <EmptyHeader className="max-w-lg">
                <EmptyMedia variant="icon">
                    <Rocket className="text-primary" />
                </EmptyMedia>
                <EmptyTitle className="text-base">No deployments yet</EmptyTitle>
                <EmptyDescription className="text-xs">
                    Run <code className="text-foreground bg-muted border-border/60 rounded-sm border px-1.5 py-0.5 font-mono text-[11.5px]">terse deploy</code> from your SDK project to publish your
                    first deployment and track it here.
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    )
}

export function DeploysSkeleton() {
    return (
        <div className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-lg border">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="ml-auto h-3 w-24" />
                </div>
            ))}
        </div>
    )
}

export function SecretsSection({ projectId }: { projectId: string }) {
    const { secrets, isLoading, deleteSecret } = useProjectSecrets(projectId)
    const [pendingDelete, setPendingDelete] = useState<ProjectSecretSummary | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const total = secrets?.length ?? 0

    const handleDelete = async () => {
        if (!pendingDelete) return
        setIsDeleting(true)
        try {
            await deleteSecret(pendingDelete.name)
            toast.success(`Deleted secret ${pendingDelete.name}`)
            setPendingDelete(null)
        } catch {
            toast.error("Failed to delete secret")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <section className="mt-8">
            <SectionLabel>Secrets{total > 0 ? ` · ${total}` : ""}</SectionLabel>

            {isLoading ? (
                <SecretsSkeleton />
            ) : !secrets || secrets.length === 0 ? (
                <SecretsEmpty />
            ) : (
                <ul className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-lg border">
                    {secrets.map(secret => (
                        <SecretRow key={secret.name} secret={secret} onDelete={() => setPendingDelete(secret)} />
                    ))}
                </ul>
            )}

            <Dialog open={!!pendingDelete} onOpenChange={open => !open && setPendingDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete secret</DialogTitle>
                        <DialogDescription>
                            This will permanently delete <span className="text-foreground font-semibold">{pendingDelete?.name}</span> from this managed project. Jobs that read this environment
                            variable will stop receiving it.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? "Deleting…" : "Delete secret"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    )
}

function SecretRow({ secret, onDelete }: { secret: ProjectSecretSummary; onDelete: () => void }) {
    const relative = formatTimestamp(secret.createdAt)
    const absolute = DateTime.fromISO(secret.createdAt).toFormat("LLL d, yyyy · h:mm:ss a")

    return (
        <li className="hover:bg-muted/30 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors sm:grid-cols-[minmax(160px,1fr)_160px_180px_auto]">
            <code className="text-foreground min-w-0 truncate font-mono text-[12px]">{secret.name}</code>

            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="text-muted-foreground hidden cursor-default text-xs tabular-nums sm:inline">{relative}</span>
                </TooltipTrigger>
                <TooltipContent>{absolute}</TooltipContent>
            </Tooltip>

            <div className="text-muted-foreground col-start-1 row-start-2 flex min-w-0 items-center gap-2 text-xs sm:col-start-auto sm:row-start-auto">
                {secret.createdBy ? (
                    <>
                        <Avatar className="size-5">
                            {secret.createdBy.avatarUrl ? <AvatarImage src={secret.createdBy.avatarUrl} alt="" /> : null}
                            <AvatarFallback className="text-[9px] font-medium">{initialsOf(secret.createdBy.displayName)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{secret.createdBy.displayName}</span>
                    </>
                ) : (
                    <span>Unknown creator</span>
                )}
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Open secret actions</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onClick={onDelete}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    )
}

function SecretsEmpty() {
    return (
        <Empty className="mx-auto w-full max-w-lg border-solid border-border/60 bg-muted/10 p-6 md:p-8">
            <EmptyHeader className="max-w-lg">
                <EmptyMedia variant="icon">
                    <KeyRound className="text-primary" />
                </EmptyMedia>
                <EmptyTitle className="text-base">No secrets yet</EmptyTitle>
                <EmptyDescription className="text-xs">
                    Run <code className="text-foreground bg-muted border-border/60 rounded-sm border px-1.5 py-0.5 font-mono text-[11.5px]">terse secrets add &lt;NAME&gt;</code> from your SDK project
                    to add one.
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    )
}

function SecretsSkeleton() {
    return (
        <div className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-lg border">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[minmax(160px,1fr)_160px_180px_auto]">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="hidden h-3 w-20 sm:block" />
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-8 w-8" />
                </div>
            ))}
        </div>
    )
}

export function DeleteProjectAction({ project }: { project: Pick<ProjectDetailResponse, "id" | "name" | "jobs"> }) {
    const navigate = useNavigate()
    const { deleteProject } = useProjectMutations()
    const [showDialog, setShowDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await deleteProject(project.id)
            toast.success(`Deleted project "${project.name}"`)
            navigate(FrontendRoutes.APP)
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status
            if (status === 409) {
                toast.error("Can't delete: project has in-flight runs. Wait for them to finish.")
            } else {
                toast.error("Failed to delete project")
            }
        } finally {
            setIsDeleting(false)
            setShowDialog(false)
        }
    }

    const jobCount = project.jobs.length

    return (
        <>
            <section className="mt-10">
                <h2 className="text-danger mb-3 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase">
                    <AlertTriangle className="h-3 w-3" />
                    Danger zone
                </h2>
                <div className="border-destructive/40 flex items-center gap-3 rounded-lg border p-4">
                    <div className="min-w-0 flex-1">
                        <div className="text-foreground text-sm font-medium">Delete this project</div>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                            Removes the project{jobCount > 0 ? `, its ${jobCount} job${jobCount === 1 ? "" : "s"},` : ""} and all associated run history. This cannot be undone.
                        </p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => setShowDialog(true)} className="shrink-0">
                        Delete project
                    </Button>
                </div>
            </section>

            <Dialog open={showDialog} onOpenChange={open => !open && setShowDialog(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete project</DialogTitle>
                        <DialogDescription>
                            This will permanently delete <span className="text-foreground font-semibold">{project.name}</span>
                            {project.jobs.length > 0 ? ` and all ${project.jobs.length} job${project.jobs.length === 1 ? "" : "s"} inside it` : ""}, along with run history and credentials. This cannot
                            be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? "Deleting…" : "Delete project"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
    return <h2 className={cn("text-muted-foreground mb-3 text-[10px] font-semibold tracking-[0.18em] uppercase", className)}>{children}</h2>
}

export function CenteredMessage({ text }: { text: string }) {
    return (
        <div className="flex h-full items-center justify-center">
            <div className="text-muted-foreground text-sm" role="status">
                {text}
            </div>
        </div>
    )
}

export function Dot() {
    return (
        <span aria-hidden className="text-muted-foreground/40">
            ·
        </span>
    )
}

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
