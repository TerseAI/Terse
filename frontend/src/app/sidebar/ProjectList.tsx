import { useState } from "react"
import { Link, useLocation } from "react-router-dom"

import { ChevronRight } from "lucide-react"
import { FrontendRoutes, buildRoute } from "terse-types"
import { Agent } from "terse-types/types"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { useProjectDeploys } from "@/modules/projects/api/useProjectDeploys"

import { ProjectStatusOrnament } from "./SidebarStatusOrnaments"

interface ProjectListProps {
    agents: Agent[]
    organizationProjects: { id: string; name: string }[]
    loading: boolean
}

export function ProjectList({ agents, organizationProjects, loading }: ProjectListProps) {
    if (loading) {
        return (
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuSkeleton />
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuSkeleton />
                </SidebarMenuItem>
            </SidebarMenu>
        )
    }

    return (
        <SidebarMenu>
            {buildProjects(agents, organizationProjects).map(project => (
                <ProjectRow key={project.id} project={project} />
            ))}
        </SidebarMenu>
    )
}

function ProjectRow({ project }: { project: SidebarProject }) {
    const location = useLocation()
    const { deploys } = useProjectDeploys(project.id)
    const url = buildRoute(FrontendRoutes.PROJECTS.BY_ID, { id: project.id })
    const holdsOpenRoute = project.jobs.some(job => location.pathname === buildRoute(FrontendRoutes.JOBS.BY_ID, { id: job.id }))
    // Until the row is toggled by hand, the active job decides which project stands open.
    const [toggledOpen, setToggledOpen] = useState<boolean | null>(null)
    const open = toggledOpen ?? holdsOpenRoute

    return (
        <Collapsible asChild open={open} onOpenChange={setToggledOpen}>
            <SidebarMenuItem>
                <div className="relative">
                    <SidebarMenuButton asChild isActive={location.pathname === url}>
                        <Link to={url} className="flex items-center gap-2.5 pr-10">
                            <ProjectStatusOrnament status={deploys?.[0]?.status} />
                            <span className="truncate">{project.name}</span>
                            <SidebarMenuBadge className="bg-transparent text-sidebar-foreground/50" aria-hidden="true">
                                {project.jobs.length}
                            </SidebarMenuBadge>
                            <span className="sr-only">
                                {project.jobs.length} job{project.jobs.length === 1 ? "" : "s"}
                            </span>
                        </Link>
                    </SidebarMenuButton>

                    <CollapsibleTrigger asChild>
                        <SidebarMenuAction aria-label={`${open ? "Hide" : "Show"} jobs in ${project.name}`}>
                            <ChevronRight className={cn("transition-transform duration-200", open && "rotate-90")} />
                        </SidebarMenuAction>
                    </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                    <SidebarMenuSub className="mt-1">
                        {project.jobs.length === 0 ? (
                            <SidebarMenuSubItem>
                                <span className="flex h-8 items-center px-2.5 text-xs text-sidebar-foreground/50">No jobs yet</span>
                            </SidebarMenuSubItem>
                        ) : (
                            project.jobs.map(job => <JobRow key={job.id} job={job} />)
                        )}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    )
}

function JobRow({ job }: { job: Agent }) {
    const location = useLocation()
    const url = buildRoute(FrontendRoutes.JOBS.BY_ID, { id: job.id })

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={location.pathname === url}>
                <Link to={url} title={job.name} className="flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", job.isActive ? "bg-success" : "bg-muted-foreground")} />
                    <span className="truncate">{job.name}</span>
                </Link>
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    )
}

interface SidebarProject {
    id: string
    name: string
    jobs: Agent[]
}

/** Merges org projects with the projects only known through job metadata. Jobs with no project stay off the sidebar; Home lists them. */
function buildProjects(agents: Agent[], organizationProjects: { id: string; name: string }[]): SidebarProject[] {
    const byId = new Map<string, SidebarProject>()

    for (const project of organizationProjects) {
        byId.set(project.id, { id: project.id, name: project.name, jobs: [] })
    }

    for (const agent of agents) {
        const projectId = agent.metadata?.projectId
        if (!projectId) continue

        const existing = byId.get(projectId)
        if (existing) {
            existing.jobs.push(agent)
        } else {
            byId.set(projectId, { id: projectId, name: agent.metadata?.projectName ?? projectId, jobs: [agent] })
        }
    }

    for (const project of byId.values()) {
        project.jobs.sort((a, b) => a.name.localeCompare(b.name))
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}
