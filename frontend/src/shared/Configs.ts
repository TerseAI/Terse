import { IntegrationType } from "./Integrations";

export enum ConfigType {
    GMAIL = 'gmail',
    GMAIL_OUTPUT = 'gmail_output',
    FIGMA = 'figma',
    SLACK = 'slack',
    SLACK_OUTPUT = 'slack_output',
    NOTION_PAGE = 'notion_page',
    NOTION_DATABASE = 'notion_database',
    LINEAR_INPUT = 'linear_input',
    LINEAR_OUTPUT = 'linear_output',
    GITHUB = 'github',
    GITHUB_KB = 'github_kb',
    JIRA = 'jira',
    CONFLUENCE = 'confluence',
    POSTHOG = "POSTHOG",
    DATADOG = "DATADOG",
    TIME_TRIGGER = 'time_trigger',
}

// MARK: Config Metadata
export interface ConfigDetails {
    configType: ConfigType;
    name: string;
    description: string;
    isInput: boolean;
    isOutput: boolean;
    isKnowledgeBase: boolean;
}

// Metadata objects - using const objects instead of classes
export const GmailConfigMetadata = {
    configType: ConfigType.GMAIL,
    name: 'Gmail',
    description: 'Monitor incoming emails',
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const FigmaConfigMetadata = {
    configType: ConfigType.FIGMA,
    name: 'Figma',
    description: 'Monitor design changes in Figma files',
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const SlackConfigMetadata = {
    configType: ConfigType.SLACK,
    name: 'Slack',
    description: 'Monitor messages in Slack channels or DMs',
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const SlackOutputConfigMetadata = {
    configType: ConfigType.SLACK_OUTPUT,
    name: 'Slack',
    description: 'Send messages to Slack channels or DMs',
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const GmailOutputConfigMetadata = {
    configType: ConfigType.GMAIL_OUTPUT,
    name: 'Gmail',
    description: 'Send emails via Gmail',
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const NotionDatabaseConfigMetadata = {
    configType: ConfigType.NOTION_DATABASE,
    name: 'Notion Database',
    description: 'Update and monitor Notion databases',
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const NotionPageConfigMetadata = {
    configType: ConfigType.NOTION_PAGE,
    name: 'Notion Page',
    description: 'Update and monitor Notion pages',
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const LinearInputConfigMetadata = {
    configType: ConfigType.LINEAR_INPUT,
    name: 'Linear',
    description: 'Monitor Linear issues',
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;


export const LinearOutputConfigMetadata = {
    configType: ConfigType.LINEAR_OUTPUT,
    name: 'Linear',
    description: 'Update Linear issues',
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const GitHubConfigMetadata = {
    configType: ConfigType.GITHUB,
    name: 'GitHub',
    description: 'Monitor GitHub repository events',
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const JiraConfigMetadata = {
    configType: ConfigType.JIRA,
    name: 'Jira',
    description: 'Monitor and update Jira issues',
    isInput: true,
    isOutput: true,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const ConfluenceConfigMetadata = {
    configType: ConfigType.CONFLUENCE,
    name: 'Confluence',
    description: 'Update Confluence pages',
    isInput: false,
    isOutput: true,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const PosthogConfigMetadata = {
    configType: ConfigType.POSTHOG,
    name: 'Posthog',
    description: 'Track user events',
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies ConfigDetails;

export const DatadogConfigMetadata = {
    configType: ConfigType.DATADOG,
    name: 'Datadog',
    description: 'Search logs in Datadog',
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true
} as const satisfies ConfigDetails;

export const TimeTriggerConfigMetadata = {
    configType: ConfigType.TIME_TRIGGER,
    name: 'Time Trigger',
    description: 'Run on a schedule (daily, weekly, etc.)',
    isInput: true,
    isOutput: false,
    isKnowledgeBase: false,
} as const satisfies ConfigDetails;

export const GitHubKBConfigMetadata = {
    configType: ConfigType.GITHUB_KB,
    name: 'GitHub Codebase',
    description: 'Search and read code in repositories',
    isInput: false,
    isOutput: false,
    isKnowledgeBase: true,
} as const satisfies ConfigDetails;

export type ConfigDetailsMap = Record<ConfigType, ConfigDetails>;

export const CONFIG_DETAILS: ConfigDetailsMap = {
    [ConfigType.GMAIL]: GmailConfigMetadata,
    [ConfigType.GMAIL_OUTPUT]: GmailOutputConfigMetadata,
    [ConfigType.FIGMA]: FigmaConfigMetadata,
    [ConfigType.SLACK]: SlackConfigMetadata,
    [ConfigType.SLACK_OUTPUT]: SlackOutputConfigMetadata,
    [ConfigType.NOTION_DATABASE]: NotionDatabaseConfigMetadata,
    [ConfigType.NOTION_PAGE]: NotionPageConfigMetadata,
    [ConfigType.LINEAR_INPUT]: LinearInputConfigMetadata,
    [ConfigType.LINEAR_OUTPUT]: LinearOutputConfigMetadata,
    [ConfigType.GITHUB]: GitHubConfigMetadata,
    [ConfigType.GITHUB_KB]: GitHubKBConfigMetadata,
    [ConfigType.JIRA]: JiraConfigMetadata,
    [ConfigType.CONFLUENCE]: ConfluenceConfigMetadata,
    [ConfigType.POSTHOG]: PosthogConfigMetadata,
    [ConfigType.DATADOG]: DatadogConfigMetadata,
    [ConfigType.TIME_TRIGGER]: TimeTriggerConfigMetadata,
} as const satisfies ConfigDetailsMap;

export interface ConfigInstance {
    integrationId: string;
    integrationType: IntegrationType;
    configType: ConfigType;
    isComplete(): boolean;
    formatForAgent(): string;
}

export class GmailConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.GMAIL;
    configType: ConfigType = ConfigType.GMAIL;

    constructor(
        public integrationId: string,
    ) {
    }

    isComplete(): boolean {
        // Gmail only requires integrationId (base check handled in isInputComplete)
        return true;
    }

    formatForAgent(): string {
        return `Type: Gmail\nIntegration ID: ${this.integrationId}`;
    }
};

export class FigmaConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.FIGMA;
    configType: ConfigType = ConfigType.FIGMA;

    constructor(
        public integrationId: string,
        public fileKey: string,
        public fileName: string, // Optional display name
        public teamId: string, // Figma team ID (required for webhook creation)
    ) {
    }

    isComplete(): boolean {
        // Figma requires both fileKey and teamId
        return !!(this.fileKey && this.teamId);
    }

    formatForAgent(): string {
        const parts = [`Type: Figma`, `Integration ID: ${this.integrationId}`];
        if (this.fileName) {
            parts.push(`File: ${this.fileName}`);
        }
        if (this.fileKey) {
            parts.push(`File Key: ${this.fileKey}`);
        }
        return parts.join('\n');
    }
};
// Typed config per integration type
export class SlackConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.SLACK;
    configType: ConfigType = ConfigType.SLACK;

    constructor(
        public integrationId: string,
        public channelId?: string,
        public channelName?: string,
        public listenToUserDms: boolean = false,
        public userIds?: string[],
        public acknowledgeWithEmoji: boolean = false,
    ) {
    }

    isComplete(): boolean {
        // Slack is complete if either channelId is set OR listenToUserDms is true
        return !!(this.channelId || this.listenToUserDms);
    }

    formatForAgent(): string {
        const parts = [`Type: Slack`, `Integration ID: ${this.integrationId}`];
        if (this.channelName) {
            parts.push(`Channel: ${this.channelName}`);
        } else if (this.channelId) {
            parts.push(`Channel ID: ${this.channelId}`);
        }
        if (this.listenToUserDms) {
            parts.push(`Listening to user DMs: Yes`);
        }

        if (this.userIds) {
            parts.push(`Users: ${this.userIds.join(', ')}`);
        }

        return parts.join('\n');
    }
};

export class SlackOutputConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.SLACK;
    configType: ConfigType = ConfigType.SLACK_OUTPUT;

    constructor(
        public integrationId: string,
        public channelId?: string,
        public channelName?: string,
    ) {
    }

    isComplete(): boolean {
        // Slack output is complete if channelId is set
        return !!this.channelId;
    }

    formatForAgent(): string {
        const parts = [`Type: Slack Output`, `Integration ID: ${this.integrationId}`];
        if (this.channelName) {
            parts.push(`Channel: ${this.channelName}`);
        } else if (this.channelId) {
            parts.push(`Channel ID: ${this.channelId}`);
        }
        return parts.join('\n');
    }
};

export class GmailOutputConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.GMAIL;
    configType: ConfigType = ConfigType.GMAIL_OUTPUT;

    constructor(
        public integrationId: string,
    ) {
    }

    isComplete(): boolean {
        // Gmail output only requires integrationId
        return true;
    }

    formatForAgent(): string {
        return `Type: Gmail Output\nIntegration ID: ${this.integrationId}`;
    }
};

export class NotionConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.NOTION;
    configType: ConfigType = ConfigType.NOTION_DATABASE;

    constructor(
        public integrationId: string,
        public databaseId?: string,
        public databaseName?: string,
    ) {
    }

    isComplete(): boolean {
        // Notion requires databaseId
        return !!this.databaseId;
    }

    formatForAgent(): string {
        const parts = [`Type: Notion Database`, `Integration ID: ${this.integrationId}`];
        if (this.databaseName) {
            parts.push(`Database: ${this.databaseName}`);
        } else if (this.databaseId) {
            parts.push(`Database ID: ${this.databaseId}`);
        }
        return parts.join('\n');
    }
};

export class NotionPageConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.NOTION;
    configType: ConfigType = ConfigType.NOTION_PAGE;
    
    constructor(
        public integrationId: string,
        public pageId?: string,
        public pageName?: string,
    ) {
    }

    isComplete(): boolean {
        // Notion Page requires pageId
        return !!this.pageId;
    }

    formatForAgent(): string {
        const parts = [`Type: Notion Page`, `Integration ID: ${this.integrationId}`];
        if (this.pageName) {
            parts.push(`Page: ${this.pageName}`);
        } else if (this.pageId) {
            parts.push(`Page ID: ${this.pageId}`);
        }
        return parts.join('\n');
    }
};

export class LinearInputConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.LINEAR;
    configType: ConfigType = ConfigType.LINEAR_INPUT;

    constructor(
        public integrationId: string,
        public projectId?: string,
        public projectName?: string,
    ) {
    }

    isComplete(): boolean {
        return true;
    }

    formatForAgent(): string {
        const parts = [`Type: Linear`, `Integration ID: ${this.integrationId}`];
        if (this.projectName) {
            parts.push(`Project: ${this.projectName}`);
        } else if (this.projectId) {
            parts.push(`Project ID: ${this.projectId}`);
        }
        return parts.join('\n');
    }
}

export class LinearOutputConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.LINEAR;
    configType: ConfigType = ConfigType.LINEAR_OUTPUT;

    constructor(
        public integrationId: string,
        public teamId?: string,
        public teamName?: string,
    ) {
    }

    isComplete(): boolean {
        return !!this.teamId;
    }

    formatForAgent(): string {
        const parts = [`Type: Linear`, `Integration ID: ${this.integrationId}`];
        if (this.teamName) {
            parts.push(`Team: ${this.teamName}`);
        } else if (this.teamId) {
            parts.push(`Team ID: ${this.teamId}`);
        }
        return parts.join('\n');
    }
}



export class GitHubConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.GITHUB;
    configType: ConfigType = ConfigType.GITHUB;
    
    constructor(
        public integrationId: string,
        public repositoryIds: number[],
    ) {
    }

    isComplete(): boolean {
        // GitHub only requires integrationId (base check handled in isInputComplete)
        return true;
    }

    formatForAgent(): string {
        const parts = [`Type: GitHub`, `Integration ID: ${this.integrationId}`];
        if (this.repositoryIds.length > 0) {
            parts.push(`Repositories: ${this.repositoryIds.join(', ')}`);
        }
        return parts.join('\n');
    }
};

export class JiraConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.ATLASSIAN;
    configType: ConfigType = ConfigType.JIRA;

    constructor(
        public integrationId: string,
        public projectKey?: string,
        public projectId?: string,
    ) {
    }

    isComplete(): boolean {
        // Jira only requires integrationId (base check handled in isInputComplete)
        return true;
    }

    formatForAgent(): string {
        const parts = [`Type: Jira`, `Integration ID: ${this.integrationId}`];
        if (this.projectKey) {
            parts.push(`Project Key: ${this.projectKey}`);
        } else if (this.projectId) {
            parts.push(`Project ID: ${this.projectId}`);
        }
        return parts.join('\n');
    }
};

export class ConfluenceConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.ATLASSIAN;
    configType: ConfigType = ConfigType.CONFLUENCE;
    
    constructor(
        public integrationId: string,
        public spaceName: string,
        public spaceId: string,
        public pageId: string, // Page ID (required for outputs - specific page to write to)
        public pageName: string, // Page display name (for UI, optional)
    ) {
    }

    isComplete(): boolean {
        // Confluence only requires integrationId (base check handled in isInputComplete)
        return true;
    }

    formatForAgent(): string {
        const parts = [`Type: Confluence`, `Integration ID: ${this.integrationId}`];
        if (this.spaceName) {
            parts.push(`Space: ${this.spaceName}`);
        }
        if (this.pageName) {
            parts.push(`Page: ${this.pageName}`);
        } else if (this.pageId) {
            parts.push(`Page ID: ${this.pageId}`);
        }
        return parts.join('\n');
    }
};

export class PosthogConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.POSTHOG;
    configType: ConfigType = ConfigType.POSTHOG;

    constructor(
        public integrationId: string,
        public projectId: string,
        public projectName?: string,
        public canReadLogs?: boolean,
        public canReadSessionRecordings?: boolean
    ) {
    }

    isComplete(): boolean {
        // Confluence only requires integrationId (base check handled in isInputComplete)
        return !!(this.projectId && (this.canReadLogs || this.canReadSessionRecordings));
    }

    formatForAgent(): string {
        const parts = [`Type: Posthog`, `Integration ID: ${this.integrationId}`];
        if (this.projectId) {
            parts.push(`Project ID: ${this.projectId}`);
        }
        if (this.projectName) {
            parts.push(`Project: ${this.projectName}`);
        }
        if (this.canReadLogs) {
            parts.push(`Can read logs: Yes`);
        }
        if (this.canReadSessionRecordings) {
            parts.push(`Can read session recordings: Yes`);
        }
        return parts.join('\n');
    }
}

