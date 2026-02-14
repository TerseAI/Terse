import { Link, useLocation, useParams } from "react-router-dom"

import { ChevronDownIcon } from "lucide-react"

import { useAgent } from "@/hooks/api/useAgents"
import { useAgents } from "@/hooks/api/useAgents"

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./ui/breadcrumb"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { SidebarTrigger } from "./ui/sidebar"

// Route path to display name mapping
const routeLabels: Record<string, string> = {
    "": "Home",
    app: "Home",
    activity: "Activity Feed",
    agents: "Agents",
    new: "New Agent",
    integrations: "Integrations",
    notifications: "Notifications"
}

type BreadCrumbProps = {
    inline?: boolean
}

function BreadCrumb({ inline = false }: BreadCrumbProps) {
    const location = useLocation()
    const params = useParams()

    // Parse path segments
    const pathSegments = location.pathname.split("/").filter(Boolean)

    // Get channel if we're on an channel detail page
    const channelId = params.id && location.pathname.includes("/agents/") && params.id !== "new" ? params.id : null
    const { agent, isLoading } = useAgent(channelId)

    // Build breadcrumb items
    const buildBreadcrumbItems = () => {
        const items = []

        // Always start with Home
        items.push(
            <BreadcrumbItem key="home">
                <BreadcrumbLink asChild>
                    <Link to="/app">Home</Link>
                </BreadcrumbLink>
            </BreadcrumbItem>
        )

        // Filter out 'app' segment and get app-level segments
        const appSegments = pathSegments.filter(seg => seg !== "app")

        for (let i = 0; i < appSegments.length; i++) {
            const segment = appSegments[i]
            const isLast = i === appSegments.length - 1

            items.push(<BreadcrumbSeparator key={`sep-${i}`} />)

            // Special handling for agent routes
            if (segment === "agents") {
                // Check if next segment is an ID or 'new'
                const nextSegment = appSegments[i + 1]

                if (nextSegment === "new") {
                    // New channel page
                    items.push(
                        <BreadcrumbItem key="channels">
                            <BreadcrumbLink asChild>
                                <Link to="/app/agents">Agents</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    )
                    items.push(<BreadcrumbSeparator key="sep-new" />)
                    items.push(
                        <BreadcrumbItem key="new-channel">
                            <BreadcrumbPage>New Agent</BreadcrumbPage>
                        </BreadcrumbItem>
                    )
                    break // We've handled both segments
                } else if (params.id && nextSegment === params.id) {
                    // Channel detail page
                    items.push(
                        <BreadcrumbItem key="channels">
                            <ChannelDropdownMenu />
                        </BreadcrumbItem>
                    )
                    items.push(<BreadcrumbSeparator key="sep-channel" />)
                    items.push(
                        <BreadcrumbItem key="channel-detail">
                            <BreadcrumbPage>{isLoading ? "Loading..." : agent?.name || params.id}</BreadcrumbPage>
                        </BreadcrumbItem>
                    )
                    break // We've handled both segments
                } else {
                    // Just the channels list page
                    items.push(
                        <BreadcrumbItem key="channels">
                            <BreadcrumbPage>Agents</BreadcrumbPage>
                        </BreadcrumbItem>
                    )
                    break
                }
            } else {
                // Regular segment
                const label = routeLabels[segment] || segment
                const pathToSegment = "/app/" + appSegments.slice(0, i + 1).join("/")

                if (isLast) {
                    items.push(
                        <BreadcrumbItem key={segment}>
                            <BreadcrumbPage>{label}</BreadcrumbPage>
                        </BreadcrumbItem>
                    )
                } else {
                    items.push(
                        <BreadcrumbItem key={segment}>
                            <BreadcrumbLink asChild>
                                <Link to={pathToSegment}>{label}</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    )
                }
            }
        }

        return items
    }

    // Don't show breadcrumb on non-app routes
    if (!pathSegments.includes("app") && pathSegments.length > 0) {
        return null
    }

    // Agent detail pages manage their own header unless explicitly rendered inline there.
    const appSegments = pathSegments.filter(seg => seg !== "app")
    if (!inline && appSegments[0] === "agents" && appSegments.length >= 2) {
        return null
    }

    // Don't show breadcrumb on home page
    if (pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === "app")) {
        if (inline) {
            return null
        }

        return (
            <div className="flex items-center gap-4 px-2 py-3">
                <SidebarTrigger />
            </div>
        )
    }

    if (inline) {
        return (
            <Breadcrumb>
                <BreadcrumbList>{buildBreadcrumbItems()}</BreadcrumbList>
            </Breadcrumb>
        )
    }

    return (
        <div className="flex items-center gap-4 px-2 py-3">
            <SidebarTrigger />
            <Breadcrumb>
                <BreadcrumbList>{buildBreadcrumbItems()}</BreadcrumbList>
            </Breadcrumb>
        </div>
    )
}

function ChannelDropdownMenu() {
    const { agents, isLoading } = useAgents()

    if (isLoading || !agents.length) {
        return (
            <BreadcrumbLink asChild>
                <Link to="/app/agents">Agents</Link>
            </BreadcrumbLink>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5">
                Agents
                <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {agents.map(agent => (
                    <DropdownMenuItem key={agent.id}>
                        <Link to={`/app/agents/${agent.id}`}>{agent.name}</Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default BreadCrumb
