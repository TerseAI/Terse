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

export type FigmaIntegration = {
  id: string;
  figma_user_id: string;
  token_expiry: Date;
};

export type ConfluenceIntegration = {
  id: string;
  confluence_user_email: string;
  base_url: string;
  api_key: string;
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

/**
 * Slack channel type enum
 */
export enum SlackChannelType {
  CHANNEL = 'channel',
  GROUP = 'group',
  MPIM = 'mpim',
  IM = 'im'
}

/**
 * Slack event data
 * Processed Slack message event data used for automation events
 */
export interface SlackEventData {
  channelId: string;
  channelName?: string;
  userId: string;
  userName?: string;
  text: string;
  timestamp: string;
  threadTimestamp?: string;
  teamId: string;
  // Permalink for the message (if available)
  permalink?: string;
  channelType?: SlackChannelType;
}

export type IntegrationsStatus = {
  integrations: {
    github?: GithubIntegration[];
    linear?: LinearIntegration[];
    jira?: JiraIntegration[];
    slack?: SlackIntegration[];
    gmail?: GmailIntegration[];
    notion?: NotionIntegration[];
    figma?: FigmaIntegration[];
    confluence?: ConfluenceIntegration[];
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

export type ConfluenceConfig = {
  spaceName?: string;
  spaceId?: string;
  pageId: string; // Page ID (required for outputs - specific page to write to)
  pageName?: string; // Page display name (for UI, optional)
};

export type ConfluencePage = {
  id: string;
  title: string;
  spaceId: string;
  spaceName: string;
  url?: string;
  status: string;
  version: number;
};

export type ConfluencePagesQuery = {
  integrationId: string; // Jira integration ID (required)
  spaceId?: string; // Space ID (optional, but either spaceId or spaceKey is required)
  spaceKey?: string; // Space key (optional, but either spaceId or spaceKey is required)
};

export type ConfluencePagesResponse = {
  pages: ConfluencePage[];
  spaceId: string;
  total: number;
};

export type ConfluenceResourcesResponse = {
  resources: ConfluencePage[];
  spaceId: string;
  total: number;
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
  fileName: string; // Optional display name
  teamId: string; // Figma team ID (required for webhook creation)
};

// Figma webhook and API types
export enum FigmaEventTypes {
  FILE_COMMENT = 'FILE_COMMENT',
}

/**
 * Figma webhook event user object
 */
export interface FigmaWebhookUser {
  id: string;
  handle: string;
  email: string;
  img_url: string;
}

/**
 * Figma webhook comment object (from webhook payload)
 */
export interface FigmaWebhookComment {
  id: string;
  message: string;
  client_meta: FigmaClientMeta;
  user: FigmaWebhookUser;
  created_at: string;
  resolved_at: string | null;
}

/**
 * Figma comment image URLs
 * Extracted images for visual context of comments
 */
export interface FigmaCommentImageUrls {
  nodeImage?: string;      // Image of the specific node the comment is on
  fullFrame?: string;      // Full frame/page image
}

export type FigmaVectorData = {
  x: number;
  y: number;
};

export type FigmaFrameOffsetData = {
  node_id: string;
  node_offset: { x: number; y: number };
};

export type FigmaRegionData = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FigmaFrameOffsetRegionData = {
  node_id: string;
  node_offset: { x: number; y: number };
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FigmaPositioningData =
  | { type: 'Vector'; data: FigmaVectorData }
  | { type: 'FrameOffset'; data: FigmaFrameOffsetData }
  | { type: 'Region'; data: FigmaRegionData }
  | { type: 'FrameOffsetRegion'; data: FigmaFrameOffsetRegionData };

/**
 * Figma client_meta structure
 * Represents the raw positioning metadata from Figma comment client_meta
 * Can be one of several positioning formats
 */
export type FigmaClientMeta = {
  // Vector: point coordinates
  x: number;
  y: number;
  // Region: rectangular area
  width: number;
  height: number;
  // FrameOffset: node with offset
  node_id: string;
  node_offset: { x: number; y: number };
};

/**
 * Figma webhook comment text object (from webhook payload)
 */
export interface FigmaWebhookCommentText {
  text: string;
}

/**
 * Raw Figma webhook event payload
 * Generated from actual Figma webhook payload structure
 */
export interface FigmaWebhookEvent {
  event_type: string;
  file_key: string;
  file_name: string;
  passcode: string;
  protocol_version: string;
  webhook_id: string;
  timestamp: string;
  retries: number;
  // FILE_COMMENT specific fields
  comment_id: string;
  comment: FigmaWebhookCommentText[];
  created_at: string;
  resolved_at: string; // Empty string if not resolved
  parent_id: string; // Empty string if no parent
  order_id: string;
  mentions: unknown[]; // Array of mention objects (structure unknown)
  triggered_by: FigmaWebhookUser;
}

/**
 * Figma API comment response structure
 */
export interface FigmaApiComment {
  id: string;
  message: string;
  client_meta: FigmaClientMeta | null;
  user: FigmaWebhookUser;
  created_at: string;
  resolved_at: string | null;
  parent_id?: string | null;
  order_id?: string;
  mentions?: unknown[];
  reactions?: unknown[];
}

export interface FigmaCommentThreadEntry {
  id: string;
  message: string;
  author: FigmaWebhookUser;
  createdAt: string;
  resolvedAt: string | null;
  parentId: string | null;
  orderId?: string;
  isRoot?: boolean;
}

/**
 * Figma comment event data
 * Processed/enriched comment data used for automation events
 * This combines data from webhook, API, and enriched context
 */
export interface FigmaCommentEventData {
  commentId: string;
  fileKey: string;
  fileUrl: string;
  nodeId?: string; // Node ID the comment is attached to (if any)
  message: string;
  author: FigmaWebhookUser;
  createdAt: string;
  resolved?: boolean;
  thread?: FigmaCommentThreadEntry[];
  // Enriched context (optional - added during processing)
  fileMetadata?: any;
  // Positioning and visual context (optional - added during enrichment)
  positioningData?: FigmaPositioningData;
  matchedNodeIds?: string[];
  imageUrls?: FigmaCommentImageUrls;
}

export type AutomationInput = {
  integration: string;
  integrationId?: string;
  // Typed config based on integration type
  slackConfig?: SlackConfig;
  notionConfig?: NotionConfig;
  linearConfig?: LinearConfig;
  jiraConfig?: JiraConfig;
  confluenceConfig?: ConfluenceConfig;
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
  confluenceConfig?: ConfluenceConfig;
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
