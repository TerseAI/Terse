import { useNavigate } from "react-router-dom"

import { ChevronUp, User2 } from "lucide-react"

import { useAuth } from "@/services/auth"
import { FrontendRoutes } from "@/shared/FrontendRoutes"
import { User } from "@/types/User"

import { useTheme } from "../theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar"

export function AppSidebarFooter() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const { setTheme, theme } = useTheme()

    const handleLogout = async () => {
        await logout()
        navigate(FrontendRoutes.APP)
    }

    const userName = user?.displayName || user?.email || "User"
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
                        <DropdownMenuContent side="top" className="min-w-56" align="start">
                            <DropdownMenuItem onClick={() => navigate(FrontendRoutes.PROFILE)}>
                                <span>Account Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
                                <span>{theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}</span>
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
    const imageUrl = user?.displayPhotoUrl || ""

    return (
        <Avatar>
            <AvatarImage src={imageUrl} />
            <AvatarFallback>
                <User2 className="size-4" />
            </AvatarFallback>
        </Avatar>
    )
}
