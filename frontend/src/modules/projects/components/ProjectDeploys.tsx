import { useState } from "react"
import { Link, useParams } from "react-router-dom"

import { ArrowLeft, Search } from "lucide-react"
import { FrontendRoutes, buildRoute } from "terse-types"
import type { ProjectDeploy, ProjectDeployStatus } from "terse-types/types"

import { FetchErrorCard } from "@/components/FetchErrorCard"
import { PageFrame } from "@/components/PageFrame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useProject } from "@/modules/projects/api/useProject"
import { useProjectDeploys } from "@/modules/projects/api/useProjectDeploys"

import { CenteredMessage, DeploysEmpty, DeploysSkeleton, DeploysTable, SectionLabel, deployStatusPresentation } from "./ProjectDetailShared"

type DeploySortKey = "newest" | "oldest" | "status"
type DeployStatusFilter = "ALL" | ProjectDeployStatus

export default function ProjectDeploysPage() {
    const { id } = useParams<{ id: string }>()

    if (!id) {
        return <CenteredMessage text="Invalid project ID" />
    }

    return <ProjectDeploysPageInner projectId={id} />
}

function ProjectDeploysPageInner({ projectId }: { projectId: string }) {
    const { project, isLoading: isLoadingProject, isError: isProjectError } = useProject(projectId)
    const { deploys, isLoading: isLoadingDeploys, isError: isDeploysError, mutate: retryDeploys } = useProjectDeploys(projectId)

    const [query, setQuery] = useState("")
    const [sort, setSort] = useState<DeploySortKey>("newest")
    const [statusFilter, setStatusFilter] = useState<DeployStatusFilter>("ALL")

    const projectHref = buildRoute(FrontendRoutes.PROJECTS.BY_ID, { id: projectId })

    if (isProjectError) {
        return <CenteredMessage text="Project not found" />
    }

    const allDeploys = deploys ?? []
    const filtered = filterAndSortDeploys(allDeploys, query, statusFilter, sort)
    const hasActiveFilters = query.trim().length > 0 || statusFilter !== "ALL"

    return (
        <TooltipProvider delayDuration={200}>
            <PageFrame>
                <header>
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2 mb-2 h-7 px-2">
                        <Link to={projectHref}>
                            <ArrowLeft className="h-3.5 w-3.5" />
                            {isLoadingProject ? "Project" : (project?.name ?? "Project")}
                        </Link>
                    </Button>
                    <h1 className="text-foreground text-[clamp(1.5rem,2vw,1.75rem)] leading-tight font-semibold tracking-tight">Deployments</h1>
                </header>

                <section className="mt-6">
                    <div className="mb-3 flex items-baseline justify-between gap-4">
                        <SectionLabel className="mb-0">All deployments</SectionLabel>
                        <span className="text-muted-foreground text-[11px] tabular-nums">
                            {isLoadingDeploys ? "Loading…" : hasActiveFilters ? `${filtered.length} of ${allDeploys.length}` : `${allDeploys.length} total`}
                        </span>
                    </div>

                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                            <Input
                                type="search"
                                aria-label="Search deployments"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search by id, deployer, or status…"
                                className="h-9 pl-8"
                                disabled={isLoadingDeploys}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as DeployStatusFilter)} disabled={isLoadingDeploys}>
                            <SelectTrigger size="sm" className="sm:w-[170px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All statuses</SelectItem>
                                <SelectItem value="SUCCEEDED">Succeeded</SelectItem>
                                <SelectItem value="FAILED">Failed</SelectItem>
                                <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                                <SelectItem value="ROLLED_BACK">Rolled back</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sort} onValueChange={v => setSort(v as DeploySortKey)} disabled={isLoadingDeploys}>
                            <SelectTrigger size="sm" className="sm:w-[160px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest first</SelectItem>
                                <SelectItem value="oldest">Oldest first</SelectItem>
                                <SelectItem value="status">By status</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {isLoadingDeploys ? (
                        <DeploysSkeleton />
                    ) : isDeploysError && !deploys ? (
                        <FetchErrorCard message="Couldn't load deployments." onRetry={() => void retryDeploys()} />
                    ) : allDeploys.length === 0 ? (
                        <DeploysEmpty />
                    ) : filtered.length === 0 ? (
                        <div className="border-border/60 bg-muted/10 rounded-lg border px-6 py-10 text-center">
                            <p className="text-foreground text-sm">No deployments match your filters.</p>
                            <p className="text-muted-foreground mt-1 text-xs">Try a different search or clear the status filter.</p>
                            {hasActiveFilters ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3"
                                    onClick={() => {
                                        setQuery("")
                                        setStatusFilter("ALL")
                                    }}
                                >
                                    Clear filters
                                </Button>
                            ) : null}
                        </div>
                    ) : (
                        <DeploysTable deploys={filtered} />
                    )}
                </section>
            </PageFrame>
        </TooltipProvider>
    )
}

function filterAndSortDeploys(deploys: ProjectDeploy[], query: string, statusFilter: DeployStatusFilter, sort: DeploySortKey): ProjectDeploy[] {
    const q = query.trim().toLowerCase()
    let list = deploys
    if (statusFilter !== "ALL") {
        list = list.filter(d => d.status === statusFilter)
    }
    if (q.length > 0) {
        list = list.filter(d => {
            const idMatch = d.id.toLowerCase().includes(q)
            const nameMatch = d.deployedBy?.displayName.toLowerCase().includes(q) ?? false
            const emailMatch = d.deployedBy?.email?.toLowerCase().includes(q) ?? false
            const statusMatch = deployStatusPresentation(d.status).label.toLowerCase().includes(q)
            return idMatch || nameMatch || emailMatch || statusMatch
        })
    }
    const sorted = [...list]
    if (sort === "newest") {
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    } else if (sort === "oldest") {
        sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    } else {
        sorted.sort((a, b) => {
            const cmp = a.status.localeCompare(b.status)
            return cmp !== 0 ? cmp : b.createdAt.localeCompare(a.createdAt)
        })
    }
    return sorted
}
