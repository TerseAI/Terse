import { Project, Ticket } from "./TicketSystem";

export type User = {
  id: string;
  email: string;
  display_name: string;
  github_username: string | null;
  is_placeholder: boolean;
};

export type SubActivity = {
  summary: string;
  commits: CommitAssociation[];
};

export type CommitAssociation = {
  sha: string;
  message: string;
  url: string;
};

export type ActivityEvent = {
  event_type: string;
  title: string;
  github_repository_owner_id: string;
  github_repository_name: string;
  created_at: Date;
  sub_activities: SubActivity[];
};

export type TicketActivityEvent = {
  ticket: Ticket;
  event_type: string;
  title: string;
};

export type ProjectActivityEvent = {
  project: Project;
  event_type: string;
  title: string;
};

export type GithubIntegration = {
  id: string;
  repositoryName: string;
  owner?: string;
};

export type LinearIntegration = {
  id: string;
  apiKey: string;
  workspaceName?: string;
  linearTeamId?: string;
  linearTeamName?: string;
};

export type LinearTeam = {
  id: string;
  name: string;
  key: string;
};

export type LinearWorkspace = {
  id: string;
  name: string;
};

export type LinearApiKeyValidationResponse = {
  valid: boolean;
  workspace?: LinearWorkspace;
  teams?: LinearTeam[];
  error?: string;
};

export type JiraIntegration = {
  id: string;
  apiKey: string;
  baseUrl: string;
  email: string;
  siteName?: string;
  projectKey?: string;
  projectName?: string;
};

export type JiraProject = {
  id: string;
  key: string;
  name: string;
};

export type JiraCredentialsValidationResponse = {
  valid: boolean;
  projects?: JiraProject[];
  error?: string;
};

export type SlackIntegration = {
  id: string;
  teamId?: string;
  teamName?: string;
};

export type GmailIntegration = {
  id: string;
  email: string; // User's Gmail address
  historyId: string; // For tracking changes since last sync
  watchExpiration: Date; // When the watch needs to be renewed (max 7 days)
};

export type NotionIntegration = {
  id: string;
  integrationToken: string;
  workspaceId?: string;
  workspaceName?: string;
};

export type NotionResourceType = 'database' | 'page';
export type NotionResource = {
  id: string;
  title: string;
  url: string;
  type: NotionResourceType;
};

export type NotionResourcesResponse = {
  resources: NotionResource[];
  selectedResourceId: string | null;
  selectedResourceType: NotionResourceType;
};

export type SlackChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
  isArchived: boolean;
  isMPIM: boolean;
};

export type SlackChannelsResponse = {
  channels: SlackChannel[];
  selectedChannelId: string | null;
};

export type IntegrationsStatus = {
  integrations: {
    github?: GithubIntegration[];
    linear?: LinearIntegration[];
    jira?: JiraIntegration[];
    slack?: SlackIntegration[];
    gmail?: GmailIntegration[];
    notion?: NotionIntegration[];
  };
};

// Typed config per integration type
export type SlackConfig = {
  channelId?: string;
  channelName?: string;
  listenToUserDms?: boolean;
};

export type NotionConfig = {
  databaseId?: string;
  databaseName?: string;
};

export type NotionPageConfig = {
  pageId?: string;
  pageName?: string;
};

export type LinearConfig = {
  projectId?: string;
  projectName?: string;
};

export type JiraConfig = {
  projectKey?: string;
  projectId?: string;
};

export type GitHubConfig = {
  repositoryId?: string;
  // Note: owner and name not needed - they're part of repository identity
  // Future: branch, path filters
};

export type GmailConfig = {
  // Currently empty, but typed for future extensibility
};

export type FigmaConfig = {
  fileKey: string;
  fileName?: string; // Optional display name
  teamId?: string; // Figma team ID (required for webhook creation)
};

export type AutomationInput = {
  integration: string;
  integrationId?: string;
  // Typed config based on integration type
  slackConfig?: SlackConfig;
  notionConfig?: NotionConfig;
  linearConfig?: LinearConfig;
  jiraConfig?: JiraConfig;
  githubConfig?: GitHubConfig;
  gmailConfig?: GmailConfig;
  figmaConfig?: FigmaConfig;
};

export type AutomationOutput = {
  integration: string;
  integrationId?: string;
  // Typed config based on integration type
  slackConfig?: SlackConfig;
  notionConfig?: NotionConfig;
  notionPageConfig?: NotionPageConfig;
  linearConfig?: LinearConfig;
  jiraConfig?: JiraConfig;
  githubConfig?: GitHubConfig;
  gmailConfig?: GmailConfig;
  figmaConfig?: FigmaConfig;
};

export type AutomationPrompt = {
  text: string;
};

export type Automation = {
    id: string;
    name: string;
    isActive: boolean;
    prompt?: AutomationPrompt;
    inputs: AutomationInput[];
    output?: AutomationOutput;
};

export type AutomationUpdate = {
    name?: string;
    inputs?: AutomationInput[];
    output?: AutomationOutput;
    prompt?: AutomationPrompt;
    isActive?: boolean;
};

export type AutomationsResponse = {
    automations: Automation[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
};
