import { Link, useLocation, useNavigate } from "react-router-dom"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible"
import type { LucideIcon } from "lucide-react"
import { Activity, BarChart3, Bell, ChevronRight, Home, Plug, Plus, Terminal, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { FrontendRoutes } from "@/shared/FrontendRoutes"
import { Agent } from "@/shared/types"

import { SdkJobsList } from "./SdkJobsList"
import { AppSidebarFooter } from "./SidebarFooter"
import { AppSidebarHeader } from "./SidebarHeader"

export function AppSidebar() {
    const { agents, isLoading } = useAgents({ limit: 100 })
    const navigate = useNavigate()

    const webUiAgents = agents.filter(a => a.source !== "SDK")
    const sdkJobs = agents.filter(a => a.source === "SDK")

    return (
        <Sidebar>
            <AppSidebarHeader />
            <SidebarContent>
                <div className="px-3 py-4">
                    <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}>
                        <Plus className="size-4" />
                        Add Agent
                    </Button>
                </div>
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <ApplicationNavigation agents={webUiAgents} sdkJobs={sdkJobs} loading={isLoading} />
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
    agents: Agent[]
    sdkJobs: Agent[]
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

function ApplicationNavigation({ agents, sdkJobs, loading }: ApplicationNavigationProps) {
    return (
        <SidebarMenu>
            <PlainNavItem title="Home" url={FrontendRoutes.APP} icon={Home} iconColor="text-primary" />

            <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton>
                            <Zap className="text-primary" />
                            <span>Agents</span>
                            <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <AgentsList agents={agents} loading={loading} />
                    </CollapsibleContent>
                </SidebarMenuItem>
            </Collapsible>

            {(sdkJobs.length > 0 || loading) && (
                <Collapsible defaultOpen asChild>
                    <SidebarMenuItem className="group/collapsible">
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton className="cursor-pointer">
                                <Terminal className="text-primary" />
                                <span>SDK Jobs</span>
                                <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="overflow-hidden">
                            <SdkJobsList agents={sdkJobs} loading={loading} />
                        </CollapsibleContent>
                    </SidebarMenuItem>
                </Collapsible>
            )}

            <PlainNavItem title="Activity" url={FrontendRoutes.ACTIVITY} icon={Activity} iconColor="text-primary" />
            <PlainNavItem title="Stats" url={FrontendRoutes.STATS} icon={BarChart3} iconColor="text-primary" />
        </SidebarMenu>
    )
}

function SettingsNavigation() {
    const location = useLocation()

    return (
        <SidebarMenu>
            {SettingsItems.map(item => (
                <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                        <Link to={item.url}>
                            <item.icon className={item.iconColor} />
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
    const navigate = useNavigate()

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
            <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}>
                        <Plus className="size-3 !text-muted-foreground hover:!text-foreground" color="currentColor" />
                        Add Agent
                    </Button>
                </SidebarMenuSubButton>
            </SidebarMenuSubItem>
        </SidebarMenuSub>
    )
}

interface AgentListItemProps {
    agent: Agent
}

function AgentListItem({ agent }: AgentListItemProps) {
    const location = useLocation()
    const isActive = location.pathname === FrontendRoutes.AGENTS.DETAIL(agent.id)

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={isActive}>
                <Link to={FrontendRoutes.AGENTS.DETAIL(agent.id)} className="flex items-center gap-2">
                    <span className={`size-2 rounded-full shrink-0 ${agent.isActive ? "bg-green-500" : "bg-muted-foreground"}`} />
                    <span className="truncate">{agent.name}</span>
                </Link>
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    )
}

export default Sidebar

interface NavItem {
    title: string
    url: string
    icon: LucideIcon
    iconColor?: string
}

const SettingsItems: NavItem[] = [
    {
        title: "Integrations",
        url: FrontendRoutes.INTEGRATIONS,
        icon: Plug,
        iconColor: "text-primary"
    },
    {
        title: "Notifications",
        url: FrontendRoutes.NOTIFICATIONS,
        icon: Bell,
        iconColor: "text-primary"
    }
]
