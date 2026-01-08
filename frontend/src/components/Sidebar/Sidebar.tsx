import { Bell, Eye, Home, Plus, Plug, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"
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
} from "@/components/ui/sidebar"
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Channel } from "@/shared/types";
import { Button } from "@/components/ui/button";
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
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                        <Link to={item.url}>
                            <item.icon className={item.iconColor} />
                            <span>{item.title}</span>
                        </Link>
                    </SidebarMenuButton>
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

interface ChannelsListProps {
    channels: Channel[];
    loading: boolean;
}
function ChannelsList({ channels, loading }: ChannelsListProps) {
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
            {channels.map((channel) => (
                <ChannelListItem key={channel.id} channel={channel} />
            ))}
            <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-muted-foreground"
                        onClick={() => navigate('/app/channels/setup')}
                    >
                        <Plus className="size-3 !text-muted-foreground hover:!text-foreground" color="currentColor"/>
                        Add Channel
                    </Button>
                </SidebarMenuSubButton>
            </SidebarMenuSubItem>
        </SidebarMenuSub>
    )
}

interface ChannelListItemProps {
    channel: Channel;
}

function ChannelListItem({ channel }: ChannelListItemProps) {
    const location = useLocation();
    const isActive = location.pathname === `/app/channels/${channel.id}`;

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={isActive}>
                <Link to={`/app/channels/${channel.id}`}>
                    <span>{channel.name}</span>
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
        url: "/app",
        icon: Home,
        iconColor: "text-primary",
    },
    {
        title: "Channels",
        url: "/app/channels",
        icon: Zap,
        iconColor: "text-primary",
    }
]

const BirdsEyeApplicationItems: NavItem[] = [
    {
        title: "Birds Eye",
        url: "/app/birds-eye",
        icon: Eye,
        iconColor: "text-primary",
    },
    {
        title: "Home",
        url: "/app",
        icon: Home,
        iconColor: "text-primary",
    },
    {
        title: "Channels",
        url: "/app/channels",
        icon: Zap,
        iconColor: "text-primary",
    }
]

const SettingsItems: NavItem[] = [
    {
        title: "Integrations",
        url: "/app/integrations",
        icon: Plug,
        iconColor: "text-primary",
    },
    {
        title: "Notifications",
        url: "/app/notifications",
        icon: Bell,
        iconColor: "text-primary",
    },
]