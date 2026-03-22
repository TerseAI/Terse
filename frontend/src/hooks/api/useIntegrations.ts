import useSWR from "swr"

import { BackendProvider } from "@/services/backend"
import { IntegrationType, IntegrationWithStatus } from "@/shared/Integrations"
import { integrationsKey } from "@/shared/InvalidationKeys"

export function useIntegrations({ showOnlyForUI = false }: { showOnlyForUI?: boolean }) {
    const key = integrationsKey()

    const { data, error, isValidating, mutate } = useSWR<IntegrationWithStatus[]>(key, async () => {
        return BackendProvider.getAllIntegrations()
    })

    const allIntegrations = data
    let activeIntegrations = allIntegrations?.filter(integration => integration.isActive).map(integration => integration.integrationType) ?? []
    let inactiveIntegrations = allIntegrations?.filter(integration => !integration.isActive).map(integration => integration.integrationType) ?? []
    const isLoading = !data && !error

    // Don't show TERSE and CRON_JOB integrations in the UI
    if (showOnlyForUI) {
        activeIntegrations = activeIntegrations.filter(integration => integration !== IntegrationType.TERSE && integration !== IntegrationType.CRON_JOB)
        inactiveIntegrations = inactiveIntegrations.filter(integration => integration !== IntegrationType.TERSE && integration !== IntegrationType.CRON_JOB)
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
