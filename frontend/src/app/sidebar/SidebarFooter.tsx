import { useNavigate } from "react-router-dom"

import { ChevronUp, CreditCard, KeyRound, LogOut, Moon, Plug, Sun, User2, UserCog } from "lucide-react"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useAuth } from "@/modules/auth/context/AuthProvider"
import { User } from "@/types/User"

export function AppSidebarFooter() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const { setTheme, theme } = useTheme()
    const isDark = theme === "dark"
    const isAdmin = user?.roles.includes("admin") ?? false

    const handleLogout = () => {
        logout()
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
                                <UserCog className="size-4" />
                                <span>Account</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Settings</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => navigate(FrontendRoutes.INTEGRATIONS)}>
                                <Plug className="size-4" />
                                <span>Integrations</span>
                            </DropdownMenuItem>
                            {isAdmin && (
                                <DropdownMenuItem onClick={() => navigate(FrontendRoutes.BILLING)}>
                                    <CreditCard className="size-4" />
                                    <span>Billing</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => navigate(FrontendRoutes.API_TOKENS)}>
                                <KeyRound className="size-4" />
                                <span>API tokens</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
                                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                                <span>{isDark ? "Light mode" : "Dark mode"}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleLogout}>
                                <LogOut className="size-4" />
                                <span>Log out</span>
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
