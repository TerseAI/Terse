/**
 * Frontend route path constants
 * 
 * These constants standardize frontend route paths across the application,
 * preventing magic strings and making refactoring easier.
 * 
 * Dynamic routes use route objects with both React Router patterns and URL builders
 * to ensure consistency across navigation calls and route definitions.
 */

export const FrontendRoutes = {
  // Base routes
  APP: '/app',
  OAUTH: {
    SUCCESS: '/oauth/success',
    ERROR: '/oauth/error',
  },
  ONBOARD: '/onboard',
  
  // App routes
  AGENTS: {
    LIST: '/app/agents',
    SETUP: '/app/agents/setup',
    NEW: '/app/agents/new',
    NEW_WITH_TEMPLATE: {
      pattern: '/app/agents/new/template/:templateId',
      build: (templateId: string) => `/app/agents/new/template/${encodeURIComponent(templateId)}`,
      params: { templateId: 'string' } as const,
    },
    BY_ID: {
      pattern: '/app/agents/:id',
      build: (id: string) => `/app/agents/${encodeURIComponent(id)}`,
      params: { id: 'string' } as const,
    },
    // Deep link builders
    DETAIL: (agentId: string) => `/app/agents/${encodeURIComponent(agentId)}`,
    HISTORY: (agentId: string) => `/app/agents/${encodeURIComponent(agentId)}?tab=history`,
    RUN_HISTORY: (agentId: string, runId: string) => `/app/agents/${encodeURIComponent(agentId)}?tab=history&runId=${encodeURIComponent(runId)}`,
    // Relative path for external references (e.g., run history metadata)
    BY_ID_RELATIVE: (agentId: string) => `/agents/${encodeURIComponent(agentId)}`,
  },
  INTEGRATIONS: '/app/integrations',
  ACTIVITY: '/app/activity',
  NOTIFICATIONS: '/app/notifications',
} as const;
