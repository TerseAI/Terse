export declare enum IntegrationType {
    GITHUB = "github",
    GMAIL = "gmail",
    LINEAR = "linear",
    ATLASSIAN = "atlassian",
    SLACK = "slack",
    NOTION = "notion",
    FIGMA = "figma",
    TERSE = "terse",
    POSTHOG = "posthog",
    DATADOG = "datadog",
    CRON_JOB = "cron_job",
    LAUNCHDARKLY = "launchdarkly",
    WORKOS = "workos",
    ATTIO = "attio",
    SNOWFLAKE = "snowflake"
}
export interface IntegrationDetails {
    type: IntegrationType;
    name: string;
    description: string;
    isInput?: boolean;
    isOutput?: boolean;
}
export declare const GmailIntegrationMetadata: {
    readonly type: IntegrationType.GMAIL;
    readonly name: "Gmail";
    readonly description: "Monitor incoming emails";
    readonly isInput: true;
    readonly isOutput: false;
};
export declare const NotionIntegrationMetadata: {
    readonly type: IntegrationType.NOTION;
    readonly name: "Notion";
    readonly description: "Update living documents";
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const LinearIntegrationMetadata: {
    readonly type: IntegrationType.LINEAR;
    readonly name: "Linear";
    readonly description: "Update tasks in Linear";
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const SlackIntegrationMetadata: {
    readonly type: IntegrationType.SLACK;
    readonly name: "Slack";
    readonly description: "Send and receive messages in Slack (channels, group DMs, and DMs). Triggers can use user token to read your DMs; skills can send to channels or users with either token.";
    readonly isInput: true;
    readonly isOutput: true;
};
export declare const FigmaIntegrationMetadata: {
    readonly type: IntegrationType.FIGMA;
    readonly name: "Figma";
    readonly description: "Trigger on Figma file comments (does not support file edits or design changes)";
    readonly isInput: true;
    readonly isOutput: false;
};
export declare const AtlassianIntegrationMetadata: {
    readonly type: IntegrationType.ATLASSIAN;
    readonly name: "Atlassian";
    readonly description: "Update documents in Atlassian";
    readonly isInput: true;
    readonly isOutput: false;
};
export declare const GithubIntegrationMetadata: {
    readonly type: IntegrationType.GITHUB;
    readonly name: "Github";
    readonly description: "Update repositories in Github";
    readonly isInput: true;
    readonly isOutput: true;
};
export declare const TerseIntegrationMetadata: {
    readonly type: IntegrationType.TERSE;
    readonly name: "Terse";
    readonly description: "Platform tools";
    readonly isInput: false;
    readonly isOutput: false;
};
export declare const PosthogIntegrationMetadata: {
    readonly type: IntegrationType.POSTHOG;
    readonly name: "Posthog";
    readonly description: "Update events in Posthog";
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const DatadogIntegrationMetadata: {
    readonly type: IntegrationType.DATADOG;
    readonly name: "Datadog";
    readonly description: "Search logs in Datadog";
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const CronJobIntegrationMetadata: {
    readonly type: IntegrationType.CRON_JOB;
    readonly name: "Scheduled Jobs";
    readonly description: "System integration for time-based triggers";
    readonly isInput: true;
    readonly isOutput: false;
};
export declare const LaunchDarklyIntegrationMetadata: {
    readonly type: IntegrationType.LAUNCHDARKLY;
    readonly name: "LaunchDarkly";
    readonly description: "Track feature flags";
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const WorkOSIntegrationMetadata: {
    readonly type: IntegrationType.WORKOS;
    readonly name: "WorkOS";
    readonly description: "Trigger on user lifecycle events and fetch/search users from your WorkOS account";
    readonly isInput: true;
    readonly isOutput: true;
};
export declare const AttioIntegrationMetadata: {
    readonly type: IntegrationType.ATTIO;
    readonly name: "Attio";
    readonly description: "Add and update contacts in Attio";
    readonly isInput: false;
    readonly isOutput: true;
};
export declare const SnowflakeIntegrationMetadata: {
    readonly type: IntegrationType.SNOWFLAKE;
    readonly name: "Snowflake";
    readonly description: "Run read-only queries against Snowflake data warehouses";
    readonly isInput: false;
    readonly isOutput: true;
};
export type IntegrationMetadataMap = Record<IntegrationType, IntegrationDetails>;
export declare const INTEGRATION_METADATA: IntegrationMetadataMap;
export interface IntegrationInstance {
    id: string;
}
export interface SlackInstallationOptions {
    isBotUser: boolean;
}
export type NoInstallationOptions = Record<string, never>;
export type AdditionalStateParams = Record<string, string>;
type EnsureExhaustiveInstallationOptions<T extends Record<IntegrationType, NoInstallationOptions | SlackInstallationOptions>> = T;
export type IntegrationInstallationOptions = EnsureExhaustiveInstallationOptions<{
    [IntegrationType.SLACK]: SlackInstallationOptions;
    [IntegrationType.GMAIL]: NoInstallationOptions;
    [IntegrationType.NOTION]: NoInstallationOptions;
    [IntegrationType.LINEAR]: NoInstallationOptions;
    [IntegrationType.ATLASSIAN]: NoInstallationOptions;
    [IntegrationType.GITHUB]: NoInstallationOptions;
    [IntegrationType.FIGMA]: NoInstallationOptions;
    [IntegrationType.TERSE]: NoInstallationOptions;
    [IntegrationType.POSTHOG]: NoInstallationOptions;
    [IntegrationType.DATADOG]: NoInstallationOptions;
    [IntegrationType.CRON_JOB]: NoInstallationOptions;
    [IntegrationType.LAUNCHDARKLY]: NoInstallationOptions;
    [IntegrationType.WORKOS]: NoInstallationOptions;
    [IntegrationType.ATTIO]: NoInstallationOptions;
    [IntegrationType.SNOWFLAKE]: NoInstallationOptions;
}>;
export type InstallationOptionsFor<T extends IntegrationType> = IntegrationInstallationOptions[T];
export interface SlackIntegration extends IntegrationInstance {
    id: string;
    teamId?: string;
    teamName?: string;
    isBotUser?: boolean;
}
export interface GmailIntegration extends IntegrationInstance {
    id: string;
    email: string;
    historyId: string;
    watchExpiration: Date;
}
export interface FigmaIntegration extends IntegrationInstance {
    id: string;
    handle: string;
    figma_user_id: string;
    token_expiry: Date;
}
export interface NotionIntegration extends IntegrationInstance {
    id: string;
    workspaceId?: string;
    workspaceName?: string;
}
export interface AtlassianIntegration extends IntegrationInstance {
    id: string;
    baseUrl: string;
    email: string;
    siteName?: string;
    projectKey?: string;
    projectName?: string;
}
export interface GithubIntegration extends IntegrationInstance {
    id: string;
    installation_id: number;
    account_name?: string | null;
}
export interface LinearIntegration extends IntegrationInstance {
    id: string;
    workspaceName: string;
}
export interface PosthogIntegration extends IntegrationInstance {
    id: string;
    email: string | null;
    orgName: string | null;
}
export interface LaunchDarklyIntegration extends IntegrationInstance {
    id: string;
    email: string | null;
    tokenName: string | null;
}
export interface DatadogIntegration extends IntegrationInstance {
    id: string;
    region: string;
}
export interface WorkOSIntegration extends IntegrationInstance {
    id: string;
    webhookUrl: string;
    environment: "live" | "test" | null;
}
export interface AttioIntegration extends IntegrationInstance {
    id: string;
    workspaceName?: string;
}
export interface SnowflakeIntegration extends IntegrationInstance {
    id: string;
    accountIdentifier: string;
    username: string;
    warehouse: string;
    databaseName?: string | null;
    schemaName?: string | null;
}
export interface IntegrationWithStatus {
    integrationType: IntegrationType;
    isActive: boolean;
}
export {};
