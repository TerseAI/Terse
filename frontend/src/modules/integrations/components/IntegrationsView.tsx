import { Link } from "react-router-dom"

import { AnimatePresence, motion } from "framer-motion"
import { FileText } from "lucide-react"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { FadeSwitch } from "@/components/ui/fade-switch"
import { useIntegrations } from "@/modules/integrations/api/useIntegrations"
import IntegrationCard, { IntegrationCardSkeleton } from "@/modules/integrations/components/IntegrationCard"

const TRANSITION = {
    duration: 0.3,
    ease: [0.25, 1, 0.5, 1]
} as const

function IntegrationPage() {
    const { integrations: activeIntegrations, inactiveIntegrations, isLoading } = useIntegrations({ showOnlyForUI: true })

    const hasActive = activeIntegrations && activeIntegrations.length > 0
    const hasInactive = inactiveIntegrations && inactiveIntegrations.length > 0
    const activeKey = isLoading ? "skeleton" : hasActive ? "cards" : "empty"

    return (
        <div className="flex flex-col h-full p-4">
            <h1 className="text-xl font-bold text-foreground mb-10">Active Integrations</h1>
            <FadeSwitch activeKey={activeKey} transition={TRANSITION} className="mb-12">
                {isLoading ? (
                    <div className="flex flex-row flex-wrap items-stretch gap-12">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <IntegrationCardSkeleton key={index} />
                        ))}
                    </div>
                ) : hasActive ? (
                    <div className="flex flex-row flex-wrap items-stretch gap-12">
                        {activeIntegrations.map((integration, i) => (
                            <motion.div key={integration} className="flex" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TRANSITION, delay: i * 0.06 }}>
                                <IntegrationCard integration={integration} isActive />
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <NoIntegrations />
                )}
            </FadeSwitch>

            <AnimatePresence>
                {hasInactive && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...TRANSITION, delay: 0.15 }}>
                        <h1 className="text-xl font-bold text-foreground mb-10">Inactive Integrations</h1>
                        <div className="flex flex-row flex-wrap items-stretch gap-12">
                            {inactiveIntegrations.map((integration, i) => (
                                <motion.div key={integration} className="flex" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TRANSITION, delay: 0.15 + i * 0.06 }}>
                                    <IntegrationCard integration={integration} isActive={false} />
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
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
