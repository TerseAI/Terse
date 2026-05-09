import { Link, useLocation } from "react-router-dom"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible"
import type { LucideIcon } from "lucide-react"
import { Activity, BarChart3, Bell, BookOpen, ChevronRight, CreditCard, ExternalLink, Home, KeyRound, Plug, Zap } from "lucide-react"
import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { Agent } from "terse-types/types"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem
} from "@/components/ui/sidebar"
import { useAgents } from "@/hooks/api/useAgents"
import { useOrganizationProjects } from "@/hooks/api/useOrganizationProjects"
import { usePendingApprovals } from "@/hooks/api/usePendingApprovals"
import { FeatureFlags, useFeatureFlag } from "@/hooks/useFeatureFlag"
import { useAuth } from "@/services/auth"

import { SdkJobsList } from "./SdkJobsList"
import { AppSidebarFooter } from "./SidebarFooter"
import { AppSidebarHeader } from "./SidebarHeader"

export function AppSidebar() {
    // TODO: This may need to be paginated at some point.
    const { agents, isLoading } = useAgents({ limit: 100 })
    const { projects: organizationProjects, isLoading: projectsLoading } = useOrganizationProjects()

    const webUiAgents = agents.filter(a => a.source !== "SDK")
    const sdkJobs = agents.filter(a => a.source === "SDK")

    return (
        <Sidebar>
            <AppSidebarHeader />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <ApplicationNavigation sdkJobs={sdkJobs} organizationProjects={organizationProjects} loading={isLoading || projectsLoading} />
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel>Settings</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SettingsNavigation />
                    </SidebarGroupContent>
                </SidebarGroup>

                {webUiAgents.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Deprecated</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <DeprecatedAgentsNavigation agents={webUiAgents} loading={isLoading} />
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
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

interface DeprecatedAgentsNavigationProps {
    agents: Agent[]
    loading: boolean
}

function DeprecatedAgentsNavigation({ agents, loading }: DeprecatedAgentsNavigationProps) {
    return (
        <SidebarMenu>
            <Collapsible className="group/collapsible">
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton>
                            <Zap className="text-muted-foreground" />
                            <span className="text-muted-foreground">Agents</span>
                            <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <AgentsList agents={agents} loading={loading} />
                    </CollapsibleContent>
                </SidebarMenuItem>
            </Collapsible>
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

interface AgentsListProps {
    agents: Agent[]
    loading: boolean
}
function AgentsList({ agents, loading }: AgentsListProps) {
    if (loading) {
        return (
            <SidebarMenuSub>
                <SidebarMenuSubItem>
                    <SidebarMenuSkeleton />
                </SidebarMenuSubItem>
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
                <AgentListItem key={agent.id} agent={agent} />
            ))}
        </SidebarMenuSub>
    )
}

interface AgentListItemProps {
    agent: Agent
}

function AgentListItem({ agent }: AgentListItemProps) {
    const location = useLocation()
    const isActive = location.pathname === buildRoute(FrontendRoutes.AGENTS.BY_ID, { id: agent.id })

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={isActive}>
                <Link to={buildRoute(FrontendRoutes.AGENTS.BY_ID, { id: agent.id })} className="flex items-center gap-2">
                    <span className={`size-2 rounded-full shrink-0 ${agent.isActive ? "bg-success" : "bg-muted-foreground"}`} />
                    <span className="truncate">{agent.name}</span>
                </Link>
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    )
}

interface NavItem {
    title: string
    url: string
    icon: LucideIcon
    iconColor?: string
}
