// This file is generated from FrontendRoutes.json. Do not edit directly.

export const FrontendRoutes = {
    "APP": "/app",
    "OAUTH": {
        "SUCCESS": "/oauth/success",
        "ERROR": "/oauth/error"
    },
    "ONBOARD": "/onboard",
    "AGENTS": {
        "LIST": "/app/agents",
        "SETUP": "/app/agents/setup",
        "NEW": "/app/agents/new",
        "NEW_WITH_TEMPLATE": "/app/agents/new/template/:templateId",
        "BY_ID": "/app/agents/:id",
        "HISTORY": "/app/agents/:id?tab=history",
        "IMPROVEMENTS": "/app/agents/:id?tab=improvements",
        "ALERTS": "/app/agents/:id?tab=setup&section=alerts",
        "RUN_HISTORY": "/app/agents/:id?tab=history&runId=:runId"
    },
    "INTEGRATIONS": "/app/integrations",
    "ACTIVITY": "/app/activity",
    "STATS": "/app/stats",
    "NOTIFICATIONS": "/app/notifications",
    "PROFILE": "/app/profile",
    "USER_MANAGEMENT": "/app/profile?tab=users",
    "ORGANIZATIONS": {
        "CREATE": "/app/organizations/create"
    }
} as const
