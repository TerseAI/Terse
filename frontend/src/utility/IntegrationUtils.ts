import { Integration } from "../types/Integration";
import { 
    IntegrationsStatus,
    GmailIntegration,
    NotionIntegration,
    SlackIntegration,
    LinearIntegration,
    JiraIntegration,
    GithubIntegration,
    FigmaIntegration
} from "../shared/types";

/**
 * Type-safe mapping from Integration enum to IntegrationsStatus keys
 */
export const INTEGRATION_KEY_MAP: Record<Integration, keyof IntegrationsStatus['integrations']> = {
    [Integration.GMAIL]: 'gmail',
    [Integration.NOTION]: 'notion',
    [Integration.NOTION_PAGE]: 'notion', // Poin the notion page stuff to the notion integration
    [Integration.LINEAR]: 'linear',
    [Integration.JIRA]: 'jira',
    [Integration.SLACK]: 'slack',
    [Integration.GITHUB]: 'github',
    [Integration.FIGMA]: 'figma',
};

/**
 * Type mapping from Integration enum to the corresponding integration type
 */
type IntegrationTypeMap = {
    [Integration.GMAIL]: GmailIntegration[];
    [Integration.NOTION]: NotionIntegration[];
    [Integration.NOTION_PAGE]: NotionIntegration[];
    [Integration.LINEAR]: LinearIntegration[];
    [Integration.JIRA]: JiraIntegration[];
    [Integration.SLACK]: SlackIntegration[];
    [Integration.GITHUB]: GithubIntegration[];
    [Integration.FIGMA]: FigmaIntegration[];
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
    isInput?: boolean;
    isOutput?: boolean;
}

export const INTEGRATION_METADATA: Record<Integration, IntegrationMetadata> = {
    [Integration.GMAIL]: {
        type: Integration.GMAIL,
        name: 'Gmail',
        description: 'Monitor incoming emails',
        inputDescription: 'Monitor incoming emails',
        isInput: true,
        isOutput: false
    },
    [Integration.NOTION]: {
        type: Integration.NOTION,
        name: 'Notion',
        description: 'Update living documents',
        outputDescription: 'Update a living page',
        isInput: false,
        isOutput: true
    },
    [Integration.NOTION_PAGE]: {
        type: Integration.NOTION_PAGE,
        name: 'Notion Page',
        description: 'Update a living page',
        outputDescription: 'Update a living page',
        isInput: false,
        isOutput: true
    },
    [Integration.LINEAR]: {
        type: Integration.LINEAR,
        name: 'Linear',
        description: 'Track ticket updates',
        inputDescription: 'Track ticket updates',
        outputDescription: 'Update project docs',
        isInput: false,
        isOutput: false
    },
    [Integration.JIRA]: {
        type: Integration.JIRA,
        name: 'Jira',
        description: 'Monitor issue changes',
        inputDescription: 'Monitor issue changes',
        outputDescription: 'Update project docs and tickets',
        isInput: false,
        isOutput: false
    },
    [Integration.SLACK]: {
        type: Integration.SLACK,
        name: 'Slack',
        description: 'Listen to messages',
        inputDescription: 'Monitor channel messages',
        outputDescription: 'Post to a channel',
        isInput: true,
        isOutput: false
    },
    [Integration.GITHUB]: {
        type: Integration.GITHUB,
        name: 'GitHub',
        description: 'Watch commits and PRs',
        inputDescription: 'Listen to commits, PRs, and issues',
        isInput: true,
        isOutput: false
    },
    [Integration.FIGMA]: {
        type: Integration.FIGMA,
        name: 'Figma',
        description: 'Monitor comments on design files',
        inputDescription: 'Monitor comments on Figma design files',
        isInput: true,
        isOutput: false
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
    return Object.values(INTEGRATION_METADATA).filter(meta => meta.isInput === true).map(meta => ({
        type: meta.type,
        name: meta.name,
        description: meta.inputDescription || meta.description
    }));
}

/**
 * Get all integration metadata with output-specific descriptions
 */
export function getAllOutputIntegrationMetadata() {
    return Object.values(INTEGRATION_METADATA).filter(meta => meta.isOutput === true).map(meta => ({
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
