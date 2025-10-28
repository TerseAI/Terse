import { Integration } from "../context/Integrations";
import { IntegrationsStatus } from "../shared/types";

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
 */
export function getIntegrationInstances(
    integrationData: IntegrationsStatus['integrations'],
    integrationType: Integration
) {
    const key = INTEGRATION_KEY_MAP[integrationType];
    return integrationData[key] || [];
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
