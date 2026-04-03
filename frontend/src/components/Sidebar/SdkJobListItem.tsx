import { Link, useLocation } from "react-router-dom"

import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { Agent } from "terse-types/types"

import { SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"

interface SdkJobListItemProps {
    agent: Agent
}

export function SdkJobListItem({ agent }: SdkJobListItemProps) {
    const location = useLocation()
    const isActive = location.pathname === buildRoute(FrontendRoutes.AGENTS.BY_ID, { agentId: agent.id })

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={isActive}>
                <Link to={buildRoute(FrontendRoutes.AGENTS.BY_ID, { agentId: agent.id })} className="flex items-center gap-2">
                    <span className={`size-2 rounded-full shrink-0 ${agent.isActive ? "bg-success" : "bg-muted-foreground"}`} />
                    <span className="truncate">{agent.name}</span>
                </Link>
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    )
}
