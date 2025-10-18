import { Link, useLocation } from "react-router-dom";
import { Cog6ToothIcon, HomeIcon } from "@heroicons/react/24/outline";
// import { ListBulletIcon } from "@heroicons/react/24/outline";
import { Squares2X2Icon } from "@heroicons/react/24/outline";  

function Sidebar() {
    const location = useLocation();
    
    return (
        <div className="grid grid-flow-row p-2">
            <div className="grid grid-cols-[auto_1fr] items-center gap-2 p-2 mb-8">
                <div className="bg-[theme(--color-accent)] rounded-md h-7 w-7">
                    <img src="/logo-inverted.png" alt="Logo" className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-bold text-[theme(text-primary)]">Vectra</h1>
            </div>
            <SidebarItem to="/app" isActive={location.pathname === "/app"}>
                <LinkLabel title="Home" icon={<HomeIcon className="w-5 h-5 text-[theme(--color-accent)]" />} />
            </SidebarItem>
            {/* <SidebarItem to="/app/activity" isActive={location.pathname === "/app/activity"}>
                <LinkLabel title="Activity Feed" icon={<ListBulletIcon className="w-5 h-5 text-[theme(--color-accent)]" />} />
            </SidebarItem> */}
            <SidebarItem to="/app/integrations" isActive={location.pathname === "/app/integrations"}>
                <LinkLabel title="Integrations" icon={<Squares2X2Icon className="w-5 h-5 text-[theme(--color-accent)]" />} />
            </SidebarItem>
            {import.meta.env.VITE_FEATURE_AUTOMATIONS === 'true' && (
                <SidebarItem to="/app/automations" isActive={location.pathname === "/app/automations"}>
                    <LinkLabel title="Automations" icon={<Cog6ToothIcon className="w-5 h-5 text-[theme(--color-accent)]" />} />
                </SidebarItem>
            )}
        </div>
    )
}

function SidebarItem({ to, children, isActive }: { to: string, children: React.ReactNode, isActive: boolean }) {
    return (
        <Link 
            to={to} 
            className={`p-2 rounded-md transition-colors ${
                isActive 
                    ? 'bg-[theme(background-surface)]' 
                    : 'hover:bg-[theme(background-surface)]'
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

export default Sidebar;