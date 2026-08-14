"use client"

import * as React from "react"

import { Slot } from "@radix-ui/react-slot"
import { PanelLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "15rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContextProps = {
    state: "expanded" | "collapsed"
    open: boolean
    setOpen: (open: boolean) => void
    openMobile: boolean
    setOpenMobile: (open: boolean) => void
    isMobile: boolean
    toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
    const context = React.useContext(SidebarContext)
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider.")
    }

    return context
}

function SidebarProvider({
    defaultOpen = true,
    open: openProp,
    onOpenChange: setOpenProp,
    className,
    style,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
}) {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)

    // This is the internal state of the sidebar.
    // We use openProp and setOpenProp for control from outside the component.
    const [_open, _setOpen] = React.useState(defaultOpen)
    const open = openProp ?? _open
    const setOpen = React.useCallback(
        (value: boolean | ((value: boolean) => boolean)) => {
            const openState = typeof value === "function" ? value(open) : value
            if (setOpenProp) {
                setOpenProp(openState)
            } else {
                _setOpen(openState)
            }

            // This sets the cookie to keep the sidebar state.
            document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
        },
        [setOpenProp, open]
    )

    // Helper to toggle the sidebar.
    const toggleSidebar = React.useCallback(() => {
        return isMobile ? setOpenMobile(open => !open) : setOpen(open => !open)
    }, [isMobile, setOpen, setOpenMobile])

    // Adds a keyboard shortcut to toggle the sidebar.
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                toggleSidebar()
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [toggleSidebar])

    // We add a state so that we can do data-state="expanded" or "collapsed".
    // This makes it easier to style the sidebar with Tailwind classes.
    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContextProps>(
        () => ({
            state,
            open,
            setOpen,
            isMobile,
            openMobile,
            setOpenMobile,
            toggleSidebar
        }),
        [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    )

    return (
        <SidebarContext.Provider value={contextValue}>
            <div
                style={
                    {
                        "--sidebar-width": SIDEBAR_WIDTH,
                        "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                        ...style
                    } as React.CSSProperties
                }
                className={cn("flex h-svh w-full", className)}
                {...props}
            >
                {children}
            </div>
        </SidebarContext.Provider>
    )
}

function Sidebar({
    side = "left",
    variant = "sidebar",
    collapsible = "offcanvas",
    className,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    side?: "left" | "right"
    variant?: "sidebar" | "floating" | "inset"
    collapsible?: "offcanvas" | "icon" | "none"
}) {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

    if (collapsible === "none") {
        return (
            <div data-variant={variant} className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)} style={{ width: SIDEBAR_WIDTH }} {...props}>
                {children}
            </div>
        )
    }

    if (isMobile) {
        return (
            <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
                <SheetContent data-variant={variant} className="bg-sidebar p-0 text-sidebar-foreground [&_[data-slot=sidebar-header]]:pr-14" style={{ width: SIDEBAR_WIDTH_MOBILE }} side={side}>
                    <SheetHeader className="sr-only">
                        <SheetTitle>Sidebar</SheetTitle>
                        <SheetDescription>Displays the mobile sidebar.</SheetDescription>
                    </SheetHeader>
                    <div className="flex h-full w-full flex-col">{children}</div>
                </SheetContent>
            </Sheet>
        )
    }

    const isCollapsed = state === "collapsed"
    const isOffcanvas = collapsible === "offcanvas" && isCollapsed
    const isIcon = collapsible === "icon" && isCollapsed

    const sidebarWidth = isIcon ? SIDEBAR_WIDTH_ICON : SIDEBAR_WIDTH

    return (
        <div className="hidden md:block">
            {/* Spacer for sidebar width */}
            <div className="relative bg-transparent transition-[width] duration-200 ease-out" style={{ width: isOffcanvas ? 0 : sidebarWidth }} />
            {/* Fixed sidebar */}
            <div
                className={cn(
                    "fixed inset-y-0 z-10 h-svh transition-[transform,width] duration-200 ease-out md:flex",
                    side === "left" ? "left-0" : "right-0",
                    isOffcanvas ? (side === "left" ? "-translate-x-full" : "translate-x-full") : "",
                    side === "left" && !isOffcanvas && "border-r border-sidebar-border",
                    side === "right" && !isOffcanvas && "border-l border-sidebar-border",
                    className
                )}
                style={{ width: sidebarWidth }}
                data-variant={variant}
                {...props}
            >
                <div className="bg-sidebar flex h-full w-full flex-col">{children}</div>
            </div>
        </div>
    )
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
    const { toggleSidebar } = useSidebar()

    return (
        <Button
            variant="ghost"
            size="icon"
            className={cn("size-9 max-md:size-11", className)}
            onClick={event => {
                onClick?.(event)
                toggleSidebar()
            }}
            {...props}
        >
            <PanelLeftIcon className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
        </Button>
    )
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
    const { toggleSidebar } = useSidebar()

    return (
        <button
            aria-label="Toggle Sidebar"
            tabIndex={-1}
            onClick={toggleSidebar}
            title="Toggle Sidebar"
            className={cn("absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 cursor-pointer transition-colors duration-150 hover:bg-sidebar-accent/50 sm:flex", className)}
            {...props}
        />
    )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
    return <main className={cn("bg-background relative flex w-full flex-1 flex-col", className)} {...props} />
}

