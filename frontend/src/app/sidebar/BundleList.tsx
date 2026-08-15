import { Link, useLocation } from "react-router-dom"

import { FrontendRoutes, buildRoute } from "terse-types"
import { Agent } from "terse-types/types"

import { SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton } from "@/components/ui/sidebar"
import { useProjectDeploys } from "@/modules/projects/api/useProjectDeploys"

import { ProjectStatusOrnament } from "./SidebarStatusOrnaments"

interface BundleListProps {
    agents: Agent[]
    organizationProjects: { id: string; name: string }[]
    loading: boolean
}

export function BundleList({ agents, organizationProjects, loading }: BundleListProps) {
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

    const bundles = buildBundles(agents, organizationProjects)

    return (
        <SidebarMenu>
            {bundles.map(bundle => (
                <BundleRow key={bundle.id} id={bundle.id} name={bundle.name} jobCount={bundle.jobCount} />
            ))}
        </SidebarMenu>
    )
}

interface BundleRowProps {
    id: string
    name: string
    jobCount: number
}

function BundleRow({ id, name, jobCount }: BundleRowProps) {
    const location = useLocation()
    const { deploys } = useProjectDeploys(id)
    const url = buildRoute(FrontendRoutes.PROJECTS.BY_ID, { id })

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname === url}>
                <Link to={url} className="flex items-center gap-2.5">
                    <ProjectStatusOrnament status={deploys?.[0]?.status} />
                    <span className="truncate">{name}</span>
                    <SidebarMenuBadge className="bg-transparent text-sidebar-foreground/50" aria-hidden="true">
                        {jobCount}
                    </SidebarMenuBadge>
                    <span className="sr-only">
                        {jobCount} job{jobCount === 1 ? "" : "s"}
                    </span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    )
}

interface Bundle {
    id: string
    name: string
    jobCount: number
}

/** Merges org projects with the projects only known through job metadata. Jobs with no bundle stay off the sidebar; Home lists them. */
function buildBundles(agents: Agent[], organizationProjects: { id: string; name: string }[]): Bundle[] {
    const byId = new Map<string, Bundle>()

    for (const project of organizationProjects) {
        byId.set(project.id, { id: project.id, name: project.name, jobCount: 0 })
    }

    for (const agent of agents) {
        const projectId = agent.metadata?.projectId
        if (!projectId) continue

        const existing = byId.get(projectId)
        if (existing) {
            existing.jobCount += 1
        } else {
            byId.set(projectId, { id: projectId, name: agent.metadata?.projectName ?? projectId, jobCount: 1 })
        }
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}
