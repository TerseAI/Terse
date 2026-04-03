/**
 * Frontend route path constants
 *
 * These constants standardize frontend route paths across the application,
 * preventing magic strings and making refactoring easier.
 *
 * Dynamic routes use route objects with both React Router patterns and URL builders
 * to ensure consistency across navigation calls and route definitions.
 */
/** Query param added when redirecting from Home/AgentBuilderLayout chat to agent page; AgentSetupTab clears session when present */
export const FROM_SETUP_CHAT_PARAM = "fromSetupChat";
export const FrontendRoutes = {
    // Base routes
    APP: "/app",
    OAUTH: {
        SUCCESS: "/oauth/success",
        ERROR: "/oauth/error"
    },
    ONBOARD: "/onboard",
    // App routes
    AGENTS: {
        LIST: "/app/agents",
        SETUP: "/app/agents/setup",
        NEW: "/app/agents/new",
        NEW_WITH_TEMPLATE: {
            pattern: "/app/agents/new/template/:templateId",
            build: (templateId) => `/app/agents/new/template/${encodeURIComponent(templateId)}`,
            params: { templateId: "string" }
        },
        BY_ID: {
            pattern: "/app/agents/:id",
            build: (id) => `/app/agents/${encodeURIComponent(id)}`,
            params: { id: "string" }
        },
        // Deep link builders
        DETAIL: (agentId) => `/app/agents/${encodeURIComponent(agentId)}`,
        HISTORY: (agentId) => `/app/agents/${encodeURIComponent(agentId)}?tab=history`,
        IMPROVEMENTS: (agentId) => `/app/agents/${encodeURIComponent(agentId)}?tab=improvements`,
        ALERTS: (agentId) => `/app/agents/${encodeURIComponent(agentId)}?tab=setup&section=alerts`,
        RUN_HISTORY: (agentId, runId) => `/app/agents/${encodeURIComponent(agentId)}?tab=history&runId=${encodeURIComponent(runId)}`,
        // Relative path for external references (e.g., run history metadata)
        BY_ID_RELATIVE: (agentId) => `/agents/${encodeURIComponent(agentId)}`
    },
    INTEGRATIONS: "/app/integrations",
    ACTIVITY: "/app/activity",
    STATS: "/app/stats",
    NOTIFICATIONS: "/app/notifications",
    PROFILE: "/app/profile",
    USER_MANAGEMENT: "/app/profile?tab=users",
    ORGANIZATIONS: {
        CREATE: "/app/organizations/create"
    }
};