function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
    return <Input className={cn("bg-background h-8 w-full shadow-none", className)} {...props} />
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="sidebar-header" className={cn("flex flex-col gap-2 border-b border-sidebar-border p-3", className)} {...props} />
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="sidebar-footer" className={cn("flex flex-col gap-2 border-t border-sidebar-border p-3", className)} {...props} />
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
    return <Separator className={cn("bg-sidebar-border mx-4", className)} {...props} />
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("flex min-h-0 flex-1 overscroll-contain flex-col gap-1 overflow-auto", className)} {...props} />
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("relative flex w-full min-w-0 flex-col px-2.5 py-2", className)} {...props} />
}

function SidebarGroupLabel({ className, asChild = false, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) {
    const Comp = asChild ? Slot : "div"

    return <Comp className={cn("flex h-7 shrink-0 items-center px-2 text-xs font-medium text-sidebar-foreground/65", className)} {...props} />
}

function SidebarGroupAction({ className, asChild = false, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
    const Comp = asChild ? Slot : "button"

    return (
        <Comp
            className={cn(
                "absolute right-2 top-2 flex size-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground max-md:size-11",
                className
            )}
            {...props}
        />
    )
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("w-full text-sm", className)} {...props} />
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
    return <ul className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
    return <li className={cn("relative", className)} {...props} />
}

function SidebarMenuButton({
    asChild = false,
    isActive = false,
    variant = "default",
    size = "default",
    className,
    ...props
}: React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
    variant?: "default" | "outline"
    size?: "default" | "sm" | "lg"
}) {
    const Comp = asChild ? Slot : "button"

    return (
        <Comp
            className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors duration-150",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                "disabled:pointer-events-none disabled:opacity-50",
                "[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
                variant === "outline" && "border border-sidebar-border bg-background",
                size === "sm" && "h-8 text-xs max-md:h-11",
                size === "default" && "h-9 max-md:h-11",
                size === "lg" && "h-12",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                className
            )}
            {...props}
        />
    )
}

function SidebarMenuAction({
    className,
    asChild = false,
    showOnHover = false,
    ...props
}: React.ComponentProps<"button"> & {
    asChild?: boolean
    showOnHover?: boolean
}) {
    const Comp = asChild ? Slot : "button"

    return (
        <Comp
            className={cn(
                "absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/70 transition-[background-color,color,opacity] duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground max-md:size-11",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                "[&>svg]:h-3.5 [&>svg]:w-3.5",
                showOnHover && "opacity-0 group-hover:opacity-100",
                className
            )}
            {...props}
        />
    )
}

function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-sidebar-accent px-1.5 text-xs font-medium tabular-nums", className)} {...props} />
}

function SidebarMenuSkeleton({
    className,
    showIcon = false,
    ...props
}: React.ComponentProps<"div"> & {
    showIcon?: boolean
}) {
    const width = React.useMemo(() => {
        return `${Math.floor(Math.random() * 40) + 50}%`
    }, [])

    return (
        <div className={cn("flex h-9 items-center gap-2.5 rounded-lg px-3", className)} {...props}>
            {showIcon && <Skeleton className="h-4 w-4 rounded" />}
            <Skeleton className="h-4 flex-1" style={{ width } as React.CSSProperties} />
        </div>
    )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
    return (
        <div className="relative ml-4 pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-sidebar-border" />
            <ul className={cn("flex min-w-0 flex-col gap-1", className)} {...props} />
        </div>
    )
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">) {
    return <li className={cn("relative", className)} {...props} />
}

function SidebarMenuSubButton({
    asChild = false,
    size = "md",
    isActive = false,
    className,
    ...props
}: React.ComponentProps<"a"> & {
    asChild?: boolean
    size?: "sm" | "md"
    isActive?: boolean
}) {
    const Comp = asChild ? Slot : "a"
    return (
        <Comp
            data-slot="sidebar-menu-sub-button"
            data-sidebar="menu-sub-button"
            data-size={size}
            data-active={isActive}
            className={cn(
                "flex h-9 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2.5 text-sidebar-foreground outline-hidden ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 max-md:min-h-11 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
                "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
                size === "sm" && "text-xs",
                size === "md" && "text-sm",
                "group-data-[collapsible=icon]:hidden",
                className
            )}
            {...props}
        />
    )
}

export {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInput,
    SidebarInset,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarRail,
    SidebarSeparator,
    SidebarTrigger,
    useSidebar
}
