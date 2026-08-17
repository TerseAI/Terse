import { Link } from "react-router-dom"

import { FileText } from "lucide-react"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { IntegrationType } from "terse-types/Integrations"

import { PageFrame } from "@/components/PageFrame"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useIntegrations } from "@/modules/integrations/api/useIntegrations"
import IntegrationCard, { IntegrationCardSkeleton } from "@/modules/integrations/components/IntegrationCard"

const LIST = "divide-y divide-border/60 border-y border-border/60"
const ROW_CLASS = "max-w-none rounded-none border-0 bg-transparent hover:bg-muted/50"

function IntegrationPage() {
    const { integrations: activeIntegrations, inactiveIntegrations, isLoading } = useIntegrations({ showOnlyForUI: true })

    const hasActive = activeIntegrations && activeIntegrations.length > 0
    const hasInactive = inactiveIntegrations && inactiveIntegrations.length > 0

    return (
        <PageFrame>
            <div className="space-y-10">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
                    <p className="mt-1 text-sm text-muted-foreground">The Terse Agent will automatically prompt for the correct integrations as needed</p>
                </div>
                <section>
                    <h2 className="mb-3 px-1 text-sm font-medium text-foreground">Active</h2>
                    {isLoading ? (
                        <div className={LIST}>
                            {Array.from({ length: 3 }).map((_, index) => (
                                <IntegrationCardSkeleton key={index} compact />
                            ))}
                        </div>
                    ) : hasActive ? (
                        <IntegrationList integrations={activeIntegrations} isActive />
                    ) : (
                        <NoIntegrations />
                    )}
                </section>

                {hasInactive && (
                    <section>
                        <h2 className="mb-3 px-1 text-sm font-medium text-foreground">Available</h2>
                        <IntegrationList integrations={inactiveIntegrations} isActive={false} />
                    </section>
                )}
            </div>
        </PageFrame>
    )
}

function IntegrationList({ integrations, isActive }: { integrations: IntegrationType[]; isActive: boolean }) {
    return (
        <ul className={LIST}>
            {integrations.map(integration => (
                <li key={integration}>
                    <IntegrationCard integration={integration} isActive={isActive} compact className={ROW_CLASS} />
                </li>
            ))}
        </ul>
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
