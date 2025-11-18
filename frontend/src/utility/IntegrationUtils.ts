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

/**
 * Checks if an input integration configuration is complete
 * Each integration type defines its own completeness requirements
 */
export function isInputComplete(input: { integration: IntegrationType; integrationId?: string;[key: string]: any }): boolean {
    // Base requirement: IntegrationType type and ID must be set
    if (!input.integration || !input.integrationId) {
        return false;
    }

    // Integration-specific completeness checks
    switch (input.integration) {
        case IntegrationType.FIGMA:
            // Figma requires both fileKey and teamId
            const figmaConfig = input.figmaConfig;
            return !!(figmaConfig?.fileKey && figmaConfig?.teamId);

        case IntegrationType.SLACK:
            // Slack is complete if either channelId is set OR listenToUserDms is true
            const slackConfig = input.slackConfig;
            return !!(slackConfig?.channelId || slackConfig?.listenToUserDms);

        case IntegrationType.NOTION:
            // case IntegrationType.NOTION_PAGE:
            // Notion requires databaseId or pageId
            const notionConfig = input.notionConfig;
            const notionPageConfig = input.notionPageConfig;
            return !!(notionConfig?.databaseId || notionPageConfig?.pageId);

        case IntegrationType.GMAIL:
        case IntegrationType.GITHUB:
        case IntegrationType.LINEAR:
        case IntegrationType.ATLASSIAN:
            // These integrations don't require additional config beyond integrationId
            return true;

        default:
            return true;
    }
}

/**
 * Checks if an output integration configuration is complete
 * Each integration type defines its own completeness requirements
 */
export function isOutputComplete(output: { integration: IntegrationType; integrationId?: string;[key: string]: any }): boolean {
    // Base requirement: IntegrationType type and ID must be set
    if (!output.integration || !output.integrationId) {
        return false;
    }

    // Integration-specific completeness checks
    switch (output.integration) {
        case IntegrationType.NOTION:
            // Notion output requires databaseId
            return !!(output.notionConfig?.databaseId);

        // case IntegrationType.NOTION_PAGE:
        //     // Notion Page output requires pageId
        //     return !!(output.notionPageConfig?.pageId);

        case IntegrationType.SLACK:
            // Slack output requires channelId
            return !!(output.slackConfig?.channelId);

        case IntegrationType.GMAIL:
        case IntegrationType.GITHUB:
        case IntegrationType.LINEAR:
        case IntegrationType.ATLASSIAN:
        case IntegrationType.FIGMA:
            // These integrations don't require additional config beyond integrationId
            return true;

        default:
            return true;
    }
}
