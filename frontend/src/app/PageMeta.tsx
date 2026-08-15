import { useEffect } from "react"
import { useLocation } from "react-router-dom"

const ROUTE_TITLES: Record<string, string> = {
    home: "Home",
    activity: "Activity",
    stats: "Analytics",
    integrations: "Integrations",
    notifications: "Notifications",
    "api-tokens": "API Tokens",
    billing: "Billing",
    pricing: "Pricing",
    profile: "Account Settings",
    projects: "Project",
    jobs: "Job"
}

const EXACT_ROUTE_TITLES: Record<string, string> = {
    "/oauth/success": "Integration Connected",
    "/oauth/error": "Connection Error",
    "/organizations/create": "Create Organization"
}

function getRouteTitle(pathname: string) {
    const exactTitle = EXACT_ROUTE_TITLES[pathname]
    if (exactTitle) return exactTitle

    const segments = pathname.split("/").filter(Boolean)
    const appIndex = segments.indexOf("app")
    const routeSegment = appIndex >= 0 ? segments[appIndex + 1] : segments[0]

    return ROUTE_TITLES[routeSegment] ?? "Terse"
}

export function PageMeta() {
    const { pathname } = useLocation()
    const title = getRouteTitle(pathname)

    useEffect(() => {
        document.title = title === "Terse" ? "Terse" : `${title} · Terse`
    }, [title])

    return (
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {title} page
        </span>
    )
}
