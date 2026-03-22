import { AnimatePresence, motion } from "framer-motion"
import { FileText } from "lucide-react"

import IntegrationCard, { IntegrationCardSkeleton } from "@/components/Integrations/IntegrationCard"
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Empty } from "@/components/ui/empty"
import { useIntegrations } from "@/hooks/api/useIntegrations"

const FADE_IN = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
} as const

const TRANSITION = {
    duration: 0.3,
    ease: [0.25, 1, 0.5, 1]
} as const

function IntegrationPage() {
    const { integrations: activeIntegrations, inactiveIntegrations, isLoading } = useIntegrations({ showOnlyForUI: true })

    const hasActive = activeIntegrations && activeIntegrations.length > 0
    const hasInactive = inactiveIntegrations && inactiveIntegrations.length > 0

    return (
        <div className="flex flex-col h-full p-4">
            <h1 className="text-xl font-bold text-foreground mb-10">Active Integrations</h1>
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div key="active-skeleton" className="flex flex-row flex-wrap items-stretch gap-12 mb-12" {...FADE_IN} transition={TRANSITION}>
                        {Array.from({ length: 3 }).map((_, index) => (
                            <IntegrationCardSkeleton key={index} />
                        ))}
                    </motion.div>
                ) : hasActive ? (
                    <motion.div key="active-cards" className="flex flex-row flex-wrap items-stretch gap-12 mb-12" {...FADE_IN} transition={TRANSITION}>
                        {activeIntegrations.map((integration, i) => (
                            <motion.div key={integration} className="flex" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...TRANSITION, delay: i * 0.06 }}>
                                <IntegrationCard integration={integration} isActive />
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div key="active-empty" className="mb-12" {...FADE_IN} transition={TRANSITION}>
                        <NoIntegrations />
                    </motion.div>
                )}
            </AnimatePresence>

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
                <EmptyTitle>No integrations found</EmptyTitle>
                <EmptyDescription>Integrations will appear here as you connect them with Automations.</EmptyDescription>
            </EmptyHeader>
        </Empty>
    )
}

export default IntegrationPage
