import { Link, useLocation, useParams } from "react-router-dom"

import { ChevronDownIcon } from "lucide-react"
import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { useAgent } from "@/modules/agents/api/useAgents"
import { useAgents } from "@/modules/agents/api/useAgents"
import { useProject } from "@/modules/projects/api/useProject"

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./ui/breadcrumb"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { SidebarTrigger } from "./ui/sidebar"

// Route path to display name mapping
const routeLabels: Record<string, string> = {
    activity: "Activity",
    jobs: "Jobs",
    new: "New Job",
    integrations: "Integrations",
    notifications: "Inbox",
    "api-tokens": "API Tokens",
    billing: "Billing",
    profile: "Account",
    pricing: "Pricing",
    projects: "Projects"
}

function BreadCrumb() {
    const location = useLocation()
    const params = useParams()

    // Parse path segments
    const pathSegments = location.pathname.split("/").filter(Boolean)

    // Get channel if we're on an channel detail page
    const channelId = params.id && location.pathname.includes("/jobs/") && params.id !== "new" ? params.id : null
    const { agent, isLoading } = useAgent(channelId)

    // Get project if we're on a project detail page
    const projectPathId = params.id && location.pathname.includes("/projects/") ? params.id : null
    const { project, isLoading: isProjectLoading } = useProject(projectPathId)

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

        const appSegments = toAppSegments(pathSegments)

        for (let i = 0; i < appSegments.length; i++) {
            const segment = appSegments[i]
            const isLast = i === appSegments.length - 1

            items.push(<BreadcrumbSeparator key={`sep-${i}`} />)

            // Special handling for job routes
            if (segment === "jobs") {
                // Check if next segment is an ID or 'new'
                const nextSegment = appSegments[i + 1]

                if (nextSegment === "new") {
                    // New channel page
                    items.push(
                        <BreadcrumbItem key="channels">
                            <BreadcrumbLink asChild>
                                <Link to={FrontendRoutes.JOBS.LIST}>Jobs</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    )
                    items.push(<BreadcrumbSeparator key="sep-new" />)
                    items.push(
                        <BreadcrumbItem key="new-channel">
                            <BreadcrumbPage>New Job</BreadcrumbPage>
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
                            <BreadcrumbPage>{isLoading ? "Loading…" : agent?.name || params.id}</BreadcrumbPage>
                        </BreadcrumbItem>
                    )
                    break // We've handled both segments
                } else {
                    // Just the channels list page
                    items.push(
                        <BreadcrumbItem key="channels">
                            <BreadcrumbPage>Jobs</BreadcrumbPage>
                        </BreadcrumbItem>
                    )
                    break
                }
            } else if (segment === "projects" && appSegments[i + 1]) {
                items.push(
                    <BreadcrumbItem key="projects">
                        <BreadcrumbPage>Projects</BreadcrumbPage>
                    </BreadcrumbItem>
                )
                items.push(<BreadcrumbSeparator key="sep-project" />)
                items.push(
                    <BreadcrumbItem key="project-detail">
                        <BreadcrumbPage>{isProjectLoading ? "Loading…" : project?.name || appSegments[i + 1]}</BreadcrumbPage>
                    </BreadcrumbItem>
                )
                break
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

    // Home is the breadcrumb root, so there is no trail to draw on it
    const hasTrail = toAppSegments(pathSegments).length > 0

    return (
        <div className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-3">
            <SidebarTrigger />
            {hasTrail && (
                <Breadcrumb>
                    <BreadcrumbList>{buildBreadcrumbItems()}</BreadcrumbList>
                </Breadcrumb>
            )}
        </div>
    )
}

/** Path segments below /app, with the redundant `home` segment dropped: /app/home is the root. */
function toAppSegments(pathSegments: string[]): string[] {
    const segments = pathSegments.filter(seg => seg !== "app")
    return segments[0] === "home" ? segments.slice(1) : segments
}

function ChannelDropdownMenu() {
    const { agents, isLoading } = useAgents()

    if (isLoading || !agents.length) {
        return (
            <BreadcrumbLink asChild>
                <Link to={FrontendRoutes.JOBS.LIST}>Jobs</Link>
            </BreadcrumbLink>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5">
                Jobs
                <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {agents.map(agent => (
                    <DropdownMenuItem key={agent.id} asChild>
                        <Link to={buildRoute(FrontendRoutes.JOBS.BY_ID, { id: agent.id })}>{agent.name}</Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default BreadCrumb
