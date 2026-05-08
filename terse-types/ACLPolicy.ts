import { IntegrationType } from "./Integrations"

export const integrationACLPolicy = {
    [IntegrationType.GITHUB]: "scoped",
    [IntegrationType.GMAIL]: "scoped",
    [IntegrationType.LINEAR]: "scoped",
    [IntegrationType.SLACK]: "scoped",
    [IntegrationType.NOTION]: "scoped",
    [IntegrationType.TERSE]: "capability",
    [IntegrationType.POSTHOG]: "scoped",
    [IntegrationType.DATADOG]: "scoped",
    [IntegrationType.CRON_JOB]: "none",
    [IntegrationType.LAUNCHDARKLY]: "scoped",
    [IntegrationType.WORKOS]: "integration",
    [IntegrationType.ATTIO]: "scoped",
    [IntegrationType.SNOWFLAKE]: "integration",
    [IntegrationType.WEBHOOK]: "none",
    [IntegrationType.WEBMONITOR]: "none"
} as const satisfies Record<IntegrationType, "scoped" | "integration" | "capability" | "none">
