import { ConfigType } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { INTEGRATION_REGISTRY } from "./IntegrationRegistry";
import { ConfigSearchProvider, Integration } from "./Integration";
import { IntegrationInstance, IntegrationDetails } from "../../shared/Integrations";

/**
 * Get the ConfigSearchProvider for a given config type and integration ID
 */
export function getConfigSearchProvider(
    configType: ConfigType,
    integrationId: string
): ConfigSearchProvider | null {
    const integration = getIntegrationForConfig(configType, integrationId);
    return integration?.configSearchProvider || null;
}

/**
 * Get the Integration instance for a given config type and integration ID
 */
export function getIntegrationForConfig(
    configType: ConfigType,
    integrationId: string
): Integration<IntegrationInstance, any, IntegrationDetails> | null {
    // Map ConfigType to IntegrationType
    const configTypeToIntegrationType: Record<ConfigType, IntegrationType> = {
        [ConfigType.GMAIL]: IntegrationType.GMAIL,
        [ConfigType.FIGMA]: IntegrationType.FIGMA,
        [ConfigType.SLACK]: IntegrationType.SLACK,
        [ConfigType.NOTION_PAGE]: IntegrationType.NOTION,
        [ConfigType.NOTION_DATABASE]: IntegrationType.NOTION,
        [ConfigType.LINEAR_INPUT]: IntegrationType.LINEAR,
        [ConfigType.LINEAR_OUTPUT]: IntegrationType.LINEAR,
        [ConfigType.GITHUB]: IntegrationType.GITHUB,
        [ConfigType.GITHUB_KB]: IntegrationType.GITHUB,
        [ConfigType.JIRA]: IntegrationType.ATLASSIAN,
        [ConfigType.CONFLUENCE]: IntegrationType.ATLASSIAN,
        [ConfigType.POSTHOG]: IntegrationType.POSTHOG,
        [ConfigType.TIME_TRIGGER]: IntegrationType.CRON_JOB,
    };

    const integrationType = configTypeToIntegrationType[configType];
    if (!integrationType) {
        return null;
    }

    // Find integration in registry
    const integration = INTEGRATION_REGISTRY.find(
        (int) => int.integrationType === integrationType
    );

    return integration || null;
}
