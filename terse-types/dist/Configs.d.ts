import { IntegrationType } from "./Integrations.js";
export declare enum ConfigType {
    GMAIL = "gmail",
    GMAIL_OUTPUT = "gmail_output",
    GMAIL_DRAFT_OUTPUT = "gmail_draft_output",
    FIGMA = "figma",
    SLACK = "slack",
    SLACK_OUTPUT = "slack_output",
    NOTION = "notion",
    LINEAR_INPUT = "linear_input",
    LINEAR_OUTPUT = "linear_output",
    GITHUB = "github",
    JIRA = "jira",
    CONFLUENCE = "confluence",
    POSTHOG = "POSTHOG",
    DATADOG = "DATADOG",
    TIME_TRIGGER = "time_trigger",
    LAUNCHDARKLY = "launchdarkly",
    TERSE = "terse",
    WORKOS_INPUT = "workos_input",
    WORKOS_OUTPUT = "workos_output",
    ATTIO_OUTPUT = "attio_output",
    SNOWFLAKE_OUTPUT = "snowflake_output"
}
export interface ConfigDetails {
    configType: ConfigType;
    name: string;
    description: string;
    integrationType: IntegrationType;
    isInput: boolean;
    isOutput: boolean;
}
export declare const GmailConfigMetadata: {
    readonly configType: ConfigType.GMAIL;
    readonly name: "Gmail";
    readonly description: "Monitor incoming emails";
    readonly integrationType: IntegrationType.GMAIL;
    readonly isInput: true;
    readonly isOutput: false;
};
export declare const FigmaConfigMetadata: {
    readonly configType: ConfigType.FIGMA;
    readonly name: "Figma";
    readonly description: "Monitor design changes in Figma files";
    readonly integrationType: IntegrationType.FIGMA;
    readonly isInput: true;
    readonly isOutput: false;
};
export declare const SlackConfigMetadata: {
    readonly configType: ConfigType.SLACK;
    readonly name: "Slack";
    readonly description: "Monitor messages in Slack channels or DMs";
    readonly integrationType: IntegrationType.SLACK;
    readonly isInput: true;
    readonly isOutput: false;
};
export declare const SlackOutputConfigMetadata: {
    readonly configType: ConfigType.SLACK_OUTPUT;
    readonly name: "Slack";
    readonly description: "Send messages to Slack channels, group DMs, or direct messages";
    readonly integrationType: IntegrationType.SLACK;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const GmailOutputConfigMetadata: {
    readonly configType: ConfigType.GMAIL_OUTPUT;
    readonly name: "Gmail";
    readonly description: "Send emails via Gmail";
    readonly integrationType: IntegrationType.GMAIL;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const GmailDraftOutputConfigMetadata: {
    readonly configType: ConfigType.GMAIL_DRAFT_OUTPUT;
    readonly name: "Gmail Draft";
    readonly description: "Create draft emails in Gmail";
    readonly integrationType: IntegrationType.GMAIL;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const NotionConfigMetadata: {
    readonly configType: ConfigType.NOTION;
    readonly name: "Notion";
    readonly description: "Update and monitor Notion pages and databases";
    readonly integrationType: IntegrationType.NOTION;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const LinearInputConfigMetadata: {
    readonly configType: ConfigType.LINEAR_INPUT;
    readonly name: "Linear";
    readonly description: "Monitor Linear issues";
    readonly integrationType: IntegrationType.LINEAR;
    readonly isInput: true;
    readonly isOutput: false;
};
export declare const LinearOutputConfigMetadata: {
    readonly configType: ConfigType.LINEAR_OUTPUT;
    readonly name: "Linear";
    readonly description: "Update Linear issues";
    readonly integrationType: IntegrationType.LINEAR;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const GitHubConfigMetadata: {
    readonly configType: ConfigType.GITHUB;
    readonly name: "GitHub";
    readonly description: "Monitor and read Github repositories";
    readonly integrationType: IntegrationType.GITHUB;
    readonly isInput: true;
    readonly isOutput: true;
};
export declare const JiraConfigMetadata: {
    readonly configType: ConfigType.JIRA;
    readonly name: "Jira";
    readonly description: "Monitor and update Jira issues";
    readonly integrationType: IntegrationType.ATLASSIAN;
    readonly isInput: true;
    readonly isOutput: true;
};
export declare const ConfluenceConfigMetadata: {
    readonly configType: ConfigType.CONFLUENCE;
    readonly name: "Confluence";
    readonly description: "Update Confluence pages";
    readonly integrationType: IntegrationType.ATLASSIAN;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const PosthogConfigMetadata: {
    readonly configType: ConfigType.POSTHOG;
    readonly name: "Posthog";
    readonly description: "Track user events";
    readonly integrationType: IntegrationType.POSTHOG;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const DatadogConfigMetadata: {
    readonly configType: ConfigType.DATADOG;
    readonly name: "Datadog";
    readonly description: "Search logs in Datadog";
    readonly integrationType: IntegrationType.DATADOG;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const TimeTriggerConfigMetadata: {
    readonly configType: ConfigType.TIME_TRIGGER;
    readonly name: "Time Trigger";
    readonly description: "Run on a schedule (daily, weekly, etc.)";
    readonly integrationType: IntegrationType.CRON_JOB;
    readonly isInput: true;
    readonly isOutput: false;
};
export declare const LaunchDarklyConfigMetadata: {
    readonly configType: ConfigType.LAUNCHDARKLY;
    readonly name: "LaunchDarkly";
    readonly description: "Query feature flags";
    readonly integrationType: IntegrationType.LAUNCHDARKLY;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const TerseConfigMetadata: {
    readonly configType: ConfigType.TERSE;
    readonly name: "Terse Skills";
    readonly description: "Built-in capabilities like web search (always available to agents)";
    readonly integrationType: IntegrationType.TERSE;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const WorkOSInputConfigMetadata: {
    readonly configType: ConfigType.WORKOS_INPUT;
    readonly name: "WorkOS";
    readonly description: "Trigger on user signup, deletion, or membership changes in your app";
    readonly integrationType: IntegrationType.WORKOS;
    readonly isInput: true;
    readonly isOutput: false;
};
export declare const WorkOSOutputConfigMetadata: {
    readonly configType: ConfigType.WORKOS_OUTPUT;
    readonly name: "WorkOS";
    readonly description: "Fetch and search users from your WorkOS account";
    readonly integrationType: IntegrationType.WORKOS;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const AttioOutputConfigMetadata: {
    readonly configType: ConfigType.ATTIO_OUTPUT;
    readonly name: "Attio";
    readonly description: "Add and update contacts in Attio";
    readonly integrationType: IntegrationType.ATTIO;
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const SnowflakeOutputConfigMetadata: {
    readonly configType: ConfigType.SNOWFLAKE_OUTPUT;
    readonly name: "Snowflake";
    readonly description: "Run read-only queries against Snowflake data warehouses";
    readonly integrationType: IntegrationType.SNOWFLAKE;
    readonly isInput: false;
    readonly isOutput: true;
};
export type ConfigDetailsMap = Record<ConfigType, ConfigDetails>;
export declare const CONFIG_DETAILS: ConfigDetailsMap;
export declare enum SlackEventType {
    MESSAGE = "message",
    APP_MENTION = "app_mention",
    REACTION_ADDED = "reaction_added"
}
export declare enum GitHubEventType {
    PUSH = "push",
    PR_OPENED = "pull_request.opened",
    PR_MERGED = "pull_request.merged",
    PR_CLOSED = "pull_request.closed",
    PR_SYNCHRONIZE = "pull_request.synchronize"
}
export declare enum LinearEventType {
    ISSUE_CREATED = "issue.created",
    ISSUE_UPDATED = "issue.updated",
    COMMENT_CREATED = "comment.created"
}
export declare enum JiraEventType {
    ISSUE_CREATED = "issue.created",
    ISSUE_UPDATED = "issue.updated"
}
export declare enum FigmaEventType {
    FILE_COMMENT = "file_comment"
}
export declare enum GmailEventType {
    EMAIL_RECEIVED = "email.received"
}
export declare enum WorkOSEventType {
    USER_CREATED = "user.created",
    USER_UPDATED = "user.updated",
    USER_DELETED = "user.deleted",
    ORGANIZATION_CREATED = "organization.created",
    ORGANIZATION_MEMBERSHIP_CREATED = "organization_membership.created",
    ORGANIZATION_MEMBERSHIP_UPDATED = "organization_membership.updated",
    ORGANIZATION_MEMBERSHIP_DELETED = "organization_membership.deleted",
    INVITATION_CREATED = "invitation.created",
    INVITATION_ACCEPTED = "invitation.accepted",
    INVITATION_RESENT = "invitation.resent",
    INVITATION_REVOKED = "invitation.revoked"
}
export interface ConfigInstance {
    integrationId: string;
    integrationType: IntegrationType;
    configType: ConfigType;
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class GmailConfig implements ConfigInstance {
    integrationId: string;
    eventTypes?: GmailEventType[] | undefined;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, eventTypes?: GmailEventType[] | undefined);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class FigmaConfig implements ConfigInstance {
    integrationId: string;
    fileKey: string;
    fileName: string;
    teamId: string;
    eventTypes?: FigmaEventType[] | undefined;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, fileKey: string, fileName: string, teamId: string, eventTypes?: FigmaEventType[] | undefined);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class SlackConfig implements ConfigInstance {
    integrationId: string;
    channelId?: string | undefined;
    channelName?: string | undefined;
    listenToUserDms: boolean;
    userIds?: string[] | undefined;
    eventTypes?: SlackEventType[] | undefined;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, channelId?: string | undefined, channelName?: string | undefined, listenToUserDms?: boolean, userIds?: string[] | undefined, eventTypes?: SlackEventType[] | undefined);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class SlackOutputConfig implements ConfigInstance {
    integrationId: string;
    channelId?: string | undefined;
    channelName?: string | undefined;
    userIds?: string[] | undefined;
    userNames?: string[] | undefined;
    listenToUserDms: boolean;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, channelId?: string | undefined, channelName?: string | undefined, userIds?: string[] | undefined, userNames?: string[] | undefined, listenToUserDms?: boolean);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class GmailOutputConfig implements ConfigInstance {
    integrationId: string;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class GmailDraftOutputConfig implements ConfigInstance {
    integrationId: string;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class NotionConfig implements ConfigInstance {
    integrationId: string;
    databaseIds: string[];
    databaseNames: string[];
    pageIds: string[];
    pageNames: string[];
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, databaseIds?: string[], databaseNames?: string[], pageIds?: string[], pageNames?: string[]);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class LinearInputConfig implements ConfigInstance {
    integrationId: string;
    projectId?: string | undefined;
    projectName?: string | undefined;
    eventTypes?: LinearEventType[] | undefined;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, projectId?: string | undefined, projectName?: string | undefined, eventTypes?: LinearEventType[] | undefined);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class LinearOutputConfig implements ConfigInstance {
    integrationId: string;
    teamId?: string | undefined;
    teamName?: string | undefined;
    projectId?: string | undefined;
    projectName?: string | undefined;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, teamId?: string | undefined, teamName?: string | undefined, projectId?: string | undefined, projectName?: string | undefined);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class GitHubConfig implements ConfigInstance {
    integrationId: string;
    repositoryIds: number[];
    eventTypes?: GitHubEventType[] | undefined;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, repositoryIds: number[], eventTypes?: GitHubEventType[] | undefined);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class JiraConfig implements ConfigInstance {
    integrationId: string;
    projectKey?: string | undefined;
    projectId?: string | undefined;
    eventTypes?: JiraEventType[] | undefined;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, projectKey?: string | undefined, projectId?: string | undefined, eventTypes?: JiraEventType[] | undefined);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class ConfluenceConfig implements ConfigInstance {
    integrationId: string;
    spaceName: string;
    spaceId: string;
    pageId: string;
    pageName: string;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, spaceName: string, spaceId: string, pageId: string, // Page ID (required for outputs - specific page to write to)
    pageName: string);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class PosthogConfig implements ConfigInstance {
    integrationId: string;
    projectId: string;
    projectName?: string | undefined;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, projectId: string, projectName?: string | undefined);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class DatadogConfig implements ConfigInstance {
    integrationId: string;
    defaultIndexes: string[];
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, defaultIndexes?: string[]);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class TimeTriggerConfig implements ConfigInstance {
    cronExpression: string;
    integrationType: IntegrationType;
    configType: ConfigType;
    integrationId: string;
    constructor(cronExpression: string);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class LaunchDarklyConfig implements ConfigInstance {
    integrationId: string;
    projectKey: string;
    environmentKeys: string[];
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, projectKey: string, environmentKeys: string[]);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class TerseConfig implements ConfigInstance {
    integrationType: IntegrationType;
    configType: ConfigType;
    integrationId: string;
    constructor();
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class WorkOSInputConfig implements ConfigInstance {
    integrationId: string;
    eventTypes: WorkOSEventType[];
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, eventTypes?: WorkOSEventType[]);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class WorkOSOutputConfig implements ConfigInstance {
    integrationId: string;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class AttioOutputConfig implements ConfigInstance {
    integrationId: string;
    objectSlug?: string | undefined;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string, objectSlug?: string | undefined);
    isComplete(): boolean;
    formatForAgent(): string;
}
export declare class SnowflakeOutputConfig implements ConfigInstance {
    integrationId: string;
    integrationType: IntegrationType;
    configType: ConfigType;
    constructor(integrationId: string);
    isComplete(): boolean;
    formatForAgent(): string;
}
type EnsureExhaustiveMetadata<T extends Record<ConfigType, new (...args: any[]) => ConfigInstance>> = T;
export type ConfigMetadataMap = EnsureExhaustiveMetadata<{
    [ConfigType.GMAIL]: typeof GmailConfig;
    [ConfigType.FIGMA]: typeof FigmaConfig;
    [ConfigType.SLACK]: typeof SlackConfig;
    [ConfigType.SLACK_OUTPUT]: typeof SlackOutputConfig;
    [ConfigType.GMAIL_OUTPUT]: typeof GmailOutputConfig;
    [ConfigType.GMAIL_DRAFT_OUTPUT]: typeof GmailDraftOutputConfig;
    [ConfigType.NOTION]: typeof NotionConfig;
    [ConfigType.LINEAR_INPUT]: typeof LinearInputConfig;
    [ConfigType.LINEAR_OUTPUT]: typeof LinearOutputConfig;
    [ConfigType.GITHUB]: typeof GitHubConfig;
    [ConfigType.JIRA]: typeof JiraConfig;
    [ConfigType.CONFLUENCE]: typeof ConfluenceConfig;
    [ConfigType.POSTHOG]: typeof PosthogConfig;
    [ConfigType.DATADOG]: typeof DatadogConfig;
    [ConfigType.TIME_TRIGGER]: typeof TimeTriggerConfig;
    [ConfigType.LAUNCHDARKLY]: typeof LaunchDarklyConfig;
    [ConfigType.TERSE]: typeof TerseConfig;
    [ConfigType.WORKOS_INPUT]: typeof WorkOSInputConfig;
    [ConfigType.WORKOS_OUTPUT]: typeof WorkOSOutputConfig;
    [ConfigType.ATTIO_OUTPUT]: typeof AttioOutputConfig;
    [ConfigType.SNOWFLAKE_OUTPUT]: typeof SnowflakeOutputConfig;
}>;
export declare const CONFIG_METADATA: ConfigMetadataMap;
export {};
