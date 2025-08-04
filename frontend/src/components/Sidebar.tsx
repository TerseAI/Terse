import { Link, useLocation } from "react-router-dom";
import { HomeIcon } from "@heroicons/react/24/outline";
import { ListBulletIcon } from "@heroicons/react/24/outline";

function Sidebar() {
    const location = useLocation();
    
    return (
        <div className="grid grid-flow-row gap-2 p-2">
            <div className="p-2 mb-4">
                <div className="bg-[theme(accent)] rounded-md h-7 w-7">
                    <img src="/logo-inverted.png" alt="Logo" className="w-7 h-7" />
                </div>
            </div>
            <SidebarItem to="/app" isActive={location.pathname === "/app"}>
                <LinkLabel title="Home" icon={<HomeIcon className="w-5 h-5 text-[theme(accent)]" />} />
            </SidebarItem>
            <SidebarItem to="/app/activity" isActive={location.pathname === "/app/activity"}>
                <LinkLabel title="Activity Feed" icon={<ListBulletIcon className="w-5 h-5 text-[theme(accent)]" />} />
            </SidebarItem>
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
            <span>{title}</span>
        </div>
    )
}

function SidebarIcon({ icon }: { icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            {icon}
        </div>
    )
}

export default Sidebar;