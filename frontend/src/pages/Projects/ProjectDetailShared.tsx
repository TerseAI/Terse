import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { AlertTriangle, ArrowRight, CheckCircle2, CircleDot, Loader2, RotateCcw, XCircle } from "lucide-react"
import { DateTime } from "luxon"
import { toast } from "sonner"
import { FrontendRoutes, buildRoute } from "terse-types"
import type { ProjectDeploy, ProjectDeployStatus, ProjectDetailResponse } from "terse-types/types"

import BreadCrumb from "../../components/BreadCrumb"
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { SidebarTrigger } from "../../components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { useProjectMutations } from "../../hooks/api/useProject"
import { cn } from "../../lib/utils"
import { formatTimestamp } from "../../utility/timeUtils"

export const DEPLOYS_PREVIEW_LIMIT = 5

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
    project: Pick<ProjectDetailResponse, "name" | "isSelfHosted" | "createdAt">
    activeDeploy: ProjectDeploy | null
    latestDeploy: ProjectDeploy | null
}) {
    const createdLabel = DateTime.fromISO(project.createdAt).toFormat("LLL d, yyyy")
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
                {isDeploying ? <DeployingBadge /> : null}
                {activeDeploy ? (
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
                ) : !isDeploying ? (
                    <Badge variant="secondary" className="text-foreground">
                        <CircleDot className="text-muted-foreground" />
                        No active deploy
                    </Badge>
                ) : null}
                <Dot />
                <span>Created {createdLabel}</span>
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

    return (
        <li className="hover:bg-muted/30 grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors sm:grid-cols-[140px_auto_1fr_auto]">
            <DeployStatusBadge status={deploy.status} />

            <div className="flex min-w-0 items-center gap-2">
                <code className="text-muted-foreground font-mono text-[12px] tabular-nums">{shortId}</code>
                {deploy.isActive ? <LiveBadge /> : null}
            </div>

            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="text-muted-foreground cursor-default text-xs tabular-nums">{relative}</span>
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
        </li>
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
    if (status === "FAILED") return { Icon: XCircle, iconClass: "text-destructive", label: "Failed" }
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
        <div className="border-border/60 bg-muted/10 rounded-lg border px-6 py-8 text-center">
            <p className="text-foreground text-sm">No deployments yet.</p>
            <p className="text-muted-foreground mt-1 text-xs">
                Run <code className="text-foreground bg-muted border-border/60 rounded-sm border px-1.5 py-0.5 font-mono text-[11.5px]">terse deploy</code> from your SDK project to ship your first
                agent.
            </p>
        </div>
    )
}

export function DeploysSkeleton() {
    return (
        <div className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-lg border">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <div className="bg-muted/60 h-5 w-20 animate-pulse rounded-full" />
                    <div className="bg-muted/60 h-3 w-20 animate-pulse rounded-sm" />
                    <div className="bg-muted/40 ml-auto h-3 w-24 animate-pulse rounded-sm" />
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
                <h2 className="text-destructive mb-3 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase">
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
