import { ChevronUp, Home, MoreHorizontal, Plug, User2, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Link, useLocation, useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useAuth } from "@/services/auth";
import { useEffect, useState } from "react";
import { BackendProvider } from "@/services/backend";
import { Automation } from "@/shared/types";
import { useTheme } from "../theme-provider";
import { AppSidebarHeader } from "./SidebarHeader";

interface NavItem {
    title: string;
    url: string;
    icon: LucideIcon;
}

const ApplicationItems: NavItem[] = [
    {
        title: "Home",
        url: "/app",
        icon: Home,
    },
    {
        title: "Automations",
        url: "/app/automations",
        icon: Zap,
    }
]

const SettingsItems: NavItem[] = [
    {
        title: "Integrations",
        url: "/app/integrations",
        icon: Plug,
    },
]

export function AppSidebar() {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAutomations = async () => {
            try {
                setLoading(true);
                const response = await BackendProvider.getUserAutomations();
                setAutomations(response.automations);
            } catch (error) {
                console.error('Failed to load automations:', error);
            } finally {
                setLoading(false);
            }
        };

        loadAutomations();
    }, []);

    return (
        <Sidebar>
            <AppSidebarHeader />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <ApplicationNavigation automations={automations} loading={loading} />
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
    automations: Automation[];
    loading: boolean;
}

function ApplicationNavigation({ automations, loading }: ApplicationNavigationProps) {
    const location = useLocation();

    return (
        <SidebarMenu>
            {ApplicationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={location.pathname === item.url}>
                        <Link to={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                        </Link>
                    </SidebarMenuButton>
                    {item.title === "Automations" &&
                        <AutomationDropdownMenu />
                    }
                    {item.title === "Automations" && (
                        <AutomationsList automations={automations} loading={loading} />
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
                <SidebarMenuItem>
                    <SidebarMenuButton asChild data-active={location.pathname === item.url}>
                        <Link to={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    )
}

interface AutomationsListProps {
    automations: Automation[];
    loading: boolean;
}
function AutomationsList({ automations, loading }: AutomationsListProps) {
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
        <>
            {automations.map((automation) => (
                <AutomationListItem key={automation.id} automation={automation} />
            ))}
        </>
    )
}

function AutomationDropdownMenu() {
    const navigate = useNavigate();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuAction>
                    <MoreHorizontal />
                </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
                <DropdownMenuItem>
                    <span onClick={() => navigate('/app/automations/new')}>New Automation</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function AppSidebarFooter() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { setTheme, theme } = useTheme()

    const handleLogout = async () => {
        await logout();
        navigate('/app');
    }

    const userName = user?.display_name || user?.email || 'User';
    return (
        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton>
                                <User2 /> {userName}
                                <ChevronUp className="ml-auto" />
                            </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side="top"
                            className="min-w-56"
                            align="start"
                        >
                            <DropdownMenuItem onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                                <span>{theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleLogout}>
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
    )
}

interface AutomationListItemProps {
    automation: Automation;
}

function AutomationListItem({ automation }: AutomationListItemProps) {
    const location = useLocation();
    const isActive = location.pathname === `/app/automations/${automation.id}`;

    return (
        <SidebarMenuSub>
            <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild data-active={isActive}>
                    <Link to={`/app/automations/${automation.id}`}>
                        <span>{automation.name}</span>
                    </Link>
                </SidebarMenuSubButton>
            </SidebarMenuSubItem>
        </SidebarMenuSub>
    )
}

export default Sidebar;