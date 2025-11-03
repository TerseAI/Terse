import { Integration } from "../types/Integration";
import { 
    IntegrationsStatus,
    GmailIntegration,
    NotionIntegration,
    SlackIntegration,
    LinearIntegration,
    JiraIntegration,
    GithubIntegration
} from "../shared/types";

/**
 * Type-safe mapping from Integration enum to IntegrationsStatus keys
 */
export const INTEGRATION_KEY_MAP: Record<Integration, keyof IntegrationsStatus['integrations']> = {
    [Integration.GMAIL]: 'gmail',
    [Integration.NOTION]: 'notion',
    [Integration.LINEAR]: 'linear',
    [Integration.JIRA]: 'jira',
    [Integration.SLACK]: 'slack',
    [Integration.GITHUB]: 'github',
};

/**
 * Type mapping from Integration enum to the corresponding integration type
 */
type IntegrationTypeMap = {
    [Integration.GMAIL]: GmailIntegration[];
    [Integration.NOTION]: NotionIntegration[];
    [Integration.LINEAR]: LinearIntegration[];
    [Integration.JIRA]: JiraIntegration[];
    [Integration.SLACK]: SlackIntegration[];
    [Integration.GITHUB]: GithubIntegration[];
};

/**
 * Integration metadata including display names and descriptions
 */
export interface IntegrationMetadata {
    type: Integration;
    name: string;
    description: string;
    inputDescription?: string;
    outputDescription?: string;
}

export const INTEGRATION_METADATA: Record<Integration, IntegrationMetadata> = {
    [Integration.GMAIL]: {
        type: Integration.GMAIL,
        name: 'Gmail',
        description: 'Monitor incoming emails',
        inputDescription: 'Monitor incoming emails',
        outputDescription: 'Send email summaries'
    },
    [Integration.NOTION]: {
        type: Integration.NOTION,
        name: 'Notion',
        description: 'Update living documents',
        inputDescription: 'Watch page changes',
        outputDescription: 'Update a living page'
    },
    [Integration.LINEAR]: {
        type: Integration.LINEAR,
        name: 'Linear',
        description: 'Track ticket updates',
        inputDescription: 'Track ticket updates',
        outputDescription: 'Update project docs'
    },
    [Integration.JIRA]: {
        type: Integration.JIRA,
        name: 'Jira',
        description: 'Monitor issue changes',
        inputDescription: 'Monitor issue changes',
        outputDescription: 'Update project docs'
    },
    [Integration.SLACK]: {
        type: Integration.SLACK,
        name: 'Slack',
        description: 'Listen to messages',
        inputDescription: 'Monitor channel messages',
        outputDescription: 'Post to a channel'
    },
    [Integration.GITHUB]: {
        type: Integration.GITHUB,
        name: 'GitHub',
        description: 'Watch commits and PRs',
        inputDescription: 'Listen to commits, PRs, and issues',
        outputDescription: 'Update README or wiki'
    }
};

/**
 * Get the integration instances from IntegrationsStatus for a given integration type
 * Returns a properly typed array based on the integration type
 */
export function getIntegrationInstances<T extends Integration>(
    integrationData: IntegrationsStatus['integrations'],
    integrationType: T
): IntegrationTypeMap[T] {
    const key = INTEGRATION_KEY_MAP[integrationType];
    return (integrationData[key] || []) as IntegrationTypeMap[T];
}

/**
 * Get display name for an integration type
 */
export function getIntegrationName(type: Integration): string {
    return INTEGRATION_METADATA[type].name;
}

/**
 * Get description for an integration type
 */
export function getIntegrationDescription(type: Integration): string {
    return INTEGRATION_METADATA[type].description;
}

/**
 * Get all integration metadata
 */
export function getAllIntegrationMetadata(): IntegrationMetadata[] {
    return Object.values(INTEGRATION_METADATA);
}

/**
 * Get all integration metadata with input-specific descriptions
 */
export function getAllInputIntegrationMetadata() {
    return Object.values(INTEGRATION_METADATA).map(meta => ({
        type: meta.type,
        name: meta.name,
        description: meta.inputDescription || meta.description
    }));
}

/**
 * Get all integration metadata with output-specific descriptions
 */
export function getAllOutputIntegrationMetadata() {
    return Object.values(INTEGRATION_METADATA).map(meta => ({
        type: meta.type,
        name: meta.name,
        description: meta.outputDescription || meta.description
    }));
}

/**
 * Get the config field name for an integration type
 * e.g., Integration.NOTION -> 'notionConfig'
 */
export function getIntegrationConfigFieldName(integration: Integration): string {
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
    preserveIntegration?: Integration
): Partial<T> {
    const cleared: Partial<T> = {};
    const allIntegrations = Object.values(Integration);
    
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
