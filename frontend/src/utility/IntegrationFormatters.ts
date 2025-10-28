import { Integration } from "../context/Integrations";

export interface IntegrationInstance {
    id: string;
    // Gmail
    email?: string;
    // Notion
    workspaceId?: string;
    workspaceName?: string;
    databaseId?: string;
    databaseName?: string;
    // Linear
    teamId?: string;
    teamName?: string;
    // Jira
    baseUrl?: string;
    siteName?: string;
    projectKey?: string;
    projectName?: string;
    // Slack
    teamId?: string;
    teamName?: string;
    // GitHub
    owner?: string;
    repositoryName?: string;
}

/**
 * Formats an integration instance for display in dropdowns and UI
 */
export function formatIntegrationDisplay(
    integration: IntegrationInstance,
    type: Integration
): string {
    switch (type) {
        case Integration.GMAIL:
            return integration.email || 'Unknown Email';

        case Integration.NOTION:
            if (integration.workspaceName && integration.databaseName) {
                return `${integration.workspaceName} → ${integration.databaseName}`;
            }
            return integration.databaseName || integration.databaseId || 'Unknown Database';

        case Integration.LINEAR:
            if (integration.workspaceName && integration.teamName) {
                return `${integration.workspaceName} (${integration.teamName})`;
            }
            return integration.workspaceName || 'Unknown Workspace';

        case Integration.JIRA:
            if (integration.siteName && integration.projectName) {
                return `${integration.siteName} (${integration.projectName})`;
            }
            if (integration.siteName) {
                return integration.siteName;
            }
            return integration.baseUrl || 'Unknown Site';

        case Integration.SLACK:
            return integration.teamName || 'Unknown Workspace';

        case Integration.GITHUB:
            if (integration.owner && integration.repositoryName) {
                return `${integration.owner}/${integration.repositoryName}`;
            }
            return integration.repositoryName || 'Unknown Repository';

        default:
            return integration.id;
    }
}

/**
 * Gets a short display name for an integration type
 */
export function getIntegrationTypeName(type: Integration): string {
    switch (type) {
        case Integration.GMAIL:
            return 'Gmail';
        case Integration.NOTION:
            return 'Notion';
        case Integration.LINEAR:
            return 'Linear';
        case Integration.JIRA:
            return 'Jira';
        case Integration.SLACK:
            return 'Slack';
        case Integration.GITHUB:
            return 'GitHub';
        default:
            return type;
    }
}

/**
 * Gets a description for an integration type
 */
export function getIntegrationTypeDescription(type: Integration): string {
    switch (type) {
        case Integration.GMAIL:
            return 'Monitor incoming emails';
        case Integration.NOTION:
            return 'Update living documents';
        case Integration.LINEAR:
            return 'Track ticket updates';
        case Integration.JIRA:
            return 'Monitor issue changes';
        case Integration.SLACK:
            return 'Listen to messages';
        case Integration.GITHUB:
            return 'Watch commits and PRs';
        default:
            return '';
    }
}
