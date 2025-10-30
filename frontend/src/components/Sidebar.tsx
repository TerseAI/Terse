import { ArrowRightOnRectangleIcon, Cog6ToothIcon, HomeIcon } from "@heroicons/react/24/outline";
import { Link, useLocation, useNavigate } from "react-router-dom";
// import { ListBulletIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../services/auth";

function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useAuth();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/app');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <div className="flex flex-col h-full p-2">
            <CurrentUser />
            <SidebarItem to="/app" isActive={location.pathname === "/app"}>
                <LinkLabel title="Home" icon={<HomeIcon className="w-5 h-5 text-[theme(--color-accent)]" />} />
            </SidebarItem>
            <SidebarItem to="/app/automations" isActive={location.pathname === "/app/automations"}>
                <LinkLabel title="Automations" icon={<Cog6ToothIcon className="w-5 h-5 text-[theme(--color-accent)]" />} />
            </SidebarItem>
            <div className="mt-auto">
                <button
                    onClick={handleLogout}
                    className="w-full p-2 rounded-md transition-colors hover:bg-[theme(background-light)]"
                >
                    <div className="flex items-center gap-2">
                        <ArrowRightOnRectangleIcon className="w-5 h-5 text-[theme(--color-accent)]" />
                        <span className="text-sm text-[theme(text-primary)]">Logout</span>
                    </div>
                </button>
            </div>
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
    const { user } = useAuth();

    if (!user) {
        return null;
    }

    return (
        <div className="p-2">
            <p className="font-semibold text-md text-[theme(text-secondary)]">
                {user.display_name}
            </p>
        </div>
    )
}

export default Sidebar;