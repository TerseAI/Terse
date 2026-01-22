import { Project, Ticket } from "./TicketSystem";
import { ConfigInstance, ConfigType } from "./Configs";
import { RunHistoryActionType } from "./RunHistoryTypes";
import { IntegrationType } from "./Integrations";

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
};

export type PosthogProject = {
  id: string;
  name: string;
  organization_id?: string;
};

export type PosthogProjectsResponse = {
  projects: PosthogProject[];
};

export type LaunchDarklyProject = {
  key: string;
  name: string;
};

export type LaunchDarklyProjectsResponse = {
  projects: LaunchDarklyProject[];
};

export type LaunchDarklyEnvironment = {
  key: string;
  name: string;
};

export type LaunchDarklyEnvironmentsResponse = {
  environments: LaunchDarklyEnvironment[];
};

export type DatadogIndex = {
  id: string;
  name: string;
  isEnabled: boolean;
  dailyLimit?: number;
  retentionDays?: number;
};

export type DatadogIndexesResponse = {
  indexes: DatadogIndex[];
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

export type SlackUserResponse = {
  id: string;
  name: string;
};

export type SlackUsersResponse = {
  users: SlackUserResponse[];
}

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

export type JiraResourcesResponse = {
  success: boolean;
  resources: {
    projects: Array<{ id: string; key: string; name: string; projectTypeKey: string }>;
    baseUrl: string;
    cloudId: string;
  };
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

/**
 * Figma positioning data structures
 * Represents the position and type of a comment in a Figma file
 */
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

export type AgentTrigger = {
  id: string;
  config: ConfigInstance;
};

export type AgentOutput = {
  id: string;
  config: ConfigInstance;
};

export type AgentPrompt = {
  text: string;
};

export type TransientAgentTrigger = {
  id: string;
  config?: ConfigInstance;
  configType: ConfigType;
};

export type TransientAgentOutput = {
  id: string;
  config?: ConfigInstance;
  configType: ConfigType;
};

export type AgentKnowledgeBase = {
    id: string;
    config: ConfigInstance;
};

export type TransientKnowledgeBase = {
    id: string;
    config?: ConfigInstance;
    configType: ConfigType;
};

// Template types - simplified config references without integrationId
export type TemplateConfigRef = {
    configType: ConfigType;
    integrationType: IntegrationType;
};

export type TemplateTrigger = {
    config: TemplateConfigRef;
};

export type TemplateOutput = {
    config: TemplateConfigRef;
};

export type TemplateKnowledgeBase = {
    config: TemplateConfigRef;
};

export type AgentTemplate = {
    name: string;
    description: string;
    prompt: AgentPrompt;
    triggers: TemplateTrigger[];
    outputs: TemplateOutput[];
    knowledgeBases?: TemplateKnowledgeBase[];
    requireApproval: boolean;
    isActive: boolean;
};

export type Agent = {
    id: string;
    name: string;
    isActive: boolean;
    requireApproval: boolean;
    prompt: AgentPrompt;
    triggers: AgentTrigger[];
    outputs: AgentOutput[];
    knowledgeBases?: AgentKnowledgeBase[];
    notificationSettings?: AgentNotificationSettings;
    updatedAt?: string;
};

export type AgentNotificationSettings = {
    enabled: boolean;
    actionTypes: RunHistoryActionType[];
};

export type AgentUpdate = {
    name?: string;
    triggers?: AgentTrigger[];
    outputs?: AgentOutput[];
    prompt?: AgentPrompt;
    isActive?: boolean;
    requireApproval?: boolean;
    knowledgeBases?: AgentKnowledgeBase[];
    notificationSettings?: AgentNotificationSettings;
};

export type AgentsResponse = {
    agents: Agent[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
};

export type RecentAgent = Agent & {
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

export enum DayOfWeek {
  Sun = "Sun",
  Mon = "Mon",
  Tue = "Tue",
  Wed = "Wed",
  Thu = "Thu",
  Fri = "Fri",
  Sat = "Sat",
}

export interface DailyEventCount {
  date: DayOfWeek;
  events: number;
}

export interface RecentAction {
  action: string;
  integration: IntegrationType; // IntegrationType as string
  target: string;
  details: string;
  url?: string;
  timestamp: string; // ISO date string
  agentName: string;
  type: RunHistoryActionType;
}

export interface StatsResponse {
  totalEventsProcessed: number;
  totalEventsProcessedChange: string; // Percentage change from previous period
  actionsTaken: number;
  actionsTakenChange: string; // Percentage change from previous period
  numberOfAgents: number;
  numberOfAgentsChange: string; // Absolute change (e.g., "+2")
  dailyEvents: DailyEventCount[]; // Events per day for the last 7 days
  recentActions: RecentAction[]; // Recent actions (last 10)
  timezone: string; // Timezone used for daily events grouping (e.g., "America/New_York" or "UTC")
}
