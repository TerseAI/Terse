import { Link, useLocation } from "react-router-dom"

import type { LucideIcon } from "lucide-react"
import { Activity, Home, Inbox } from "lucide-react"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useAgents } from "@/modules/agents/api/useAgents"
import { usePendingApprovals } from "@/modules/notifications/api/usePendingApprovals"
import { useOrganizationProjects } from "@/modules/projects/api/useOrganizationProjects"

import { ProjectList } from "./ProjectList"
import { AppSidebarFooter } from "./SidebarFooter"
import { AppSidebarHeader } from "./SidebarHeader"

export function AppSidebar() {
    // TODO: This may need to be paginated at some point.
    const { agents, isLoading } = useAgents({ limit: 100 })
    const { projects: organizationProjects, isLoading: projectsLoading } = useOrganizationProjects()

    const loading = isLoading || projectsLoading
    const showProjects = loading || agents.length > 0 || organizationProjects.length > 0

    return (
        <Sidebar>
            <AppSidebarHeader />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <WorkspaceNavigation />
                    </SidebarGroupContent>
                </SidebarGroup>

                {showProjects && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Projects</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <ProjectList agents={agents} organizationProjects={organizationProjects} loading={loading} />
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>
            <AppSidebarFooter />
        </Sidebar>
    )
}

function WorkspaceNavigation() {
    const { approvals } = usePendingApprovals({ status: "pending" })
    const pendingCount = approvals.length

    return (
        <SidebarMenu>
            <NavItem title="Home" url={FrontendRoutes.HOME} icon={Home} />
            <NavItem title="Activity" url={FrontendRoutes.ACTIVITY} icon={Activity} />
            <NavItem title="Inbox" url={FrontendRoutes.NOTIFICATIONS} icon={Inbox} badge={pendingCount} badgeLabel={`${pendingCount} pending approval${pendingCount === 1 ? "" : "s"}`} />
        </SidebarMenu>
    )
}

interface NavItemProps {
    title: string
    url: string
    icon: LucideIcon
    badge?: number
    badgeLabel?: string
}

function NavItem({ title, url, icon: Icon, badge = 0, badgeLabel }: NavItemProps) {
    const location = useLocation()

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname === url}>
                <Link to={url}>
                    <Icon className="text-primary" />
                    <span>{title}</span>
                    {badge > 0 && (
                        <>
                            <SidebarMenuBadge className="bg-danger text-white" aria-hidden="true">
                                {badge > 99 ? "99+" : badge}
                            </SidebarMenuBadge>
                            <span className="sr-only">{badgeLabel}</span>
                        </>
                    )}
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    )
}
