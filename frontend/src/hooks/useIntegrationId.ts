import { useEffect, useState } from "react"

import { ConfigInstance, ConfigType } from "@/shared/Configs"

/**
 * Hook to manage integration ID state when switching between different integration types.
 * Prevents using stale integrationIds from previous config types.
 */
export function useIntegrationId(currentConfig: ConfigInstance | undefined, expectedConfigTypes: ConfigType | ConfigType[]): [string | undefined, (value: string | undefined) => void] {
    // Normalize expectedConfigTypes to an array
    const expectedTypes = Array.isArray(expectedConfigTypes) ? expectedConfigTypes : [expectedConfigTypes]

    // Check if currentConfig matches one of the expected config types
    const isValidConfig = currentConfig ? expectedTypes.includes(currentConfig.configType) : false

    // Only use integrationId from currentConfig if it matches the expected type
    // This prevents using stale integrationIds when switching from other integration types
    const validIntegrationId = isValidConfig && currentConfig ? currentConfig.integrationId : undefined

    const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(validIntegrationId)

    // Sync selectedIntegrationId when config changes (e.g., when switching from another integration type)
    useEffect(() => {
        if (isValidConfig && currentConfig) {
            setSelectedIntegrationId(currentConfig.integrationId)
        } else if (!currentConfig) {
            // Config was cleared, reset selection
            setSelectedIntegrationId(undefined)
        }
        // If currentConfig exists but doesn't match expected type, don't update
        // This handles the case where user switches from one integration type to another
    }, [currentConfig?.configType, currentConfig?.integrationId, isValidConfig, currentConfig])

    return [selectedIntegrationId, setSelectedIntegrationId]
}
