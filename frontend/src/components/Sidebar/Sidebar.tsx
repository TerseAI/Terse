import { Eye, Home, MoreHorizontal, Plug, Zap } from "lucide-react"
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
import { Channel } from "@/shared/types";
import { AppSidebarHeader } from "./SidebarHeader";
import { AppSidebarFooter } from "./SidebarFooter";
import { useChannels } from "@/hooks/api/useChannels";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

export function AppSidebar() {
    const { channels, isLoading } = useChannels({ limit: 100 });

    return (
        <Sidebar>
            <AppSidebarHeader />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <ApplicationNavigation channels={channels} loading={isLoading} />
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
    channels: Channel[];
    loading: boolean;
}

function ApplicationNavigation({ channels, loading }: ApplicationNavigationProps) {
    const location = useLocation();
    const hasBirdsEyeFlag = useFeatureFlag('Birds-eye-view-homepage');
    const applicationItems = hasBirdsEyeFlag ? BirdsEyeApplicationItems : DefaultApplicationItems;

    return (
        <SidebarMenu>
            {applicationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={location.pathname === item.url}>
                        <Link to={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                        </Link>
                    </SidebarMenuButton>
                    {item.title === "Channels" &&
                        <ChannelDropdownMenu />
                    }
                    {item.title === "Channels" && (
                        <ChannelsList channels={channels} loading={loading} />
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

interface ChannelsListProps {
    channels: Channel[];
    loading: boolean;
}
function ChannelsList({ channels, loading }: ChannelsListProps) {
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
            {channels.map((channel) => (
                <ChannelListItem key={channel.id} channel={channel} />
            ))}
        </>
    )
}

function ChannelDropdownMenu() {
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
                    <span onClick={() => navigate('/app/channels/new')}>New Channel</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

interface ChannelListItemProps {
    channel: Channel;
}

function ChannelListItem({ channel }: ChannelListItemProps) {
    const location = useLocation();
    const isActive = location.pathname === `/app/channels/${channel.id}`;

    return (
        <SidebarMenuSub>
            <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild data-active={isActive}>
                    <Link to={`/app/channels/${channel.id}`}>
                        <span>{channel.name}</span>
                    </Link>
                </SidebarMenuSubButton>
            </SidebarMenuSubItem>
        </SidebarMenuSub>
    )
}

export default Sidebar;

interface NavItem {
    title: string;
    url: string;
    icon: LucideIcon;
}

const DefaultApplicationItems: NavItem[] = [
    {
        title: "Home",
        url: "/app",
        icon: Home,
    },
    {
        title: "Channels",
        url: "/app/channels",
        icon: Zap,
    }
]

const BirdsEyeApplicationItems: NavItem[] = [
    {
        title: "Birds Eye",
        url: "/app/birds-eye",
        icon: Eye,
    },
    {
        title: "Home",
        url: "/app",
        icon: Home,
    },
    {
        title: "Channels",
        url: "/app/channels",
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