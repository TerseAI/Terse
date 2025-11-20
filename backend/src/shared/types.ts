import { Project, Ticket } from "./TicketSystem";
import { ConfigInstance, ConfigType } from "./Configs";

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

export type LinearTeam = {
  id: string;
  name: string;
  key: string;
};

export type LinearWorkspace = {
  id: string;
  name: string;
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


export type ConfluencePage = {
  id: string;
  title: string;
  spaceId: string;
  spaceName: string;
  url: string;
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

export type UseConfluenceResourcesReturn<MutateType = any> = {
  resources: ConfluencePage[];
  response: ConfluenceResourcesResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isValidating: boolean;
  mutate: MutateType;
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
  id: string;
  config: ConfigInstance;
};

export type AutomationOutput = {
  id: string;
  config: ConfigInstance;
};

export type AutomationPrompt = {
  text: string;
};

export type TransientAutomationInput = {
  id: string;
  config?: ConfigInstance;
  configType: ConfigType;
};

export type TransientAutomationOutput = {
  id: string;
  config?: ConfigInstance;
  configType: ConfigType;
};

export type Automation = {
    id: string;
    name: string;
    isActive: boolean;
    prompt: AutomationPrompt;
    inputs: AutomationInput[];
    output: AutomationOutput;
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

export type RecentAutomation = Automation & {
  updatedAt: string;
  lastEventProcessedAt: string | null;
};

export type GithubAppInstallationCallbackRequest = {
  name: string;
  email: string;
  username: string;
  installationId: number;
  accountName: string | null;
  repositories: Repository[];
}

export type Repository = {
  name: string;
  owner: string;
  id: number; // This is the official id from github! Not to be confused with the id from github_repositories table in the DB!!!
}

export type GetGithubRepositoriesForIntegrationRequest = {
}

export type GetGithubRepositoriesForIntegrationResponse = {
  repositories: Repository[];
}

export type OAuthInstallationDetails = {
  oauthUrl: string;
}

export interface StatsResponse {
  totalEventsProcessed: number;
  totalEventsProcessedChange: string; // Percentage change from previous period
  actionsTaken: number;
  actionsTakenChange: string; // Percentage change from previous period
  numberOfAutomations: number;
  numberOfAutomationsChange: string; // Absolute change (e.g., "+2")
}