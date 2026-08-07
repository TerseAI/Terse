import { Link } from "react-router-dom"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible"
import { ChevronRight } from "lucide-react"
import { FrontendRoutes, buildRoute } from "terse-types"
import { Agent } from "terse-types/types"

import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton, SidebarMenuSub } from "@/components/ui/sidebar"
import { useProjectDeploys } from "@/modules/projects/api/useProjectDeploys"

import { SdkJobListItem } from "./SdkJobListItem"
import { ProjectStatusOrnament } from "./SidebarStatusOrnaments"

const UNASSIGNED_PROJECT_KEY = "__unassigned__"

interface SdkJobsListProps {
    agents: Agent[]
    organizationProjects: { id: string; name: string }[]
    loading: boolean
}

export function SdkJobsList({ agents, organizationProjects, loading }: SdkJobsListProps) {
    if (loading) {
        return (
            <>
                <SidebarMenuItem>
                    <SidebarMenuSkeleton />
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuSkeleton />
                </SidebarMenuItem>
            </>
        )
    }

    const groups = buildProjectGroups(agents, organizationProjects)

    return (
        <>
            {groups.map(group => (
                <ProjectFolder key={group.projectId} projectId={group.projectId} name={group.projectName} agents={group.agents} />
            ))}
        </>
    )
}

interface ProjectFolderProps {
    projectId: string
    name: string
    agents: Agent[]
}

function ProjectFolder({ projectId, name, agents }: ProjectFolderProps) {
    const isUnassigned = projectId === UNASSIGNED_PROJECT_KEY
    const { deploys } = useProjectDeploys(isUnassigned ? null : projectId)
    const latestDeployStatus = deploys?.[0]?.status

    return (
        <Collapsible defaultOpen asChild>
            <SidebarMenuItem className="group/project">
                <SidebarMenuButton asChild className="cursor-pointer pr-1">
                    {isUnassigned ? (
                        <CollapsibleTrigger className="flex w-full items-center gap-2.5">
                            <ProjectStatusOrnament />
                            <span className="truncate">{name}</span>
                            <ChevronRight className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/project:rotate-90" />
                        </CollapsibleTrigger>
                    ) : (
                        <div className="flex w-full items-center gap-2.5">
                            <Link to={buildRoute(FrontendRoutes.PROJECTS.BY_ID, { id: projectId })} className="flex min-w-0 flex-1 items-center gap-2.5">
                                <ProjectStatusOrnament status={latestDeployStatus} />
                                <span className="truncate">{name}</span>
                            </Link>
                            <CollapsibleTrigger
                                aria-label={`Toggle ${name}`}
                                className="ml-auto flex size-5 shrink-0 items-center justify-center rounded hover:bg-sidebar-accent"
                                onClick={e => e.stopPropagation()}
                            >
                                <ChevronRight className="size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/project:rotate-90" />
                            </CollapsibleTrigger>
                        </div>
                    )}
                </SidebarMenuButton>
                <CollapsibleContent className="overflow-hidden">
                    <SidebarMenuSub>
                        {agents.map(agent => (
                            <SdkJobListItem key={agent.id} agent={agent} />
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    )
}

interface ProjectGroup {
    projectId: string
    projectName: string
    agents: Agent[]
}

function groupAgentsByProject(agents: Agent[]): ProjectGroup[] {
    const byProject = new Map<string, ProjectGroup>()

    for (const agent of agents) {
        const projectId = agent.metadata?.projectId ?? UNASSIGNED_PROJECT_KEY
        const projectName = agent.metadata?.projectName ?? "Unassigned"

        const existing = byProject.get(projectId)
        if (existing) {
            existing.agents.push(agent)
        } else {
            byProject.set(projectId, { projectId, projectName, agents: [agent] })
        }
    }

    return [...byProject.values()].sort(sortProjectGroups)
}

function sortProjectGroups(a: ProjectGroup, b: ProjectGroup): number {
    if (a.projectId === UNASSIGNED_PROJECT_KEY) return 1
    if (b.projectId === UNASSIGNED_PROJECT_KEY) return -1
    return a.projectName.localeCompare(b.projectName)
}

/** Merges SDK agents by project with org projects that may have zero jobs yet. */
function buildProjectGroups(agents: Agent[], organizationProjects: { id: string; name: string }[]): ProjectGroup[] {
    const fromAgents = groupAgentsByProject(agents)
    const map = new Map<string, ProjectGroup>()
    for (const g of fromAgents) {
        map.set(g.projectId, { ...g, agents: [...g.agents] })
    }
    for (const p of organizationProjects) {
        if (!map.has(p.id)) {
            map.set(p.id, { projectId: p.id, projectName: p.name, agents: [] })
        }
    }
    return [...map.values()].sort(sortProjectGroups)
}
