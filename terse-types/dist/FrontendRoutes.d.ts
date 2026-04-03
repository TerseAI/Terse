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
export declare const FROM_SETUP_CHAT_PARAM = "fromSetupChat";
export declare const FrontendRoutes: {
    readonly APP: "/app";
    readonly OAUTH: {
        readonly SUCCESS: "/oauth/success";
        readonly ERROR: "/oauth/error";
    };
    readonly ONBOARD: "/onboard";
    readonly AGENTS: {
        readonly LIST: "/app/agents";
        readonly SETUP: "/app/agents/setup";
        readonly NEW: "/app/agents/new";
        readonly NEW_WITH_TEMPLATE: {
            readonly pattern: "/app/agents/new/template/:templateId";
            readonly build: (templateId: string) => string;
            readonly params: {
                readonly templateId: "string";
            };
        };
        readonly BY_ID: {
            readonly pattern: "/app/agents/:id";
            readonly build: (id: string) => string;
            readonly params: {
                readonly id: "string";
            };
        };
        readonly DETAIL: (agentId: string) => string;
        readonly HISTORY: (agentId: string) => string;
        readonly IMPROVEMENTS: (agentId: string) => string;
        readonly ALERTS: (agentId: string) => string;
        readonly RUN_HISTORY: (agentId: string, runId: string) => string;
        readonly BY_ID_RELATIVE: (agentId: string) => string;
    };
    readonly INTEGRATIONS: "/app/integrations";
    readonly ACTIVITY: "/app/activity";
    readonly STATS: "/app/stats";
    readonly NOTIFICATIONS: "/app/notifications";
    readonly PROFILE: "/app/profile";
    readonly USER_MANAGEMENT: "/app/profile?tab=users";
    readonly ORGANIZATIONS: {
        readonly CREATE: "/app/organizations/create";
    };
};
