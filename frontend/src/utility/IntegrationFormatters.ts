import { IntegrationType } from "../shared/Integrations"
import {
    GmailIntegration,
    NotionIntegration,
    SlackIntegration,
    LinearIntegration,
    JiraIntegration,
    GithubIntegration,
    FigmaIntegration,
    ConfluenceIntegration,
    INTEGRATION_METADATA,
} from "../shared/Integrations";

/**
 * Type guard functions for narrowing IntegrationInstance union
 */
function isGmailIntegration(integration: IntegrationInstance): Integration is GmailIntegration {
    return 'email' in integration;
}

export function isNotionIntegration(integration: IntegrationInstance): Integration is NotionIntegration {
    return 'workspaceId' in integration || 'workspaceName' in integration || 'databaseId' in integration;
}

function isLinearIntegration(integration: IntegrationInstance): Integration is LinearIntegration {
    return 'teamId' in integration || 'teamName' in integration;
}

function isJiraIntegration(integration: IntegrationInstance): IntegrationType is JiraIntegration {
    return 'baseUrl' in integration || 'siteName' in integration || 'projectKey' in integration;
}

function isSlackIntegration(integration: IntegrationInstance): IntegrationType is SlackIntegration {
    return 'teamId' in integration || 'teamName' in integration;
}

function isGithubIntegration(integration: IntegrationInstance): IntegrationType is GithubIntegration {
    // repositoryName is unique to GithubIntegration and required
    return 'repositoryName' in integration && !('email' in integration) && !('slackTeamId' in integration) && !('apiKey' in integration);
}

function isFigmaIntegration(integration: IntegrationInstance): IntegrationType is FigmaIntegration {
    return 'figma_user_id' in integration || 'token_expiry' in integration;
}

function isConfluenceIntegration(integration: IntegrationInstance): IntegrationType is ConfluenceIntegration {
    return 'base_url' in integration || 'email' in integration;
}

/**
 * Formats an integration instance for display in dropdowns and UI
 * Uses type narrowing based on the integration type
 */
export function formatIntegrationDisplay(
    integration: IntegrationInstance,
    type: IntegrationType
): string {
    switch (type) {
        case IntegrationType.GMAIL:
            if (isGmailIntegration(integration)) {
                return Integration.email || 'Unknown Email';
            }
            return 'Unknown Email';

        case IntegrationType.NOTION:
            if (isNotionIntegration(integration)) {
                return IntegrationType.workspaceName || IntegrationType.workspaceId || 'Unknown Workspace';
            }
            return 'Unknown Workspace';

        case IntegrationType.LINEAR:
            if (isLinearIntegration(integration)) {
                if (IntegrationType.workspaceName && IntegrationType.linearTeamName) {
                    return `${IntegrationType.workspaceName} (${IntegrationType.linearTeamName})`;
                }
                return IntegrationType.workspaceName || 'Unknown Workspace';
            }
            return 'Unknown Workspace';

        case IntegrationType.JIRA:
            if (isJiraIntegration(integration)) {
                if (IntegrationType.siteName && IntegrationType.projectName) {
                    return `${IntegrationType.siteName} (${IntegrationType.projectName})`;
                }
                if (IntegrationType.siteName) {
                    return IntegrationType.siteName;
                }
                return IntegrationType.baseUrl || 'Unknown Site';
            }
            return 'Unknown Site';

        case IntegrationType.SLACK:
            if (isSlackIntegration(integration)) {
                return IntegrationType.teamName || 'Unknown Workspace';
            }
            return 'Unknown Workspace';

        case IntegrationType.GITHUB:
            if (isGithubIntegration(integration)) {
                if (IntegrationType.owner && IntegrationType.repositoryName) {
                    return `Repositories connected to: ${IntegrationType.owner}`;
                }
                return IntegrationType.repositoryName || 'Unknown Repository';
            }
            return 'No repositories connected';

        case IntegrationType.FIGMA:
            if (isFigmaIntegration(integration)) {
                return IntegrationType.figma_user_id || 'Figma Account';
            }
            return 'Figma Account';

        default:
            return IntegrationType.id;

        case IntegrationType.CONFLUENCE:
            if (isConfluenceIntegration(integration)) {
                return IntegrationType.base_url || IntegrationType.confluence_user_email || 'Confluence Account';
            }
            return 'Confluence Account';
    }
}

/**
 * Get display name for an integration type
 */
export function getIntegrationTypeName(type: IntegrationType): string {
    return INTEGRATION_METADATA[type].name;
}