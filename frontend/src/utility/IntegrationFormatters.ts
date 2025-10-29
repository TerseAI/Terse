import { Integration } from "../types/Integration";
import {
    getIntegrationName,
    getIntegrationDescription
} from "./IntegrationUtils";

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
    linearTeamId?: string;
    linearTeamName?: string;
    // Jira
    baseUrl?: string;
    siteName?: string;
    projectKey?: string;
    projectName?: string;
    // Slack
    slackTeamId?: string;
    slackTeamName?: string;
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
            if (integration.workspaceName && integration.linearTeamName) {
                return `${integration.workspaceName} (${integration.linearTeamName})`;
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
            return integration.slackTeamName || 'Unknown Workspace';

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
 * @deprecated Use getIntegrationName from IntegrationUtils instead
 */
export function getIntegrationTypeName(type: Integration): string {
    return getIntegrationName(type);
}

/**
 * Gets a description for an integration type
 * @deprecated Use getIntegrationDescription from IntegrationUtils instead
 */
export function getIntegrationTypeDescription(type: Integration): string {
    return getIntegrationDescription(type);
}