export class DatadogConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.DATADOG;
    configType: ConfigType = ConfigType.DATADOG;

    constructor(
        public integrationId: string,
        public defaultIndexes: string[] = ["main"]
    ) {
    }

    isComplete(): boolean {
        return !!this.integrationId;
    }

    formatForAgent(): string {
        const parts = [`Type: Datadog`, `Integration ID: ${this.integrationId}`];
        if (this.defaultIndexes && this.defaultIndexes.length > 0) {
            parts.push(`Default indexes: ${this.defaultIndexes.join(', ')}`);
        }
        return parts.join('\n');
    }
}

export class TimeTriggerConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.CRON_JOB;
    configType: ConfigType = ConfigType.TIME_TRIGGER;
    // System integration - no real integration ID needed
    integrationId: string = 'system';

    constructor(
        public cronExpression: string,
    ) {
    }

    isComplete(): boolean {
        return !!this.cronExpression;
    }

    formatForAgent(): string {
        const parts = [`Type: Time Trigger`];
        if (this.cronExpression) {
            parts.push(`Schedule (UTC): ${this.cronExpression}`);
        }
        return parts.join('\n');
    }
}

export class GitHubKBConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.GITHUB;
    configType: ConfigType = ConfigType.GITHUB_KB;
    
    constructor(
        public integrationId: string,
        public repositoryIds: number[],
        public repositoryNames: string[], // Full names like "owner/repo"
    ) {
    }

    isComplete(): boolean {
        return this.repositoryIds.length > 0;
    }

    formatForAgent(): string {
        const parts = [`Type: GitHub Codebase`, `Integration ID: ${this.integrationId}`];
        if (this.repositoryNames.length > 0) {
            parts.push(`Repositories: ${this.repositoryNames.join(', ')}`);
        }
        return parts.join('\n');
    }
}

