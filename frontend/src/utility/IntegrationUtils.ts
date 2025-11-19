import {
    IntegrationType
} from "../shared/Integrations";

/**
 * Get the config field name for an integration type
 * e.g., IntegrationType.NOTION -> 'notionConfig'
 */
export function getIntegrationConfigFieldName(integration: IntegrationType): string {
    return `${integration}Config`;
}

/**
 * Clears all integration config fields from an object, optionally preserving one
 * @param obj - Object that may contain config fields
 * @param preserveIntegration - Optional integration type whose config should be preserved
 * @returns Object with all config fields cleared (except the preserved one)
 */
export function clearIntegrationConfigs<T extends Record<string, any>>(
    obj: T,
    preserveIntegration?: IntegrationType
): Partial<T> {
    const cleared: Partial<T> = {};
    const allIntegrations = Object.values(IntegrationType);

    for (const integration of allIntegrations) {
        const configField = getIntegrationConfigFieldName(integration) as keyof T;
        if (integration === preserveIntegration) {
            // Preserve the config for the specified integration
            if (obj[configField] !== undefined) {
                cleared[configField] = obj[configField];
            }
        } else {
            // Clear config for all other integrations
            cleared[configField] = undefined as any;
        }
    }

    return cleared;
}
