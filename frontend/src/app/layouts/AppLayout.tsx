import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/app/sidebar/AppSidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { RunHistoryChatDrawerProvider } from "@/modules/runHistory/context/RunHistoryChatDrawerContext"

export function AppLayout() {
    return (
        <SidebarProvider>
            <a
                href="#main-content"
                className="fixed left-3 top-3 z-50 -translate-y-20 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-transform duration-150 focus:translate-y-0"
            >
                Skip to content
            </a>
            <AppSidebar />
            <main id="main-content" tabIndex={-1} className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background focus:outline-none">
                <div className="absolute top-3 left-3 z-20 flex h-12 items-center">
                    <SidebarTrigger />
                </div>
                <div className="flex-1 min-h-0">
                    <RunHistoryChatDrawerProvider>
                        <Outlet />
                    </RunHistoryChatDrawerProvider>
                </div>
            </main>
        </SidebarProvider>
    )
}
