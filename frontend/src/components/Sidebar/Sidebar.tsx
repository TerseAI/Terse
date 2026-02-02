import { Button } from "@/components/ui/button";
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
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useAgents } from "@/hooks/api/useAgents";
import { FrontendRoutes } from "@/shared/FrontendRoutes";
import { Agent } from "@/shared/types";
import type { LucideIcon } from "lucide-react";
import { Bell, Home, Plug, Plus, Zap } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppSidebarFooter } from "./SidebarFooter";
import { AppSidebarHeader } from "./SidebarHeader";

export function AppSidebar() {
    const { agents, isLoading } = useAgents({ limit: 100 });
    const navigate = useNavigate();

    return (
        <Sidebar>
            <AppSidebarHeader />
            <SidebarContent>
                <div className="px-3 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}
                    >
                        <Plus className="size-4" />
                        Add Agent
                    </Button>
                </div>
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <ApplicationNavigation agents={agents} loading={isLoading} />
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
    agents: Agent[];
    loading: boolean;
}

function ApplicationNavigation({ agents, loading }: ApplicationNavigationProps) {
    const location = useLocation();
    const applicationItems = DefaultApplicationItems;

    return (
        <SidebarMenu>
            {applicationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                        <Link to={item.url}>
                            <item.icon className={item.iconColor} />
                            <span>{item.title}</span>
                        </Link>
                    </SidebarMenuButton>
                    {item.title === "Agents" && (
                        <AgentsList agents={agents} loading={loading} />
                    )}
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    )
}

function SettingsNavigation() {
    const location = useLocation();

    return (
        <SidebarMenu>
            {SettingsItems.map((item) => (
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
    agents: Agent[];
    loading: boolean;
}
function AgentsList({ agents, loading }: AgentsListProps) {
    const navigate = useNavigate();

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
            {agents.map((agent) => (
                <AgentListItem key={agent.id} agent={agent} />
            ))}
            <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-muted-foreground"
                        onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}
                    >
                        <Plus className="size-3 !text-muted-foreground hover:!text-foreground" color="currentColor" />
                        Add Agent
                    </Button>
                </SidebarMenuSubButton>
            </SidebarMenuSubItem>
        </SidebarMenuSub>
    )
}

interface AgentListItemProps {
    agent: Agent;
}

function AgentListItem({ agent }: AgentListItemProps) {
    const location = useLocation();
    const isActive = location.pathname === FrontendRoutes.AGENTS.DETAIL(agent.id);

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={isActive}>
                <Link to={FrontendRoutes.AGENTS.DETAIL(agent.id)}>
                    <span>{agent.name}</span>
                </Link>
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    )
}

export default Sidebar;

interface NavItem {
    title: string;
    url: string;
    icon: LucideIcon;
    iconColor?: string;
}

const DefaultApplicationItems: NavItem[] = [
    {
        title: "Home",
        url: FrontendRoutes.APP,
        icon: Home,
        iconColor: "text-primary",
    },
    {
        title: "Agents",
        url: FrontendRoutes.AGENTS.LIST,
        icon: Zap,
        iconColor: "text-primary",
    }
]

const SettingsItems: NavItem[] = [
    {
        title: "Integrations",
        url: FrontendRoutes.INTEGRATIONS,
        icon: Plug,
        iconColor: "text-primary",
    },
    {
        title: "Notifications",
        url: FrontendRoutes.NOTIFICATIONS,
        icon: Bell,
        iconColor: "text-primary",
    }
]