import { Agent } from "terse-types/types"

import { SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubItem } from "@/components/ui/sidebar"

import { SdkJobListItem } from "./SdkJobListItem"

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

    return (
        <SidebarMenuSub>
            {agents.map(agent => (
                <SdkJobListItem key={agent.id} agent={agent} />
            ))}
        </SidebarMenuSub>
    )
}
