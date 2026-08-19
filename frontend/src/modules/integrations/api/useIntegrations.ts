import useSWR from "swr"
import { IntegrationType, IntegrationWithStatus } from "terse-types/Integrations"
import { integrationsKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "@/lib/http"

export function useIntegrations({ showOnlyForUI = false }: { showOnlyForUI?: boolean }) {
    const key = integrationsKey()

    const { data, error, isValidating, mutate } = useSWR<IntegrationWithStatus[]>(key, async () => {
        return BackendProvider.getAllIntegrations()
    })

    const allIntegrations = data
    let activeIntegrations = allIntegrations?.filter(integration => integration.isActive).map(integration => integration.integrationType) ?? []
    let inactiveIntegrations = allIntegrations?.filter(integration => !integration.isActive).map(integration => integration.integrationType) ?? []
    const isLoading = !data && !error

    // Hide system-only integrations that do not have user-facing cards.
    if (showOnlyForUI) {
        activeIntegrations = activeIntegrations.filter(
            integration => integration !== IntegrationType.TERSE && integration !== IntegrationType.CRON_JOB && integration !== IntegrationType.WEBHOOK && integration !== IntegrationType.WEBMONITOR
        )
        inactiveIntegrations = inactiveIntegrations.filter(
            integration => integration !== IntegrationType.TERSE && integration !== IntegrationType.CRON_JOB && integration !== IntegrationType.WEBHOOK && integration !== IntegrationType.WEBMONITOR
        )
    }

    return {
        integrations: activeIntegrations,
        inactiveIntegrations,
        allIntegrations,
        integrationStatus: data,
        isLoading,
        isError: error,
        isValidating,
        mutate
    }
}
