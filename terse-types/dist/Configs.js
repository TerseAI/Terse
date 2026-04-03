import { IntegrationType } from "./Integrations.js";
export var ConfigType;
(function (ConfigType) {
    ConfigType["GMAIL"] = "gmail";
    ConfigType["GMAIL_OUTPUT"] = "gmail_output";
    ConfigType["GMAIL_DRAFT_OUTPUT"] = "gmail_draft_output";
    ConfigType["FIGMA"] = "figma";
    ConfigType["SLACK"] = "slack";
    ConfigType["SLACK_OUTPUT"] = "slack_output";
    ConfigType["NOTION"] = "notion";
    ConfigType["LINEAR_INPUT"] = "linear_input";
    ConfigType["LINEAR_OUTPUT"] = "linear_output";
    ConfigType["GITHUB"] = "github";
    ConfigType["JIRA"] = "jira";
    ConfigType["CONFLUENCE"] = "confluence";
    ConfigType["POSTHOG"] = "POSTHOG";
    ConfigType["DATADOG"] = "DATADOG";
    ConfigType["TIME_TRIGGER"] = "time_trigger";
    ConfigType["LAUNCHDARKLY"] = "launchdarkly";
    ConfigType["TERSE"] = "terse";
    ConfigType["WORKOS_INPUT"] = "workos_input";
    ConfigType["WORKOS_OUTPUT"] = "workos_output";
    ConfigType["ATTIO_OUTPUT"] = "attio_output";
    ConfigType["SNOWFLAKE_OUTPUT"] = "snowflake_output";
})(ConfigType || (ConfigType = {}));
// Metadata objects - using const objects instead of classes
export const GmailConfigMetadata = {
    configType: ConfigType.GMAIL,
    name: "Gmail",
    description: "Monitor incoming emails",
    integrationType: IntegrationType.GMAIL,
    isInput: true,
    isOutput: false
};
export const FigmaConfigMetadata = {
    configType: ConfigType.FIGMA,
    name: "Figma",
    description: "Monitor design changes in Figma files",
    integrationType: IntegrationType.FIGMA,
    isInput: true,
    isOutput: false
};
export const SlackConfigMetadata = {
    configType: ConfigType.SLACK,
    name: "Slack",
    description: "Monitor messages in Slack channels or DMs",
    integrationType: IntegrationType.SLACK,
    isInput: true,
    isOutput: false
};
export const SlackOutputConfigMetadata = {
    configType: ConfigType.SLACK_OUTPUT,
    name: "Slack",
    description: "Send messages to Slack channels, group DMs, or direct messages",
    integrationType: IntegrationType.SLACK,
    isInput: false,
    isOutput: true
};
export const GmailOutputConfigMetadata = {
    configType: ConfigType.GMAIL_OUTPUT,
    name: "Gmail",
    description: "Send emails via Gmail",
    integrationType: IntegrationType.GMAIL,
    isInput: false,
    isOutput: true
};
export const GmailDraftOutputConfigMetadata = {
    configType: ConfigType.GMAIL_DRAFT_OUTPUT,
    name: "Gmail Draft",
    description: "Create draft emails in Gmail",
    integrationType: IntegrationType.GMAIL,
    isInput: false,
    isOutput: true
};
export const NotionConfigMetadata = {
    configType: ConfigType.NOTION,
    name: "Notion",
    description: "Update and monitor Notion pages and databases",
    integrationType: IntegrationType.NOTION,
    isInput: false,
    isOutput: true
};
export const LinearInputConfigMetadata = {
    configType: ConfigType.LINEAR_INPUT,
    name: "Linear",
    description: "Monitor Linear issues",
    integrationType: IntegrationType.LINEAR,
    isInput: true,
    isOutput: false
};
export const LinearOutputConfigMetadata = {
    configType: ConfigType.LINEAR_OUTPUT,
    name: "Linear",
    description: "Update Linear issues",
    integrationType: IntegrationType.LINEAR,
    isInput: false,
    isOutput: true
};
export const GitHubConfigMetadata = {
    configType: ConfigType.GITHUB,
    name: "GitHub",
    description: "Monitor and read Github repositories",
    integrationType: IntegrationType.GITHUB,
    isInput: true,
    isOutput: true
};
export const JiraConfigMetadata = {
    configType: ConfigType.JIRA,
    name: "Jira",
    description: "Monitor and update Jira issues",
    integrationType: IntegrationType.ATLASSIAN,
    isInput: true,
    isOutput: true
};
export const ConfluenceConfigMetadata = {
    configType: ConfigType.CONFLUENCE,
    name: "Confluence",
    description: "Update Confluence pages",
    integrationType: IntegrationType.ATLASSIAN,
    isInput: false,
    isOutput: true
};
export const PosthogConfigMetadata = {
    configType: ConfigType.POSTHOG,
    name: "Posthog",
    description: "Track user events",
    integrationType: IntegrationType.POSTHOG,
    isInput: false,
    isOutput: true
};
export const DatadogConfigMetadata = {
    configType: ConfigType.DATADOG,
    name: "Datadog",
    description: "Search logs in Datadog",
    integrationType: IntegrationType.DATADOG,
    isInput: false,
    isOutput: true
};
export const TimeTriggerConfigMetadata = {
    configType: ConfigType.TIME_TRIGGER,
    name: "Time Trigger",
    description: "Run on a schedule (daily, weekly, etc.)",
    integrationType: IntegrationType.CRON_JOB,
    isInput: true,
    isOutput: false
};
export const LaunchDarklyConfigMetadata = {
    configType: ConfigType.LAUNCHDARKLY,
    name: "LaunchDarkly",
    description: "Query feature flags",
    integrationType: IntegrationType.LAUNCHDARKLY,
    isInput: false,
    isOutput: true
};
export const TerseConfigMetadata = {
    configType: ConfigType.TERSE,
    name: "Terse Skills",
    description: "Built-in capabilities like web search (always available to agents)",
    integrationType: IntegrationType.TERSE,
    isInput: false,
    isOutput: true
};
export const WorkOSInputConfigMetadata = {
    configType: ConfigType.WORKOS_INPUT,
    name: "WorkOS",
    description: "Trigger on user signup, deletion, or membership changes in your app",
    integrationType: IntegrationType.WORKOS,
    isInput: true,
    isOutput: false
};
export const WorkOSOutputConfigMetadata = {
    configType: ConfigType.WORKOS_OUTPUT,
    name: "WorkOS",
    description: "Fetch and search users from your WorkOS account",
    integrationType: IntegrationType.WORKOS,
    isInput: false,
    isOutput: true
};
export const AttioOutputConfigMetadata = {
    configType: ConfigType.ATTIO_OUTPUT,
    name: "Attio",
    description: "Add and update contacts in Attio",
    integrationType: IntegrationType.ATTIO,
    isInput: false,
    isOutput: true
};
export const SnowflakeOutputConfigMetadata = {
    configType: ConfigType.SNOWFLAKE_OUTPUT,
    name: "Snowflake",
    description: "Run read-only queries against Snowflake data warehouses",
    integrationType: IntegrationType.SNOWFLAKE,
    isInput: false,
    isOutput: true
};
export const CONFIG_DETAILS = {
    [ConfigType.GMAIL]: GmailConfigMetadata,
    [ConfigType.GMAIL_OUTPUT]: GmailOutputConfigMetadata,
    [ConfigType.GMAIL_DRAFT_OUTPUT]: GmailDraftOutputConfigMetadata,
    [ConfigType.FIGMA]: FigmaConfigMetadata,
    [ConfigType.SLACK]: SlackConfigMetadata,
    [ConfigType.SLACK_OUTPUT]: SlackOutputConfigMetadata,
    [ConfigType.NOTION]: NotionConfigMetadata,
    [ConfigType.LINEAR_INPUT]: LinearInputConfigMetadata,
    [ConfigType.LINEAR_OUTPUT]: LinearOutputConfigMetadata,
    [ConfigType.GITHUB]: GitHubConfigMetadata,
    [ConfigType.JIRA]: JiraConfigMetadata,
    [ConfigType.CONFLUENCE]: ConfluenceConfigMetadata,
    [ConfigType.POSTHOG]: PosthogConfigMetadata,
    [ConfigType.DATADOG]: DatadogConfigMetadata,
    [ConfigType.TIME_TRIGGER]: TimeTriggerConfigMetadata,
    [ConfigType.LAUNCHDARKLY]: LaunchDarklyConfigMetadata,
    [ConfigType.TERSE]: TerseConfigMetadata,
    [ConfigType.WORKOS_INPUT]: WorkOSInputConfigMetadata,
    [ConfigType.WORKOS_OUTPUT]: WorkOSOutputConfigMetadata,
    [ConfigType.ATTIO_OUTPUT]: AttioOutputConfigMetadata,
    [ConfigType.SNOWFLAKE_OUTPUT]: SnowflakeOutputConfigMetadata
};
// MARK: Event Types — specific events within each integration trigger
export var SlackEventType;
(function (SlackEventType) {
    SlackEventType["MESSAGE"] = "message";
    SlackEventType["APP_MENTION"] = "app_mention";
    SlackEventType["REACTION_ADDED"] = "reaction_added";
})(SlackEventType || (SlackEventType = {}));
export var GitHubEventType;
(function (GitHubEventType) {
    GitHubEventType["PUSH"] = "push";
    GitHubEventType["PR_OPENED"] = "pull_request.opened";
    GitHubEventType["PR_MERGED"] = "pull_request.merged";
    GitHubEventType["PR_CLOSED"] = "pull_request.closed";
    GitHubEventType["PR_SYNCHRONIZE"] = "pull_request.synchronize";
})(GitHubEventType || (GitHubEventType = {}));
export var LinearEventType;
(function (LinearEventType) {
    LinearEventType["ISSUE_CREATED"] = "issue.created";
    LinearEventType["ISSUE_UPDATED"] = "issue.updated";
    LinearEventType["COMMENT_CREATED"] = "comment.created";
})(LinearEventType || (LinearEventType = {}));
export var JiraEventType;
(function (JiraEventType) {
    JiraEventType["ISSUE_CREATED"] = "issue.created";
    JiraEventType["ISSUE_UPDATED"] = "issue.updated";
})(JiraEventType || (JiraEventType = {}));
export var FigmaEventType;
(function (FigmaEventType) {
    FigmaEventType["FILE_COMMENT"] = "file_comment";
})(FigmaEventType || (FigmaEventType = {}));
export var GmailEventType;
(function (GmailEventType) {
    GmailEventType["EMAIL_RECEIVED"] = "email.received";
})(GmailEventType || (GmailEventType = {}));
export var WorkOSEventType;
(function (WorkOSEventType) {
    WorkOSEventType["USER_CREATED"] = "user.created";
    WorkOSEventType["USER_UPDATED"] = "user.updated";
    WorkOSEventType["USER_DELETED"] = "user.deleted";
    WorkOSEventType["ORGANIZATION_CREATED"] = "organization.created";
    WorkOSEventType["ORGANIZATION_MEMBERSHIP_CREATED"] = "organization_membership.created";
    WorkOSEventType["ORGANIZATION_MEMBERSHIP_UPDATED"] = "organization_membership.updated";
    WorkOSEventType["ORGANIZATION_MEMBERSHIP_DELETED"] = "organization_membership.deleted";
    WorkOSEventType["INVITATION_CREATED"] = "invitation.created";
    WorkOSEventType["INVITATION_ACCEPTED"] = "invitation.accepted";
    WorkOSEventType["INVITATION_RESENT"] = "invitation.resent";
    WorkOSEventType["INVITATION_REVOKED"] = "invitation.revoked";
})(WorkOSEventType || (WorkOSEventType = {}));
export class GmailConfig {
    integrationId;
    eventTypes;
    integrationType = IntegrationType.GMAIL;
    configType = ConfigType.GMAIL;
    constructor(integrationId, eventTypes) {
        this.integrationId = integrationId;
        this.eventTypes = eventTypes;
    }
    isComplete() {
        // Gmail only requires integrationId (base check handled in isInputComplete)
        return true;
    }
    formatForAgent() {
        return `Type: Gmail\nIntegration ID: ${this.integrationId}`;
    }
}
export class FigmaConfig {
    integrationId;
    fileKey;
    fileName;
    teamId;
    eventTypes;
    integrationType = IntegrationType.FIGMA;
    configType = ConfigType.FIGMA;
    constructor(integrationId, fileKey, fileName, teamId, eventTypes) {
        this.integrationId = integrationId;
        this.fileKey = fileKey;
        this.fileName = fileName;
        this.teamId = teamId;
        this.eventTypes = eventTypes;
    }
    isComplete() {
        return !!(this.fileKey && this.teamId);
    }
    formatForAgent() {
        const parts = [`Type: Figma`, `Integration ID: ${this.integrationId}`];
        if (this.fileName) {
            parts.push(`File: ${this.fileName}`);
        }
        if (this.fileKey) {
            parts.push(`File Key: ${this.fileKey}`);
        }
        return parts.join("\n");
    }
}
export class SlackConfig {
    integrationId;
    channelId;
    channelName;
    listenToUserDms;
    userIds;
    eventTypes;
    integrationType = IntegrationType.SLACK;
    configType = ConfigType.SLACK;
    constructor(integrationId, channelId, channelName, listenToUserDms = false, userIds, eventTypes) {
        this.integrationId = integrationId;
        this.channelId = channelId;
        this.channelName = channelName;
        this.listenToUserDms = listenToUserDms;
        this.userIds = userIds;
        this.eventTypes = eventTypes;
    }
    isComplete() {
        // Slack is complete if either channelId is set OR listenToUserDms is true
        return !!(this.channelId || this.listenToUserDms);
    }
    formatForAgent() {
        const parts = [`Type: Slack`, `Integration ID: ${this.integrationId}`];
        if (this.channelName) {
            parts.push(`Channel: ${this.channelName}`);
        }
        else if (this.channelId) {
            parts.push(`Channel ID: ${this.channelId}`);
        }
        if (this.listenToUserDms) {
            parts.push(`Listening to user DMs: Yes`);
        }
        if (this.userIds) {
            parts.push(`Users: ${this.userIds.join(", ")}`);
        }
        return parts.join("\n");
    }
}
export class SlackOutputConfig {
    integrationId;
    channelId;
    channelName;
    userIds;
    userNames;
    listenToUserDms;
    integrationType = IntegrationType.SLACK;
    configType = ConfigType.SLACK_OUTPUT;
    constructor(integrationId, channelId, channelName, userIds, userNames, listenToUserDms = false) {
        this.integrationId = integrationId;
        this.channelId = channelId;
        this.channelName = channelName;
        this.userIds = userIds;
        this.userNames = userNames;
        this.listenToUserDms = listenToUserDms;
    }
    isComplete() {
        // Slack output is complete if a channel is set, DM users are set, or "listen to user DMs" is enabled.
        return !!(this.channelId || (this.userIds?.length ?? 0) > 0 || this.listenToUserDms);
    }
    formatForAgent() {
        const parts = [`Type: Slack Output`, `Integration ID: ${this.integrationId}`];
        if (this.channelId) {
            parts.push(`Channel ID: ${this.channelId}`);
        }
        if (this.listenToUserDms) {
            parts.push(`Listen to user DMs: Yes`);
        }
        if (this.userIds?.length) {
            parts.push(`DM user IDs: ${this.userIds.join(", ")}`);
        }
        return parts.join("\n");
    }
}
export class GmailOutputConfig {
    integrationId;
    integrationType = IntegrationType.GMAIL;
    configType = ConfigType.GMAIL_OUTPUT;
    constructor(integrationId) {
        this.integrationId = integrationId;
    }
    isComplete() {
        // Gmail output only requires integrationId
        return true;
    }
    formatForAgent() {
        return `Type: Gmail Output\nIntegration ID: ${this.integrationId}`;
    }
}
export class GmailDraftOutputConfig {
    integrationId;
    integrationType = IntegrationType.GMAIL;
    configType = ConfigType.GMAIL_DRAFT_OUTPUT;
    constructor(integrationId) {
        this.integrationId = integrationId;
    }
    isComplete() {
        return true;
    }
    formatForAgent() {
        return `Type: Gmail Draft Output\nIntegration ID: ${this.integrationId}`;
    }
}
export class NotionConfig {
    integrationId;
    databaseIds;
    databaseNames;
    pageIds;
    pageNames;
    integrationType = IntegrationType.NOTION;
    configType = ConfigType.NOTION;
    constructor(integrationId, databaseIds = [], databaseNames = [], pageIds = [], pageNames = []) {
        this.integrationId = integrationId;
        this.databaseIds = databaseIds;
        this.databaseNames = databaseNames;
        this.pageIds = pageIds;
        this.pageNames = pageNames;
    }
    isComplete() {
        return (this.databaseIds?.length ?? 0) > 0 || (this.pageIds?.length ?? 0) > 0;
    }
    formatForAgent() {
        const parts = [`Type: Notion`, `Integration ID: ${this.integrationId}`];
        const dbIds = this.databaseIds ?? [];
        const dbNames = this.databaseNames ?? [];
        if (dbIds.length > 0) {
            parts.push(`Databases: ${dbIds.map((id, i) => dbNames[i] || id).join(", ")}`);
        }
        const pageIds = this.pageIds ?? [];
        const pageNames = this.pageNames ?? [];
        if (pageIds.length > 0) {
            parts.push(`Pages: ${pageIds.map((id, i) => pageNames[i] || id).join(", ")}`);
        }
        return parts.join("\n");
    }
}
export class LinearInputConfig {
    integrationId;
    projectId;
    projectName;
    eventTypes;
    integrationType = IntegrationType.LINEAR;
    configType = ConfigType.LINEAR_INPUT;
    constructor(integrationId, projectId, projectName, eventTypes) {
        this.integrationId = integrationId;
        this.projectId = projectId;
        this.projectName = projectName;
        this.eventTypes = eventTypes;
    }
    isComplete() {
        return true;
    }
    formatForAgent() {
        const parts = [`Type: Linear`, `Integration ID: ${this.integrationId}`];
        if (this.projectName) {
            parts.push(`Project: ${this.projectName}`);
        }
        else if (this.projectId) {
            parts.push(`Project ID: ${this.projectId}`);
        }
        return parts.join("\n");
    }
}
export class LinearOutputConfig {
    integrationId;
    teamId;
    teamName;
    projectId;
    projectName;
    integrationType = IntegrationType.LINEAR;
    configType = ConfigType.LINEAR_OUTPUT;
    constructor(integrationId, teamId, teamName, projectId, projectName) {
        this.integrationId = integrationId;
        this.teamId = teamId;
        this.teamName = teamName;
        this.projectId = projectId;
        this.projectName = projectName;
    }
    isComplete() {
        return !!this.integrationId;
    }
    formatForAgent() {
        const parts = [`Type: Linear`, `Integration ID: ${this.integrationId}`];
        if (this.teamName) {
            parts.push(`Team: ${this.teamName}`);
        }
        else if (this.teamId) {
            parts.push(`Team ID: ${this.teamId}`);
        }
        if (this.projectName) {
            parts.push(`Project: ${this.projectName}`);
        }
        else if (this.projectId) {
            parts.push(`Project ID: ${this.projectId}`);
        }
        return parts.join("\n");
    }
}
export class GitHubConfig {
    integrationId;
    repositoryIds;
    eventTypes;
    integrationType = IntegrationType.GITHUB;
    configType = ConfigType.GITHUB;
    constructor(integrationId, repositoryIds, eventTypes) {
        this.integrationId = integrationId;
        this.repositoryIds = repositoryIds;
        this.eventTypes = eventTypes;
    }
    isComplete() {
        return (this.repositoryIds?.length ?? 0) > 0;
    }
    formatForAgent() {
        const parts = [`Type: GitHub`, `Integration ID: ${this.integrationId}`];
        if (this.repositoryIds.length > 0) {
            parts.push(`Repositories: ${this.repositoryIds.join(", ")}`);
        }
        return parts.join("\n");
    }
}
export class JiraConfig {
    integrationId;
    projectKey;
    projectId;
    eventTypes;
    integrationType = IntegrationType.ATLASSIAN;
    configType = ConfigType.JIRA;
    constructor(integrationId, projectKey, projectId, eventTypes) {
        this.integrationId = integrationId;
        this.projectKey = projectKey;
        this.projectId = projectId;
        this.eventTypes = eventTypes;
    }
    isComplete() {
        // Jira only requires integrationId (base check handled in isInputComplete)
        return true;
    }
    formatForAgent() {
        const parts = [`Type: Jira`, `Integration ID: ${this.integrationId}`];
        if (this.projectKey) {
            parts.push(`Project Key: ${this.projectKey}`);
        }
        else if (this.projectId) {
            parts.push(`Project ID: ${this.projectId}`);
        }
        return parts.join("\n");
    }
}
export class ConfluenceConfig {
    integrationId;
    spaceName;
    spaceId;
    pageId;
    pageName;
    integrationType = IntegrationType.ATLASSIAN;
    configType = ConfigType.CONFLUENCE;
    constructor(integrationId, spaceName, spaceId, pageId, // Page ID (required for outputs - specific page to write to)
    pageName // Page display name (for UI, optional)
    ) {
        this.integrationId = integrationId;
        this.spaceName = spaceName;
        this.spaceId = spaceId;
        this.pageId = pageId;
        this.pageName = pageName;
    }
    isComplete() {
        // Confluence only requires integrationId (base check handled in isInputComplete)
        return true;
    }
    formatForAgent() {
        const parts = [`Type: Confluence`, `Integration ID: ${this.integrationId}`];
        if (this.spaceName) {
            parts.push(`Space: ${this.spaceName}`);
        }
        if (this.pageName) {
            parts.push(`Page: ${this.pageName}`);
        }
        else if (this.pageId) {
            parts.push(`Page ID: ${this.pageId}`);
        }
        return parts.join("\n");
    }
}
export class PosthogConfig {
    integrationId;
    projectId;
    projectName;
    integrationType = IntegrationType.POSTHOG;
    configType = ConfigType.POSTHOG;
    constructor(integrationId, projectId, projectName) {
        this.integrationId = integrationId;
        this.projectId = projectId;
        this.projectName = projectName;
    }
    isComplete() {
        return !!this.projectId;
    }
    formatForAgent() {
        const parts = [`Type: Posthog`, `Integration ID: ${this.integrationId}`];
        if (this.projectId) {
            parts.push(`Project ID: ${this.projectId}`);
        }
        if (this.projectName) {
            parts.push(`Project: ${this.projectName}`);
        }
        return parts.join("\n");
    }
}
export class DatadogConfig {
    integrationId;
    defaultIndexes;
    integrationType = IntegrationType.DATADOG;
    configType = ConfigType.DATADOG;
    constructor(integrationId, defaultIndexes = ["main"]) {
        this.integrationId = integrationId;
        this.defaultIndexes = defaultIndexes;
    }
    isComplete() {
        return !!this.integrationId;
    }
    formatForAgent() {
        const parts = [`Type: Datadog`, `Integration ID: ${this.integrationId}`];
        if (this.defaultIndexes && this.defaultIndexes.length > 0) {
            parts.push(`Default indexes: ${this.defaultIndexes.join(", ")}`);
        }
        return parts.join("\n");
    }
}
export class TimeTriggerConfig {
    cronExpression;
    integrationType = IntegrationType.CRON_JOB;
    configType = ConfigType.TIME_TRIGGER;
    // System integration - no real integration ID needed
    integrationId = "system";
    constructor(cronExpression) {
        this.cronExpression = cronExpression;
    }
    isComplete() {
        return !!this.cronExpression;
    }
    formatForAgent() {
        const parts = [`Type: Time Trigger`];
        if (this.cronExpression) {
            parts.push(`Schedule (UTC): ${this.cronExpression}`);
        }
        return parts.join("\n");
    }
}
export class LaunchDarklyConfig {
    integrationId;
    projectKey;
    environmentKeys;
    integrationType = IntegrationType.LAUNCHDARKLY;
    configType = ConfigType.LAUNCHDARKLY;
    constructor(integrationId, projectKey, environmentKeys // ["production", "staging"]
    ) {
        this.integrationId = integrationId;
        this.projectKey = projectKey;
        this.environmentKeys = environmentKeys;
    }
    isComplete() {
        return !!(this.projectKey && this.environmentKeys.length > 0);
    }
    formatForAgent() {
        const parts = [`Type: LaunchDarkly`, `Integration ID: ${this.integrationId}`];
        if (this.projectKey) {
            parts.push(`Project Key: ${this.projectKey}`);
        }
        if (this.environmentKeys.length > 0) {
            parts.push(`Environments: ${this.environmentKeys.join(", ")}`);
        }
        return parts.join("\n");
    }
}
export class TerseConfig {
    integrationType = IntegrationType.TERSE;
    configType = ConfigType.TERSE;
    integrationId = "system";
    constructor() { }
    isComplete() {
        return true;
    }
    formatForAgent() {
        return "Type: Terse Skills";
    }
}
export class WorkOSInputConfig {
    integrationId;
    eventTypes;
    integrationType = IntegrationType.WORKOS;
    configType = ConfigType.WORKOS_INPUT;
    constructor(integrationId, eventTypes = []) {
        this.integrationId = integrationId;
        this.eventTypes = eventTypes;
    }
    isComplete() {
        return this.eventTypes.length > 0;
    }
    formatForAgent() {
        return `Type: WorkOS Events\nListening for: ${this.eventTypes.join(", ")}`;
    }
}
export class WorkOSOutputConfig {
    integrationId;
    integrationType = IntegrationType.WORKOS;
    configType = ConfigType.WORKOS_OUTPUT;
    constructor(integrationId) {
        this.integrationId = integrationId;
    }
    isComplete() {
        return !!this.integrationId;
    }
    formatForAgent() {
        return `Type: WorkOS Skill\nIntegration ID: ${this.integrationId}`;
    }
}
export class AttioOutputConfig {
    integrationId;
    objectSlug;
    integrationType = IntegrationType.ATTIO;
    configType = ConfigType.ATTIO_OUTPUT;
    constructor(integrationId, objectSlug) {
        this.integrationId = integrationId;
        this.objectSlug = objectSlug;
    }
    isComplete() {
        return !!this.objectSlug;
    }
    formatForAgent() {
        const parts = [`Type: Attio Output`, `Integration ID: ${this.integrationId}`];
        if (this.objectSlug) {
            parts.push(`Object: ${this.objectSlug}`);
        }
        return parts.join("\n");
    }
}
export class SnowflakeOutputConfig {
    integrationId;
    integrationType = IntegrationType.SNOWFLAKE;
    configType = ConfigType.SNOWFLAKE_OUTPUT;
    constructor(integrationId) {
        this.integrationId = integrationId;
    }
    isComplete() {
        return !!this.integrationId;
    }
    formatForAgent() {
        const parts = [`Type: Snowflake Output`, `Integration ID: ${this.integrationId}`];
        return parts.join("\n");
    }
}
export const CONFIG_METADATA = {
    [ConfigType.GMAIL]: GmailConfig,
    [ConfigType.GMAIL_OUTPUT]: GmailOutputConfig,
    [ConfigType.GMAIL_DRAFT_OUTPUT]: GmailDraftOutputConfig,
    [ConfigType.FIGMA]: FigmaConfig,
    [ConfigType.SLACK]: SlackConfig,
    [ConfigType.SLACK_OUTPUT]: SlackOutputConfig,
    [ConfigType.NOTION]: NotionConfig,
    [ConfigType.LINEAR_INPUT]: LinearInputConfig,
    [ConfigType.LINEAR_OUTPUT]: LinearOutputConfig,
    [ConfigType.GITHUB]: GitHubConfig,
    [ConfigType.JIRA]: JiraConfig,
    [ConfigType.CONFLUENCE]: ConfluenceConfig,
    [ConfigType.POSTHOG]: PosthogConfig,
    [ConfigType.DATADOG]: DatadogConfig,
    [ConfigType.TIME_TRIGGER]: TimeTriggerConfig,
    [ConfigType.LAUNCHDARKLY]: LaunchDarklyConfig,
    [ConfigType.TERSE]: TerseConfig,
    [ConfigType.WORKOS_INPUT]: WorkOSInputConfig,
    [ConfigType.WORKOS_OUTPUT]: WorkOSOutputConfig,
    [ConfigType.ATTIO_OUTPUT]: AttioOutputConfig,
    [ConfigType.SNOWFLAKE_OUTPUT]: SnowflakeOutputConfig
};
