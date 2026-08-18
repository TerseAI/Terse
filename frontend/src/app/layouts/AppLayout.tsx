import { Outlet } from "react-router-dom"

import { AppSidebar } from "@/app/sidebar/AppSidebar"
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
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
            <main id="main-content" tabIndex={-1} className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background focus:outline-none">
                <CollapsedSidebarTrigger />
                <div className="flex-1 min-h-0">
                    <RunHistoryChatDrawerProvider>
                        <Outlet />
                    </RunHistoryChatDrawerProvider>
                </div>
            </main>
        </SidebarProvider>
    )
}

function CollapsedSidebarTrigger() {
    const { open, isMobile } = useSidebar()
    if (!isMobile && open) return null

    return (
        <div className="flex shrink-0 items-center px-2 pt-2">
            <SidebarTrigger />
        </div>
    )
}
