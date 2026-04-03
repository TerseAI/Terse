// IMPORTANT: CHANGE THIS FOR NEW INTEGRATIONS. SHOULD MATCH PRISMA ENUM
export var IntegrationType;
(function (IntegrationType) {
    IntegrationType["GITHUB"] = "github";
    IntegrationType["GMAIL"] = "gmail";
    IntegrationType["LINEAR"] = "linear";
    IntegrationType["ATLASSIAN"] = "atlassian";
    IntegrationType["SLACK"] = "slack";
    IntegrationType["NOTION"] = "notion";
    IntegrationType["FIGMA"] = "figma";
    IntegrationType["TERSE"] = "terse";
    IntegrationType["POSTHOG"] = "posthog";
    IntegrationType["DATADOG"] = "datadog";
    IntegrationType["CRON_JOB"] = "cron_job";
    IntegrationType["LAUNCHDARKLY"] = "launchdarkly";
    IntegrationType["WORKOS"] = "workos";
    IntegrationType["ATTIO"] = "attio";
    IntegrationType["SNOWFLAKE"] = "snowflake";
})(IntegrationType || (IntegrationType = {}));
// Metadata objects - using const objects instead of classes
export const GmailIntegrationMetadata = {
    type: IntegrationType.GMAIL,
    name: "Gmail",
    description: "Monitor incoming emails",
    isInput: true,
    isOutput: false
};
export const NotionIntegrationMetadata = {
    type: IntegrationType.NOTION,
    name: "Notion",
    description: "Update living documents",
    isInput: false,
    isOutput: true
};
export const LinearIntegrationMetadata = {
    type: IntegrationType.LINEAR,
    name: "Linear",
    description: "Update tasks in Linear",
    isInput: false,
    isOutput: true
};
export const SlackIntegrationMetadata = {
    type: IntegrationType.SLACK,
    name: "Slack",
    description: "Send and receive messages in Slack (channels, group DMs, and DMs). Triggers can use user token to read your DMs; skills can send to channels or users with either token.",
    isInput: true,
    isOutput: true
};
export const FigmaIntegrationMetadata = {
    type: IntegrationType.FIGMA,
    name: "Figma",
    description: "Trigger on Figma file comments (does not support file edits or design changes)",
    isInput: true,
    isOutput: false
};
export const AtlassianIntegrationMetadata = {
    type: IntegrationType.ATLASSIAN,
    name: "Atlassian",
    description: "Update documents in Atlassian",
    isInput: true,
    isOutput: false
};
export const GithubIntegrationMetadata = {
    type: IntegrationType.GITHUB,
    name: "Github",
    description: "Update repositories in Github",
    isInput: true,
    isOutput: true
};
export const TerseIntegrationMetadata = {
    type: IntegrationType.TERSE,
    name: "Terse",
    description: "Platform tools",
    isInput: false,
    isOutput: false
};
export const PosthogIntegrationMetadata = {
    type: IntegrationType.POSTHOG,
    name: "Posthog",
    description: "Update events in Posthog",
    isInput: false,
    isOutput: true
};
export const DatadogIntegrationMetadata = {
    type: IntegrationType.DATADOG,
    name: "Datadog",
    description: "Search logs in Datadog",
    isInput: false,
    isOutput: true
};
export const CronJobIntegrationMetadata = {
    type: IntegrationType.CRON_JOB,
    name: "Scheduled Jobs",
    description: "System integration for time-based triggers",
    isInput: true,
    isOutput: false
};
export const LaunchDarklyIntegrationMetadata = {
    type: IntegrationType.LAUNCHDARKLY,
    name: "LaunchDarkly",
    description: "Track feature flags",
    isInput: false,
    isOutput: true
};
export const WorkOSIntegrationMetadata = {
    type: IntegrationType.WORKOS,
    name: "WorkOS",
    description: "Trigger on user lifecycle events and fetch/search users from your WorkOS account",
    isInput: true,
    isOutput: true
};
export const AttioIntegrationMetadata = {
    type: IntegrationType.ATTIO,
    name: "Attio",
    description: "Add and update contacts in Attio",
    isInput: false,
    isOutput: true
};
export const SnowflakeIntegrationMetadata = {
    type: IntegrationType.SNOWFLAKE,
    name: "Snowflake",
    description: "Run read-only queries against Snowflake data warehouses",
    isInput: false,
    isOutput: true
};
export const INTEGRATION_METADATA = {
    [IntegrationType.GMAIL]: GmailIntegrationMetadata,
    [IntegrationType.NOTION]: NotionIntegrationMetadata,
    [IntegrationType.LINEAR]: LinearIntegrationMetadata,
    [IntegrationType.ATLASSIAN]: AtlassianIntegrationMetadata,
    [IntegrationType.SLACK]: SlackIntegrationMetadata,
    [IntegrationType.GITHUB]: GithubIntegrationMetadata,
    [IntegrationType.FIGMA]: FigmaIntegrationMetadata,
    [IntegrationType.TERSE]: TerseIntegrationMetadata,
    [IntegrationType.POSTHOG]: PosthogIntegrationMetadata,
    [IntegrationType.DATADOG]: DatadogIntegrationMetadata,
    [IntegrationType.CRON_JOB]: CronJobIntegrationMetadata,
    [IntegrationType.LAUNCHDARKLY]: LaunchDarklyIntegrationMetadata,
    [IntegrationType.WORKOS]: WorkOSIntegrationMetadata,
    [IntegrationType.ATTIO]: AttioIntegrationMetadata,
    [IntegrationType.SNOWFLAKE]: SnowflakeIntegrationMetadata
};
