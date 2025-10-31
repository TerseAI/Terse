import { ChevronDown, ChevronUp, Home, Inbox, User2 } from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Link, useLocation, useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useAuth } from "@/services/auth";


// Menu items.
const items = [
    {
        title: "Home",
        url: "/app",
        icon: Home,
    },
    {
        title: "Automations",
        url: "/app/automations",
        icon: Inbox,
    },
]

export function AppSidebar() {
    const location = useLocation()
    return (
        <Sidebar>
            <AppSidebarHeader />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
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
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <AppSidebarFooter />
        </Sidebar>
    )
}

function AppSidebarHeader() {
    return (
        <SidebarHeader>
            <SidebarMenu>
                <SidebarMenuItem>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <SidebarMenuButton>
                                Terse AI
                                <ChevronDown className="ml-auto" />
                            </SidebarMenuButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[--radix-popper-anchor-width]">
                            <DropdownMenuItem>
                                <span>Acme Inc</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <span>Acme Corp.</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarHeader>
    )
}

function AppSidebarFooter() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

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
                            className="w-[--radix-popper-anchor-width]"
                        >
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

// function Sidebar() {
//     const location = useLocation();

//     return (
//         <div className="flex flex-col h-full p-2">
//             <CurrentUser />
//             <SidebarItem to="/app" isActive={location.pathname === "/app"}>
//                 <LinkLabel title="Home" icon={<HomeIcon className="w-5 h-5 text-[theme(--color-accent)]" />} />
//             </SidebarItem>
//             <SidebarItem to="/app/automations" isActive={location.pathname === "/app/automations"}>
//                 <LinkLabel title="Automations" icon={<Cog6ToothIcon className="w-5 h-5 text-[theme(--color-accent)]" />} />
//             </SidebarItem>
//         </div>
//     )
// }

// function SidebarItem({ to, children, isActive }: { to: string, children: React.ReactNode, isActive: boolean }) {
//     return (
//         <Link
//             to={to}
//             className={`p-2 rounded-sm transition-colors ${isActive
//                 ? 'bg-[theme(background-light)]'
//                 : 'hover:bg-[theme(background-hover)]'
//                 }`}
//         >
//             {children}
//         </Link>
//     )
// }

// function LinkLabel({ title, icon }: { title: string, icon: React.ReactNode }) {
//     return (
//         <div className="flex items-center gap-2">
//             {icon}
//             <span className="text-sm text-[theme(text-primary)]">{title}</span>
//         </div>
//     )
// }

// function CurrentUser() {
//     const { user, logout } = useAuth();
//     const navigate = useNavigate();

//     const handleLogout = async () => {
//         try {
//             await logout();
//             navigate('/app');
//         } catch (error) {
//             console.error('Logout failed:', error);
//         }
//     };

//     if (!user) {
//         return null;
//     }

//     return (
//         <Menu>
//             <div className="relative mb-4">
//                 <MenuButton className="flex items-center gap-2 p-2 cursor-pointer hover:bg-[theme(background-hover)] rounded-sm w-full">
//                     <p className="font-semibold text-md text-[theme(text-secondary)] truncate">
//                         {user.display_name}
//                     </p>
//                     <ChevronDownIcon className="w-3 h-3 text-[theme(text-disabled)] mx-0.5" />
//                 </MenuButton>

//                 <MenuItems anchor="top start" className="w-max bg-[theme(background-light)] rounded-sm shadow-[var(--shadow)] z-50 overflow-hidden border border-[theme(border)]">
//                     <MenuItem>
//                         {({ focus }) => (
//                             <button
//                                 onClick={toggleTheme}
//                                 className={`w-full p-2 text-left transition-colors flex items-center gap-2 ${focus ? 'bg-[theme(--color-accent)]/10' : ''}`}
//                             >
//                                 <SunIcon className="w-4 h-4 text-[theme(--color-accent)]" />
//                                 <span className="text-sm text-[theme(text-primary)]">Switch to {CurrentTheme() === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
//                             </button>
//                         )}
//                     </MenuItem>
//                     <MenuItem>
//                         {({ focus }) => (
//                             <button
//                                 onClick={handleLogout}
//                                 className={`w-full p-2 text-left transition-colors flex items-center gap-2 ${focus ? 'bg-[theme(--color-accent)]/10' : ''}`}
//                             >
//                                 <ArrowRightOnRectangleIcon className="w-4 h-4 text-[theme(--color-accent)]" />
//                                 <span className="text-sm text-[theme(text-primary)]">Logout</span>
//                             </button>
//                         )}
//                     </MenuItem>
//                 </MenuItems>
//             </div>
//         </Menu>
//     )
// }

export default Sidebar;