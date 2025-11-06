import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "./ui/breadcrumb";
import { SidebarTrigger } from "./ui/sidebar";
import { useLocation, useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { BackendProvider } from "@/services/backend";
import { ChevronDownIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Automation } from "@/shared/types";

// Route path to display name mapping
const routeLabels: Record<string, string> = {
    "": "Home",
    "app": "Home",
    "activity": "Activity Feed",
    "automations": "Automations",
    "new": "New Automation",
    "integrations": "Integrations",
};

function BreadCrumb() {
    const location = useLocation();
    const params = useParams();
    const [automationName, setAutomationName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Parse path segments
    const pathSegments = location.pathname.split('/').filter(Boolean);

    // Fetch automation name if we're on an automation detail page
    useEffect(() => {
        const automationId = params.id;
        if (automationId && location.pathname.includes('/automations/') && automationId !== 'new') {
            setIsLoading(true);
            BackendProvider.getAutomationById(automationId)
                .then(automation => {
                    setAutomationName(automation.name);
                })
                .catch(error => {
                    console.error('Error fetching automation name:', error);
                    setAutomationName(null);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            setAutomationName(null);
        }
    }, [params.id, location.pathname]);

    // Build breadcrumb items
    const buildBreadcrumbItems = () => {
        const items = [];

        // Always start with Home
        items.push(
            <BreadcrumbItem key="home">
                <BreadcrumbLink asChild>
                    <Link to="/app">Home</Link>
                </BreadcrumbLink>
            </BreadcrumbItem>
        );

        // Filter out 'app' segment and get app-level segments
        const appSegments = pathSegments.filter(seg => seg !== 'app');

        for (let i = 0; i < appSegments.length; i++) {
            const segment = appSegments[i];
            const isLast = i === appSegments.length - 1;

            items.push(<BreadcrumbSeparator key={`sep-${i}`} />);

            // Special handling for automation routes
            if (segment === 'automations') {
                // Check if next segment is an ID or 'new'
                const nextSegment = appSegments[i + 1];

                if (nextSegment === 'new') {
                    // New automation page
                    items.push(
                        <BreadcrumbItem key="automations">
                            <BreadcrumbLink asChild>
                                <Link to="/app/automations">Automations</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    );
                    items.push(<BreadcrumbSeparator key="sep-new" />);
                    items.push(
                        <BreadcrumbItem key="new-automation">
                            <BreadcrumbPage>New Automation</BreadcrumbPage>
                        </BreadcrumbItem>
                    );
                    break; // We've handled both segments
                } else if (params.id && nextSegment === params.id) {
                    // Automation detail page
                    items.push(
                        <BreadcrumbItem key="automations">
                            <AutomationDropdownMenu />
                        </BreadcrumbItem>
                    );
                    items.push(<BreadcrumbSeparator key="sep-automation" />);
                    items.push(
                        <BreadcrumbItem key="automation-detail">
                            <BreadcrumbPage>
                                {isLoading ? "Loading..." : (automationName || params.id)}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    );
                    break; // We've handled both segments
                } else {
                    // Just the automations list page
                    items.push(
                        <BreadcrumbItem key="automations">
                            <BreadcrumbPage>Automations</BreadcrumbPage>
                        </BreadcrumbItem>
                    );
                    break;
                }
            } else {
                // Regular segment
                const label = routeLabels[segment] || segment;
                const pathToSegment = '/app/' + appSegments.slice(0, i + 1).join('/');

                if (isLast) {
                    items.push(
                        <BreadcrumbItem key={segment}>
                            <BreadcrumbPage>{label}</BreadcrumbPage>
                        </BreadcrumbItem>
                    );
                } else {
                    items.push(
                        <BreadcrumbItem key={segment}>
                            <BreadcrumbLink asChild>
                                <Link to={pathToSegment}>{label}</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    );
                }
            }
        }

        return items;
    };

    // Don't show breadcrumb on non-app routes
    if (!pathSegments.includes('app') && pathSegments.length > 0) {
        return null;
    }

    // Don't show breadcrumb on home page
    if (pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === 'app')) {
        return (
            <div className="flex items-center gap-4 px-2 py-3">
                <SidebarTrigger />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4 px-2 py-3">
            <SidebarTrigger />
            <Breadcrumb>
                <BreadcrumbList>
                    {buildBreadcrumbItems()}
                </BreadcrumbList>
            </Breadcrumb>
        </div>
    );
}

function AutomationDropdownMenu() {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        const loadAutomations = async () => {
            try {
                const response = await BackendProvider.getUserAutomations();
                setAutomations(response.automations);
            } finally {
                setIsLoading(false);
            }
        };
        loadAutomations();
    }, []);

    if (isLoading || !automations.length) {
        return (
            <BreadcrumbLink asChild>
                <Link to="/app/automations">Automations</Link>
            </BreadcrumbLink>
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5">
                Automations
                <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {automations.map(automation => (
                    <DropdownMenuItem key={automation.id}>
                        <Link to={`/app/automations/${automation.id}`}>{automation.name}</Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default BreadCrumb;