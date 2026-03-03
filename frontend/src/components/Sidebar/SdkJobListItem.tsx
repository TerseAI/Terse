import { Link, useLocation } from "react-router-dom"

import { Terminal } from "lucide-react"

import { SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"
import { FrontendRoutes } from "@/shared/FrontendRoutes"
import { Agent } from "@/shared/types"

interface SdkJobListItemProps {
    agent: Agent
}

export function SdkJobListItem({ agent }: SdkJobListItemProps) {
    const location = useLocation()
    const isActive = location.pathname === FrontendRoutes.AGENTS.DETAIL(agent.id)

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={isActive}>
                <Link to={FrontendRoutes.AGENTS.DETAIL(agent.id)} className="flex items-center gap-2">
                    <span className="size-2 rounded-full shrink-0 bg-green-500" />
                    <span className="truncate">{agent.name}</span>
                </Link>
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    )
}
