import { Link, useLocation } from "react-router-dom"

import { FrontendRoutes, buildRoute } from "terse-types"
import { Agent } from "terse-types/types"

import { SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton } from "@/components/ui/sidebar"
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
    const onJobInProject = project.jobs.some(job => location.pathname === buildRoute(FrontendRoutes.JOBS.BY_ID, { id: job.id }))

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname === url || onJobInProject}>
                <Link to={url} className="flex items-center gap-2.5">
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
        </SidebarMenuItem>
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
