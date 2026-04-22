import { Link } from "react-router-dom"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible"
import { ChevronRight, Folder } from "lucide-react"
import { FrontendRoutes, buildRoute } from "terse-types"
import { Agent } from "terse-types/types"

import { SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"

import { SdkJobListItem } from "./SdkJobListItem"

const UNASSIGNED_PROJECT_KEY = "__unassigned__"

interface SdkJobsListProps {
    agents: Agent[]
    loading: boolean
}

export function SdkJobsList({ agents, loading }: SdkJobsListProps) {
    if (loading) {
        return (
            <SidebarMenuSub>
                <SidebarMenuSubItem>
                    <SidebarMenuSkeleton />
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <SidebarMenuSkeleton />
                </SidebarMenuSubItem>
            </SidebarMenuSub>
        )
    }

    const groups = groupAgentsByProject(agents)

    return (
        <SidebarMenuSub>
            {groups.map(group => (
                <ProjectFolder key={group.projectId} projectId={group.projectId} name={group.projectName} agents={group.agents} />
            ))}
        </SidebarMenuSub>
    )
}

interface ProjectFolderProps {
    projectId: string
    name: string
    agents: Agent[]
}

function ProjectFolder({ projectId, name, agents }: ProjectFolderProps) {
    const isUnassigned = projectId === UNASSIGNED_PROJECT_KEY

    return (
        <Collapsible defaultOpen asChild>
            <SidebarMenuSubItem className="group/project">
                <SidebarMenuSubButton asChild className="cursor-pointer pr-1">
                    {isUnassigned ? (
                        <CollapsibleTrigger className="flex w-full items-center gap-2">
                            <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{name}</span>
                            <ChevronRight className="ml-auto size-3.5 transition-transform duration-200 group-data-[state=open]/project:rotate-90" />
                        </CollapsibleTrigger>
                    ) : (
                        <div className="flex w-full items-center gap-2">
                            <Link to={buildRoute(FrontendRoutes.PROJECTS.BY_ID, { id: projectId })} className="flex min-w-0 flex-1 items-center gap-2">
                                <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{name}</span>
                            </Link>
                            <CollapsibleTrigger
                                aria-label={`Toggle ${name}`}
                                className="ml-auto flex size-5 items-center justify-center rounded hover:bg-sidebar-accent"
                                onClick={e => e.stopPropagation()}
                            >
                                <ChevronRight className="size-3.5 transition-transform duration-200 group-data-[state=open]/project:rotate-90" />
                            </CollapsibleTrigger>
                        </div>
                    )}
                </SidebarMenuSubButton>
                <CollapsibleContent className="overflow-hidden">
                    <SidebarMenuSub>
                        {agents.map(agent => (
                            <SdkJobListItem key={agent.id} agent={agent} />
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuSubItem>
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

    return [...byProject.values()].sort((a, b) => {
        if (a.projectId === UNASSIGNED_PROJECT_KEY) return 1
        if (b.projectId === UNASSIGNED_PROJECT_KEY) return -1
        return a.projectName.localeCompare(b.projectName)
    })
}
