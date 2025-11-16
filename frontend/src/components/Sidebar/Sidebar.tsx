import { Home, MoreHorizontal, Plug, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
    Sidebar,
    SidebarContent,
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
import { Automation } from "@/shared/types";
import { AppSidebarHeader } from "./SidebarHeader";
import { AppSidebarFooter } from "./SidebarFooter";
import { useAutomations, useAutomationMutations } from "@/hooks/api/useAutomations";
import { useState } from "react";

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
    const { automations, isLoading } = useAutomations({ limit: 100 });

    return (
        <Sidebar>
            <AppSidebarHeader />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <ApplicationNavigation automations={automations} loading={isLoading} />
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

function NewAutomationMenuItem() {
    const navigate = useNavigate();
    const { createAutomation } = useAutomationMutations();
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        try {
            setIsCreating(true);
            // Create a new automation with just a name (creates as draft)
            const result = await createAutomation({
                name: 'New Automation',
                inputs: [],
                output: { integration: '', integrationId: undefined },
                prompt: { text: '' },
                isActive: false,
            });

            if (result?.id) {
                // Navigate to the new automation's edit page
                navigate(`/app/automations/${result.id}?tab=edit`);
            }
        } catch (error) {
            console.error('Failed to create automation:', error);
            alert('Failed to create automation. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <span onClick={handleCreate} style={{ cursor: isCreating ? 'wait' : 'pointer' }}>
            {isCreating ? 'Creating...' : 'New Automation'}
        </span>
    );
}

function AutomationDropdownMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuAction>
                    <MoreHorizontal />
                </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
                <DropdownMenuItem>
                    <NewAutomationMenuItem />
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
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