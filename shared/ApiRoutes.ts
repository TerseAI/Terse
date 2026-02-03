/**
 * API route path constants
 *
 * These constants standardize API route paths across frontend and backend,
 * preventing magic strings and making refactoring easier.
 *
 * Dynamic routes use route objects with both Express patterns and URL builders
 * to ensure frontend and backend stay in sync.
 */

// Type definitions for route objects

export const ApiRoutes = {
  // Authentication routes
  AUTH: {
    ME: "/me",
    LOGIN: "/login",
    LOGOUT: "/logout",
    GITHUB_APP_CALLBACK: "/auth/github-app/callback",
    WORKOS_CALLBACK: "/auth/workos/callback",
  },

  WORKOS: {
    WIDGET_TOKEN: "/auth/workos/widget-token",
  },

  ORGANIZATIONS: {
    CREATE: "/organizations",
    GET_CURRENT: "/organizations/current",
    LIST: "/organizations",
    SWITCH: "/organizations/switch",
  },

  // Stats routes
  STATS: "/stats",

  // Run history routes
  RUN_HISTORY: {
    ACTIONS: "/run-history/actions",
    BY_AGENT_ID: {
      pattern: "/run-history/:agentId",
      build: (agentId: string) => `/run-history/${encodeURIComponent(agentId)}`,
      params: { agentId: "string" } as const,
    },
    CHAT_BY_RUN_ID: {
      pattern: "/run-history/:runId/chat",
      build: (runId: string) =>
        `/run-history/${encodeURIComponent(runId)}/chat`,
      params: { runId: "string" } as const,
    },
  },

  // Session routes
  SESSION: {
    TOKEN: "/session/token",
  },

  // GitHub routes
  GITHUB: {
    INTEGRATIONS: "/github/integrations",
    INSTALLATION_URL: "/github/installation-url",
    GET_REPOSITORIES_FOR_INTEGRATION:
      "/github/get-repositories-for-integration",
    INSTALLATION_CALLBACK: "/github/installation-callback",
    INSTALLATION_DELETED: "/github/installation-deleted",
    UNIFIED_EVENT: "/github/unified-event",
  },

  // Atlassian/Jira routes
  ATLASSIAN: {
    INTEGRATIONS: "/atlassian/integrations",
    OAUTH_CALLBACK: "/atlassian/oauth/callback",
  },

  JIRA: {
    RESOURCES: "/jira/resources",
    GET_API_KEY: "/jira/get-api-key",
    SET_API_KEY: "/jira/set-api-key",
    VALIDATE_AND_FETCH_PROJECTS: "/jira/validate-and-fetch-projects",
    DELETE_CREDENTIALS: "/jira/delete-credentials",
  },

  // Confluence routes
  CONFLUENCE: {
    INTEGRATIONS: "/confluence/integrations",
    RESOURCES: "/confluence/resources",
  },

  // Gmail routes
  GMAIL: {
    INTEGRATIONS: "/gmail/integrations",
    CALLBACK: "/gmail/callback",
    DELETE_INTEGRATION: "/gmail/delete-integration",
  },

  // Notion routes
  NOTION: {
    INTEGRATIONS: "/notion/integrations",
    OAUTH_CALLBACK: "/notion/oauth/callback",
    RESOURCES: "/notion/resources",
    DELETE_INTEGRATION: "/notion/delete-integration",
  },

  // Figma routes
  FIGMA: {
    INTEGRATIONS: "/figma/integrations",
    OAUTH_CALLBACK: "/figma/oauth/callback",
  },

  // Linear routes
  LINEAR: {
    OAUTH_CALLBACK: "/linear/oauth/callback",
    WEBHOOK: "/linear/webhook",
    INTEGRATIONS: "/linear/integrations",
    TEAMS: "/linear/teams",
  },

  // Slack routes
  SLACK: {
    INTEGRATIONS: "/slack/integrations",
    GET_CURRENT_INTEGRATION: "/slack/get-current-integration",
    OAUTH_CALLBACK: "/slack/oauth-callback",
    CHANNELS: "/slack/channels",
    USERS: "/slack/users",
    EVENTS: "/slack/events",
  },

  // Posthog routes
  POSTHOG: {
    INTEGRATIONS: "/posthog/integrations",
    PROJECTS: "/posthog/projects",
  },

  // LaunchDarkly routes
  LAUNCHDARKLY: {
    INTEGRATIONS: "/launchdarkly/integrations",
    PROJECTS_BY_INTEGRATION_ID: {
      pattern: "/launchdarkly/integrations/:integrationId/projects",
      build: (integrationId: string) =>
        `/launchdarkly/integrations/${encodeURIComponent(
          integrationId,
        )}/projects`,
      params: { integrationId: "string" } as const,
    },
    ENVIRONMENTS_BY_INTEGRATION_AND_PROJECT: {
      pattern:
        "/launchdarkly/integrations/:integrationId/projects/:projectKey/environments",
      build: (integrationId: string, projectKey: string) =>
        `/launchdarkly/integrations/${encodeURIComponent(
          integrationId,
        )}/projects/${encodeURIComponent(projectKey)}/environments`,
      params: { integrationId: "string", projectKey: "string" } as const,
    },
  },

  // Datadog routes
  DATADOG: {
    INTEGRATIONS: "/datadog/integrations",
    INDEXES: "/datadog/indexes",
  },

  // Agents routes
  AGENTS: {
    LIST: "/agents",
    RECENT: "/agents/recent",
    BY_ID: {
      pattern: "/agents/:id",
      build: (id: string) => `/agents/${encodeURIComponent(id)}`,
      params: { id: "string" } as const,
    },
  },

  // Templates routes
  TEMPLATES: "/templates",
  PUBLIC: {
    TEMPLATES: "/public/templates",
  },

  // Prompt builder routes
  PROMPT_BUILDER: {
    GENERATE_QUESTIONS: "/prompt-builder/generate-questions",
    GENERATE_PROMPT: "/prompt-builder/generate-prompt",
  },

  // Tools routes
  TOOLS: {
    THAT_REQUIRE_APPROVALS: "/tools/that-require-approvals",
  },

  // Integrations routes
  INTEGRATIONS: {
    INSTALLATION_DETAILS_BY_TYPE: {
      pattern: "/integrations/:integrationType/installation-details",
      build: (integrationType: string) =>
        `/integrations/${encodeURIComponent(
          integrationType,
        )}/installation-details`,
      params: { integrationType: "string" } as const,
    },
    LIST: "/integrations",
    ACTIVE: "/integrations/active",
  },

  // Notification destinations routes
  NOTIFICATION_DESTINATIONS: {
    LIST: "/notification-destinations",
    BY_ID: {
      pattern: "/notification-destinations/:id",
      build: (id: string) =>
        `/notification-destinations/${encodeURIComponent(id)}`,
      params: { id: "string" } as const,
    },
  },

  // Webhooks routes
  WEBHOOKS: {
    GMAIL: "/webhooks/gmail",
    FIGMA: "/webhooks/figma",
    WORKOS: "/webhooks/workos",
    JIRA_BY_ACCOUNT_ID: {
      pattern: "/webhooks/jira/:accountId",
      build: (accountId: string) =>
        `/webhooks/jira/${encodeURIComponent(accountId)}`,
      params: { accountId: "string" } as const,
    },
    LINEAR_BY_USER_ID: {
      pattern: "/webhooks/linear/:userId",
      build: (userId: string) =>
        `/webhooks/linear/${encodeURIComponent(userId)}`,
      params: { userId: "string" } as const,
    },
    SCHEDULE_BY_INPUT_ID: {
      pattern: "/webhooks/schedule/:inputId",
      build: (inputId: string) =>
        `/webhooks/schedule/${encodeURIComponent(inputId)}`,
      params: { inputId: "string" } as const,
    },
  },

  // Schedule routes
  SCHEDULE: {
    TRIGGER_BY_INPUT_ID: {
      pattern: "/schedule/trigger/:inputId",
      build: (inputId: string) =>
        `/schedule/trigger/${encodeURIComponent(inputId)}`,
      params: { inputId: "string" } as const,
    },
  },

  // Refresh tokens route
  REFRESH_TOKENS: "/refresh-tokens",

  // Users routes
  USERS: {
    CREATE: "/users",
    BY_ID: {
      pattern: "/users/:id",
      build: (id: string) => `/users/${encodeURIComponent(id)}`,
      params: { id: "string" } as const,
    },
  },

  // Builder chat routes
  BUILDER_CHAT: {
    HISTORY_BY_SESSION_ID: {
      pattern: "/builder-chat/:sessionId/history",
      build: (sessionId: string) =>
        `/builder-chat/${encodeURIComponent(sessionId)}/history`,
      params: { sessionId: "string" } as const,
    },
  },
} as const;
