import { Link } from "react-router-dom"

import { FileText } from "lucide-react"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useIntegrations } from "@/modules/integrations/api/useIntegrations"
import IntegrationCard, { IntegrationCardSkeleton } from "@/modules/integrations/components/IntegrationCard"

const GRID_COLS = "grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(20rem,100%),1fr))]"

function IntegrationPage() {
    const { integrations: activeIntegrations, inactiveIntegrations, isLoading } = useIntegrations({ showOnlyForUI: true })

    const hasActive = activeIntegrations && activeIntegrations.length > 0
    const hasInactive = inactiveIntegrations && inactiveIntegrations.length > 0

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-6 py-10 space-y-10">
                <section className="space-y-6">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Active Integrations</h1>
                    {isLoading ? (
                        <div className={GRID_COLS}>
                            {Array.from({ length: 3 }).map((_, index) => (
                                <IntegrationCardSkeleton key={index} />
                            ))}
                        </div>
                    ) : hasActive ? (
                        <div className={GRID_COLS}>
                            {activeIntegrations.map(integration => (
                                <IntegrationCard key={integration} integration={integration} isActive />
                            ))}
                        </div>
                    ) : (
                        <NoIntegrations />
                    )}
                </section>

                {hasInactive && (
                    <section className="space-y-6">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inactive Integrations</h1>
                        <div className={GRID_COLS}>
                            {inactiveIntegrations.map(integration => (
                                <IntegrationCard key={integration} integration={integration} isActive={false} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}

function NoIntegrations() {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <FileText className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>No active integrations</EmptyTitle>
                <EmptyDescription>Connect Slack, GitHub, and other providers from a job's setup. Once linked, active integrations show here for a quick overview.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button size="sm" asChild>
                    <Link to={FrontendRoutes.HOME}>Go to jobs</Link>
                </Button>
            </EmptyContent>
        </Empty>
    )
}

export default IntegrationPage