// To be studied Later!!
type EnsureExhaustiveMetadata<T extends Record<ConfigType, new (...args: any[]) => ConfigInstance>> = T;

export type ConfigMetadataMap = EnsureExhaustiveMetadata<{
    [ConfigType.GMAIL]: typeof GmailConfig;
    [ConfigType.GMAIL_OUTPUT]: typeof GmailOutputConfig;
    [ConfigType.FIGMA]: typeof FigmaConfig;
    [ConfigType.SLACK]: typeof SlackConfig;
    [ConfigType.SLACK_OUTPUT]: typeof SlackOutputConfig;
    [ConfigType.NOTION_PAGE]: typeof NotionPageConfig;
    [ConfigType.NOTION_DATABASE]: typeof NotionConfig;
    [ConfigType.LINEAR_INPUT]: typeof LinearInputConfig;
    [ConfigType.LINEAR_OUTPUT]: typeof LinearOutputConfig;
    [ConfigType.GITHUB]: typeof GitHubConfig;
    [ConfigType.GITHUB_KB]: typeof GitHubKBConfig;
    [ConfigType.JIRA]: typeof JiraConfig;
    [ConfigType.CONFLUENCE]: typeof ConfluenceConfig;
    [ConfigType.POSTHOG]: typeof PosthogConfig;
    [ConfigType.DATADOG]: typeof DatadogConfig;
    [ConfigType.TIME_TRIGGER]: typeof TimeTriggerConfig;
}>;

export const CONFIG_METADATA: ConfigMetadataMap = {
    [ConfigType.GMAIL]: GmailConfig,
    [ConfigType.GMAIL_OUTPUT]: GmailOutputConfig,
    [ConfigType.FIGMA]: FigmaConfig,
    [ConfigType.SLACK]: SlackConfig,
    [ConfigType.SLACK_OUTPUT]: SlackOutputConfig,
    [ConfigType.NOTION_PAGE]: NotionPageConfig,
    [ConfigType.NOTION_DATABASE]: NotionConfig,
    [ConfigType.LINEAR_INPUT]: LinearInputConfig,
    [ConfigType.LINEAR_OUTPUT]: LinearOutputConfig,
    [ConfigType.GITHUB]: GitHubConfig,
    [ConfigType.GITHUB_KB]: GitHubKBConfig,
    [ConfigType.JIRA]: JiraConfig,
    [ConfigType.CONFLUENCE]: ConfluenceConfig,
    [ConfigType.POSTHOG]: PosthogConfig,
    [ConfigType.DATADOG]: DatadogConfig,
    [ConfigType.TIME_TRIGGER]: TimeTriggerConfig,
} as const satisfies ConfigMetadataMap;