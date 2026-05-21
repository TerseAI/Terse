import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/app/sidebar/AppSidebar"
import BreadCrumb from "@/components/BreadCrumb"
import { SidebarProvider } from "@/components/ui/sidebar"
import { RunHistoryChatDrawerProvider } from "@/modules/runHistory/context/RunHistoryChatDrawerContext"

export function AppLayout() {
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="flex-1 flex flex-col h-full min-w-0 bg-background">
                <BreadCrumb />
                <div className="flex-1 min-h-0">
                    <RunHistoryChatDrawerProvider>
                        <Outlet />
                    </RunHistoryChatDrawerProvider>
                </div>
            </main>
        </SidebarProvider>
    )
}
