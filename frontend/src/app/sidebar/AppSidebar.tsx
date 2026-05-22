import { Link, useLocation } from "react-router-dom"

import type { LucideIcon } from "lucide-react"
import { Activity, BarChart3, Bell, BookOpen, CreditCard, ExternalLink, Home, KeyRound, Plug } from "lucide-react"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { Agent } from "terse-types/types"

import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { FeatureFlags, useFeatureFlag } from "@/hooks/useFeatureFlag"
import { useAgents } from "@/modules/agents/api/useAgents"
import { useAuth } from "@/modules/auth/context/AuthProvider"
import { usePendingApprovals } from "@/modules/notifications/api/usePendingApprovals"
import { useOrganizationProjects } from "@/modules/projects/api/useOrganizationProjects"

import { SdkJobsList } from "./SdkJobsList"
import { AppSidebarFooter } from "./SidebarFooter"
import { AppSidebarHeader } from "./SidebarHeader"

export function AppSidebar() {
    // TODO: This may need to be paginated at some point.
    const { agents, isLoading } = useAgents({ limit: 100 })
    const { projects: organizationProjects, isLoading: projectsLoading } = useOrganizationProjects()

    return (
        <Sidebar>
            <AppSidebarHeader />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <ApplicationNavigation sdkJobs={agents} organizationProjects={organizationProjects} loading={isLoading || projectsLoading} />
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel>Settings</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SettingsNavigation />
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <AppSidebarFooter />
        </Sidebar>
    )
}

interface ApplicationNavigationProps {
    sdkJobs: Agent[]
    organizationProjects: { id: string; name: string }[]
    loading: boolean
}

function PlainNavItem({ title, url, icon: Icon, iconColor }: NavItem) {
    const location = useLocation()
    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname === url}>
                <Link to={url}>
                    <Icon className={iconColor} />
                    <span>{title}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    )
}

function ApplicationNavigation({ sdkJobs, organizationProjects, loading }: ApplicationNavigationProps) {
    const showProjectsNav = sdkJobs.length > 0 || organizationProjects.length > 0 || loading

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton asChild>
                    <a href="https://docs.useterse.ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        <BookOpen className="text-primary" />
                        <span>Docs</span>
                        <ExternalLink className="ml-auto size-3 text-muted-foreground" />
                    </a>
                </SidebarMenuButton>
            </SidebarMenuItem>

            <PlainNavItem title="Home" url={FrontendRoutes.HOME} icon={Home} iconColor="text-primary" />

            {showProjectsNav && <SdkJobsList agents={sdkJobs} organizationProjects={organizationProjects} loading={loading} />}

            <PlainNavItem title="Activity" url={FrontendRoutes.ACTIVITY} icon={Activity} iconColor="text-primary" />
            <PlainNavItem title="Stats" url={FrontendRoutes.STATS} icon={BarChart3} iconColor="text-primary" />
        </SidebarMenu>
    )
}

function SettingsNavigation() {
    const location = useLocation()
    const { approvals } = usePendingApprovals({ status: "pending" })
    const pendingCount = approvals.length
    const showSdkInterface = useFeatureFlag(FeatureFlags.SDK_INTERFACE)
    const { user } = useAuth()
    const isAdmin = user?.roles.includes("admin")
    const showBilling = Boolean(isAdmin)

    const settingsItems: NavItem[] = [
        { title: "Integrations", url: FrontendRoutes.INTEGRATIONS, icon: Plug, iconColor: "text-primary" },
        { title: "Notifications", url: FrontendRoutes.NOTIFICATIONS, icon: Bell, iconColor: "text-primary" },
        ...(showBilling ? [{ title: "Billing", url: FrontendRoutes.BILLING, icon: CreditCard, iconColor: "text-primary" }] : []),
        ...(showSdkInterface ? [{ title: "API Tokens", url: FrontendRoutes.API_TOKENS, icon: KeyRound, iconColor: "text-primary" }] : [])
    ]

    return (
        <SidebarMenu>
            {settingsItems.map(item => (
                <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                        <Link to={item.url} className="relative">
                            {item.title === "Notifications" && pendingCount > 0 ? (
                                <>
                                    <item.icon className={item.iconColor} aria-hidden="true" />
                                    <span
                                        className="absolute top-1.5 left-5.5 flex size-2 items-center justify-center rounded-full bg-danger text-xs font-semibold leading-none text-white"
                                        aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                        {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}
                                    </span>
                                </>
                            ) : (
                                <item.icon className={item.iconColor} />
                            )}
                            <span>{item.title}</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    )
}

interface NavItem {
    title: string
    url: string
    icon: LucideIcon
    iconColor?: string
}
