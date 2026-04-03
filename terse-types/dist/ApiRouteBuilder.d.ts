export declare const ApiRoutes: {
    AUTH: {
        ME: string;
        LOGIN: string;
        LOGIN_URL: string;
        LOGOUT: string;
        LOGOUT_URL: string;
        GITHUB_APP_CALLBACK: string;
        WORKOS_CALLBACK: string;
    };
    WORKOS: {
        WIDGET_TOKEN: string;
    };
    ORGANIZATIONS: {
        CREATE: string;
        GET_CURRENT: string;
        LIST: string;
        SWITCH: string;
        UPDATE: string;
        LOGO_UPLOAD_URL: string;
        LOGO: string;
    };
    STATS: string;
    RUN_HISTORY: {
        ALL: string;
        ACTIONS: string;
        BY_AGENT_ID: string;
        CHAT_BY_RUN_ID: string;
    };
    SESSION: {
        TOKEN: string;
    };
    GITHUB: {
        INTEGRATIONS: string;
        INSTALLATION_URL: string;
        GET_REPOSITORIES_FOR_INTEGRATION: string;
        INSTALLATION_CALLBACK: string;
        INSTALLATION_DELETED: string;
        UNIFIED_EVENT: string;
    };
    ATLASSIAN: {
        INTEGRATIONS: string;
        OAUTH_CALLBACK: string;
    };
    JIRA: {
        RESOURCES: string;
        GET_API_KEY: string;
        SET_API_KEY: string;
        VALIDATE_AND_FETCH_PROJECTS: string;
        DELETE_CREDENTIALS: string;
    };
    CONFLUENCE: {
        INTEGRATIONS: string;
        RESOURCES: string;
    };
    GMAIL: {
        INTEGRATIONS: string;
        CALLBACK: string;
        DELETE_INTEGRATION: string;
    };
    NOTION: {
        INTEGRATIONS: string;
        OAUTH_CALLBACK: string;
        RESOURCES: string;
        DELETE_INTEGRATION: string;
    };
    FIGMA: {
        INTEGRATIONS: string;
        OAUTH_CALLBACK: string;
    };
    LINEAR: {
        OAUTH_CALLBACK: string;
        WEBHOOK: string;
        INTEGRATIONS: string;
        TEAMS: string;
    };
    SLACK: {
        INTEGRATIONS: string;
        GET_CURRENT_INTEGRATION: string;
        OAUTH_CALLBACK: string;
        CHANNELS: string;
        USERS: string;
        EVENTS: string;
    };
    POSTHOG: {
        INTEGRATIONS: string;
        PROJECTS: string;
    };
    LAUNCHDARKLY: {
        INTEGRATIONS: string;
        PROJECTS_BY_INTEGRATION_ID: string;
        ENVIRONMENTS_BY_INTEGRATION_AND_PROJECT: string;
    };
    DATADOG: {
        INTEGRATIONS: string;
        INDEXES: string;
    };
    WORKOS_INTEGRATION: {
        INTEGRATIONS: string;
        WEBHOOK_SECRET: string;
    };
    SNOWFLAKE: {
        INTEGRATIONS: string;
    };
    ATTIO: {
        INTEGRATIONS: string;
        OAUTH_CALLBACK: string;
        OBJECTS: string;
    };
    AGENTS: {
        LIST: string;
        RECENT: string;
        BY_ID: string;
    };
    IMPROVEMENTS: {
        BY_AGENT_ID: string;
        APPLY: string;
        DISMISS: string;
        UNDO_DISMISS: string;
        TOGGLE_ENABLED: string;
    };
    TEMPLATES: string;
    PUBLIC: {
        TEMPLATES: string;
    };
    TOOLS: {
        THAT_REQUIRE_APPROVALS: string;
    };
    INTEGRATIONS: {
        INSTALLATION_DETAILS_BY_TYPE: string;
        LIST: string;
        ACTIVE: string;
    };
    NOTIFICATION_DESTINATIONS: {
        LIST: string;
        BY_ID: string;
    };
    API_TOKENS: {
        LIST: string;
        BY_ID: string;
    };
    SDK: {
        ME: string;
        SAMPLE_EVENTS: string;
        TOOL_EXECUTE: string;
        TOOL_DEFINITIONS: string;
        AGENT_RUN: string;
        APPROVAL_DECISION: string;
        SESSION_EVENTS: string;
        DEPLOY: string;
        DEVICE_TOKEN_EXCHANGE: string;
        INTEGRATION_FIELDS: string;
        INTEGRATION_FORM_SUBMIT: string;
    };
    NOTIFICATION_SETTINGS: string;
    SENT_NOTIFICATIONS: {
        LIST: string;
    };
    PENDING_APPROVALS: {
        LIST: string;
    };
    WEBHOOKS: {
        GMAIL: string;
        FIGMA: string;
        WORKOS: string;
        JIRA_BY_ACCOUNT_ID: string;
        LINEAR_BY_USER_ID: string;
        SCHEDULE_BY_INPUT_ID: string;
        WORKOS_TRIGGER_BY_INTEGRATION_ID: string;
    };
    SCHEDULE: {
        TRIGGER_BY_INPUT_ID: string;
        TRIGGER_WITH_EVENT: string;
    };
    REFRESH_TOKENS: string;
    REVIEW_AGENTS: string;
    USERS: {
        CREATE: string;
        BY_ID: string;
    };
    BUILDER_CHAT: {
        HISTORY_BY_SESSION_ID: string;
    };
};
export declare function buildApiRoute(pattern: string, params: Record<string, string | number>): string;
