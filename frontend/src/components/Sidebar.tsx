import { ArrowRightOnRectangleIcon, ChevronDownIcon, Cog6ToothIcon, HomeIcon, SunIcon } from "@heroicons/react/24/outline";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
// import { ListBulletIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../services/auth";
import { CurrentTheme, toggleTheme } from "../utility/Theme";

function Sidebar() {
    const location = useLocation();

    return (
        <div className="flex flex-col h-full p-2">
            <CurrentUser />
            <SidebarItem to="/app" isActive={location.pathname === "/app"}>
                <LinkLabel title="Home" icon={<HomeIcon className="w-5 h-5 text-[theme(--color-accent)]" />} />
            </SidebarItem>
            <SidebarItem to="/app/automations" isActive={location.pathname === "/app/automations"}>
                <LinkLabel title="Automations" icon={<Cog6ToothIcon className="w-5 h-5 text-[theme(--color-accent)]" />} />
            </SidebarItem>
        </div>
    )
}

function SidebarItem({ to, children, isActive }: { to: string, children: React.ReactNode, isActive: boolean }) {
    return (
        <Link
            to={to}
            className={`p-2 rounded-sm transition-colors ${isActive
                ? 'bg-[theme(background-light)]'
                : 'hover:bg-[theme(background-hover)]'
                }`}
        >
            {children}
        </Link>
    )
}

function LinkLabel({ title, icon }: { title: string, icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm text-[theme(text-primary)]">{title}</span>
        </div>
    )
}

function CurrentUser() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/app');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    if (!user) {
        return null;
    }

    return (
        <Menu>
            <div className="relative mb-4">
                <MenuButton className="flex items-center gap-2 p-2 cursor-pointer hover:bg-[theme(background-hover)] rounded-sm w-full">
                    <p className="font-semibold text-md text-[theme(text-secondary)] truncate">
                        {user.display_name}
                    </p>
                    <ChevronDownIcon className="w-3 h-3 text-[theme(text-disabled)] mx-0.5" />
                </MenuButton>

                <MenuItems anchor="top start" className="w-max bg-[theme(background-light)] rounded-sm shadow-[var(--shadow)] z-50 overflow-hidden border border-[theme(border)]">
                    <MenuItem>
                        {({ focus }) => (
                            <button
                                onClick={toggleTheme}
                                className={`w-full p-2 text-left transition-colors flex items-center gap-2 ${focus ? 'bg-[theme(--color-accent)]/10' : ''}`}
                            >
                                <SunIcon className="w-4 h-4 text-[theme(--color-accent)]" />
                                <span className="text-sm text-[theme(text-primary)]">Switch to {CurrentTheme() === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                            </button>
                        )}
                    </MenuItem>
                    <MenuItem>
                        {({ focus }) => (
                            <button
                                onClick={handleLogout}
                                className={`w-full p-2 text-left transition-colors flex items-center gap-2 ${focus ? 'bg-[theme(--color-accent)]/10' : ''}`}
                            >
                                <ArrowRightOnRectangleIcon className="w-4 h-4 text-[theme(--color-accent)]" />
                                <span className="text-sm text-[theme(text-primary)]">Logout</span>
                            </button>
                        )}
                    </MenuItem>
                </MenuItems>
            </div>
        </Menu>
    )
}

export default Sidebar;