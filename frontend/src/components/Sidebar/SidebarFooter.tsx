import { useAuth } from "@/services/auth";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme-provider";
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { User2 } from "lucide-react";
import { ChevronUp } from "lucide-react";
import { User } from "@/types/User";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export function AppSidebarFooter() {
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
                                <ProfilePhoto user={user} /> {userName}
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

// Function to try and resolve a profile photo from their github (if attached) or their email as a fallback
function ProfilePhoto({ user }: { user: User | null }) {
    let size = 100;
    let imageUrl = '';
    if (user && user.github_username) {
        imageUrl = `https://github.com/${user.github_username}.png?size=${size}`;
    }

    return (
        <Avatar>
            <AvatarImage src={imageUrl} />
            <AvatarFallback>
                <User2 className="size-4" />
            </AvatarFallback>
        </Avatar>
    )
}