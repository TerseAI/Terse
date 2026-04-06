import { useCallback, useState } from "react"

import { toast } from "sonner"
import { IntegrationType } from "terse-types"
import type { AgentTrigger, SerializedEvent } from "terse-types"

import { BackendProvider } from "../../services/backend"

export function useSampleEvents(triggers: AgentTrigger[], automationId?: string) {
    const [isFetching, setIsFetching] = useState(false)
    const [isTriggering, setIsTriggering] = useState(false)
    const [events, setEvents] = useState<SerializedEvent[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const integrationTriggers = triggers.filter(t => t.config.integrationType !== IntegrationType.CRON_JOB)
    const hasIntegrationTriggers = integrationTriggers.length > 0

    const fetchSamples = useCallback(async () => {
        if (integrationTriggers.length === 0) {
            toast.error("No integration triggers to fetch samples for")
            return
        }
        setEvents([])
        setIsDialogOpen(true)
        setIsFetching(true)
        try {
            const result = await BackendProvider.fetchSampleEvents(
                integrationTriggers.map(t => ({
                    integrationId: t.config.integrationId,
                    integrationType: t.config.integrationType,
                    config: t.config
                }))
            )
            setEvents(result.events)
            if (result.events.length === 0) {
                toast.info("No sample events found for the configured triggers")
            }
        } catch {
            toast.error("Failed to fetch sample events")
            setIsDialogOpen(false)
        } finally {
            setIsFetching(false)
        }
    }, [integrationTriggers])

    const triggerWithEvent = useCallback(
        async (event: SerializedEvent) => {
            if (!automationId) return
            setIsTriggering(true)
            try {
                await BackendProvider.triggerWithEvent(automationId, event)
                toast.success("Job triggered with selected event")
                setIsDialogOpen(false)
            } catch {
                toast.error("Failed to trigger job")
            } finally {
                setIsTriggering(false)
            }
        },
        [automationId]
    )

    const closeDialog = useCallback(() => setIsDialogOpen(false), [])

    return {
        isFetching,
        isTriggering,
        events,
        isDialogOpen,
        hasIntegrationTriggers,
        fetchSamples,
        triggerWithEvent,
        closeDialog
    }
}
