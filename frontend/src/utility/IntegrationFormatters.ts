import { Integration } from "../types/Integration";
import {
    GmailIntegration,
    NotionIntegration,
    SlackIntegration,
    LinearIntegration,
    JiraIntegration,
    GithubIntegration
} from "../shared/types";

/**
 * Union type for all integration instances using shared types
 */
export type IntegrationInstance =
    | GmailIntegration
    | NotionIntegration
    | SlackIntegration
    | LinearIntegration
    | JiraIntegration
    | GithubIntegration;

/**
 * Type guard functions for narrowing IntegrationInstance union
 */
function isGmailIntegration(integration: IntegrationInstance): integration is GmailIntegration {
    return 'email' in integration;
}

function isNotionIntegration(integration: IntegrationInstance): integration is NotionIntegration {
    return 'workspaceId' in integration || 'workspaceName' in integration || 'databaseId' in integration;
}

function isLinearIntegration(integration: IntegrationInstance): integration is LinearIntegration {
    return 'teamId' in integration || 'teamName' in integration;
}

function isJiraIntegration(integration: IntegrationInstance): integration is JiraIntegration {
    return 'baseUrl' in integration || 'siteName' in integration || 'projectKey' in integration;
}

function isSlackIntegration(integration: IntegrationInstance): integration is SlackIntegration {
    return 'teamId' in integration || 'teamName' in integration;
}

function isGithubIntegration(integration: IntegrationInstance): integration is GithubIntegration {
    // repositoryName is unique to GithubIntegration and required
    return 'repositoryName' in integration && !('email' in integration) && !('slackTeamId' in integration) && !('apiKey' in integration);
}

/**
 * Formats an integration instance for display in dropdowns and UI
 * Uses type narrowing based on the integration type
 */
export function formatIntegrationDisplay(
    integration: IntegrationInstance,
    type: Integration
): string {
    switch (type) {
        case Integration.GMAIL:
            if (isGmailIntegration(integration)) {
                return integration.email || 'Unknown Email';
            }
            return 'Unknown Email';

        case Integration.NOTION:
            if (isNotionIntegration(integration)) {
                return integration.workspaceName || integration.workspaceId || 'Unknown Workspace';
            }
            return 'Unknown Workspace';

        case Integration.LINEAR:
            if (isLinearIntegration(integration)) {
                if (integration.workspaceName && integration.linearTeamName) {
                    return `${integration.workspaceName} (${integration.linearTeamName})`;
                }
                return integration.workspaceName || 'Unknown Workspace';
            }
            return 'Unknown Workspace';

        case Integration.JIRA:
            if (isJiraIntegration(integration)) {
                if (integration.siteName && integration.projectName) {
                    return `${integration.siteName} (${integration.projectName})`;
                }
                if (integration.siteName) {
                    return integration.siteName;
                }
                return integration.baseUrl || 'Unknown Site';
            }
            return 'Unknown Site';

        case Integration.SLACK:
            console.log('integration', integration)
            if (isSlackIntegration(integration)) {
                return integration.teamName || 'Unknown Workspace';
            }
            return 'Unknown Workspace';

        case Integration.GITHUB:
            if (isGithubIntegration(integration)) {
                if (integration.owner && integration.repositoryName) {
                    return `${integration.owner}/${integration.repositoryName}`;
                }
                return integration.repositoryName || 'Unknown Repository';
            }
            return 'Unknown Repository';

        default:
            return integration.id;
    }
}