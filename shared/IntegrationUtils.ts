import {
  Integration,
  IntegrationInstance,
  IntegrationMetadata,
  IntegrationsStatus,
  GithubIntegration,
  LinearIntegration,
  JiraIntegration,
  SlackIntegration,
  GmailIntegration,
  NotionIntegration,
} from './types';

// Re-export types for convenience
export type { Integration, IntegrationInstance, IntegrationMetadata };

/**
 * Metadata for each integration type including display names and descriptions
 */
export const INTEGRATION_METADATA: Record<Integration, IntegrationMetadata> = {
  [Integration.GMAIL]: {
    type: Integration.GMAIL,
    name: 'Gmail',
    description: 'Monitor incoming emails',
    inputDescription: 'Monitor incoming emails',
    outputDescription: 'Send email summaries',
  },
  [Integration.NOTION]: {
    type: Integration.NOTION,
    name: 'Notion',
    description: 'Update living documents',
    inputDescription: 'Watch page changes',
    outputDescription: 'Update a living page',
  },
  [Integration.LINEAR]: {
    type: Integration.LINEAR,
    name: 'Linear',
    description: 'Track ticket updates',
    inputDescription: 'Track ticket updates',
    outputDescription: 'Update project docs',
  },
  [Integration.JIRA]: {
    type: Integration.JIRA,
    name: 'Jira',
    description: 'Monitor issue changes',
    inputDescription: 'Monitor issue changes',
    outputDescription: 'Update project docs',
  },
  [Integration.SLACK]: {
    type: Integration.SLACK,
    name: 'Slack',
    description: 'Listen to messages',
    inputDescription: 'Monitor channel messages',
    outputDescription: 'Post to a channel',
  },
  [Integration.GITHUB]: {
    type: Integration.GITHUB,
    name: 'GitHub',
    description: 'Watch commits and PRs',
    inputDescription: 'Listen to commits, PRs, and issues',
    outputDescription: 'Update README or wiki',
  },
};

/**
 * Type-safe helper to get integration instances from IntegrationsStatus
 */
export function getIntegrationInstances<T extends Integration>(
  integrationData: IntegrationsStatus['integrations'],
  integrationType: T
): IntegrationInstance[] {
  const key = integrationType as keyof IntegrationsStatus['integrations'];
  return (integrationData[key] || []) as IntegrationInstance[];
}

/**
 * Type guard to check if an integration instance is of a specific type
 */
export function isIntegrationInstance<T extends IntegrationInstance>(
  integration: IntegrationInstance,
  type: Integration
): integration is T {
  switch (type) {
    case Integration.GITHUB:
      return 'repositoryName' in integration;
    case Integration.LINEAR:
      return 'linearTeamId' in integration;
    case Integration.JIRA:
      return 'baseUrl' in integration;
    case Integration.SLACK:
      return 'teamId' in integration;
    case Integration.GMAIL:
      return 'email' in integration && 'historyId' in integration;
    case Integration.NOTION:
      return 'databaseId' in integration;
    default:
      return false;
  }
}

/**
 * Format an integration instance for display in dropdowns and UI
 */
export function formatIntegrationDisplay(
  integration: IntegrationInstance,
  type: Integration
): string {
  switch (type) {
    case Integration.GMAIL: {
      const gmail = integration as GmailIntegration;
      return gmail.email || 'Unknown Email';
    }

    case Integration.NOTION: {
      const notion = integration as NotionIntegration;
      if (notion.workspaceName && notion.databaseName) {
        return `${notion.workspaceName} → ${notion.databaseName}`;
      }
      return notion.databaseName || notion.databaseId || 'Unknown Database';
    }

    case Integration.LINEAR: {
      const linear = integration as LinearIntegration;
      if (linear.workspaceName && linear.linearTeamName) {
        return `${linear.workspaceName} (${linear.linearTeamName})`;
      }
      return linear.workspaceName || 'Unknown Workspace';
    }

    case Integration.JIRA: {
      const jira = integration as JiraIntegration;
      if (jira.siteName && jira.projectName) {
        return `${jira.siteName} (${jira.projectName})`;
      }
      if (jira.siteName) {
        return jira.siteName;
      }
      return jira.baseUrl || 'Unknown Site';
    }

    case Integration.SLACK: {
      const slack = integration as SlackIntegration;
      return slack.teamName || 'Unknown Workspace';
    }

    case Integration.GITHUB: {
      const github = integration as GithubIntegration;
      if (github.owner && github.repositoryName) {
        return `${github.owner}/${github.repositoryName}`;
      }
      return github.repositoryName || 'Unknown Repository';
    }

    default:
      return integration.id;
  }
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
  return Object.values(INTEGRATION_METADATA).map((meta) => ({
    type: meta.type,
    name: meta.name,
    description: meta.inputDescription || meta.description,
  }));
}

/**
 * Get all integration metadata with output-specific descriptions
 */
export function getAllOutputIntegrationMetadata() {
  return Object.values(INTEGRATION_METADATA).map((meta) => ({
    type: meta.type,
    name: meta.name,
    description: meta.outputDescription || meta.description,
  }));
}

