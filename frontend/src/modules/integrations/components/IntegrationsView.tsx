import { useSearchParams } from "react-router-dom"

import { BadgeCheck, FileText } from "lucide-react"
import { IntegrationType } from "terse-types/Integrations"

import { PageFrame, PageHeader, PageTitle } from "@/components/PageFrame"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIntegrations } from "@/modules/integrations/api/useIntegrations"
import IntegrationCard, { IntegrationCardSkeleton } from "@/modules/integrations/components/IntegrationCard"

const LIST = "divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-card"
const ROW_CLASS = "max-w-none rounded-none border-0 bg-transparent hover:bg-muted/50"
const INTEGRATIONS_VIEW_PARAM = "view"

type IntegrationsTab = "active" | "available"

function isIntegrationsTab(value: string): value is IntegrationsTab {
    return value === "active" || value === "available"
}

function IntegrationPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { integrations: activeIntegrations, inactiveIntegrations, isLoading } = useIntegrations({ showOnlyForUI: true })
    const hasActive = activeIntegrations && activeIntegrations.length > 0
    const hasInactive = inactiveIntegrations && inactiveIntegrations.length > 0
    const activeTab: IntegrationsTab = searchParams.get(INTEGRATIONS_VIEW_PARAM) === "available" ? "available" : "active"

    const selectTab = (next: string) => {
        if (!isIntegrationsTab(next)) return

        const params = new URLSearchParams(searchParams)
        if (next === "active") {
            params.delete(INTEGRATIONS_VIEW_PARAM)
        } else {
            params.set(INTEGRATIONS_VIEW_PARAM, next)
        }
        setSearchParams(params, { replace: true })
    }

    return (
        <PageFrame>
            <PageHeader>
                <PageTitle>Integrations</PageTitle>
            </PageHeader>
            <Tabs value={activeTab} onValueChange={selectTab}>
                <TabsList variant="line" className="mb-6 justify-start gap-6">
                    <TabsTrigger variant="line" value="active" className="min-h-11 flex-none px-0 after:inset-x-0 sm:min-h-9">
                        Active
                    </TabsTrigger>
                    <TabsTrigger variant="line" value="available" className="min-h-11 flex-none px-0 after:inset-x-0 sm:min-h-9">
                        Available
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-0">
                    {isLoading ? (
                        <IntegrationListSkeleton />
                    ) : hasActive ? (
                        <IntegrationList integrations={activeIntegrations} isActive />
                    ) : (
                        <NoActiveIntegrations onBrowseAvailable={() => selectTab("available")} />
                    )}
                </TabsContent>

                <TabsContent value="available" className="mt-0">
                    {isLoading ? (
                        <IntegrationListSkeleton />
                    ) : hasInactive ? (
                        <IntegrationList integrations={inactiveIntegrations} isActive={false} />
                    ) : (
                        <NoAvailableIntegrations onViewActive={() => selectTab("active")} />
                    )}
                </TabsContent>
            </Tabs>
        </PageFrame>
    )
}

function IntegrationListSkeleton() {
    return (
        <div className={LIST}>
            {Array.from({ length: 3 }).map((_, index) => (
                <IntegrationCardSkeleton key={index} compact />
            ))}
        </div>
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

function NoActiveIntegrations({ onBrowseAvailable }: { onBrowseAvailable: () => void }) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <FileText className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>No active integrations</EmptyTitle>
                <EmptyDescription>Connect a provider from Available. Once linked, it will appear here for a quick overview.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button size="sm" onClick={onBrowseAvailable}>
                    Browse available
                </Button>
            </EmptyContent>
        </Empty>
    )
}

function NoAvailableIntegrations({ onViewActive }: { onViewActive: () => void }) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <BadgeCheck className="text-success" />
                </EmptyMedia>
                <EmptyTitle>All integrations are active</EmptyTitle>
                <EmptyDescription>There are no additional providers available to connect.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button size="sm" variant="outline" onClick={onViewActive}>
                    View active
                </Button>
            </EmptyContent>
        </Empty>
    )
}

export default IntegrationPage
