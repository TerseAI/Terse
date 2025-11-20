import { IntegrationType } from "./Integrations";

export enum ConfigType {
    GMAIL = 'gmail',
    FIGMA = 'figma',
    SLACK = 'slack',
    NOTION_PAGE = 'notion_page',
    NOTION_DATABASE = 'notion_database',
    LINEAR = 'linear',
    GITHUB = 'github',
    JIRA = 'jira',
    CONFLUENCE = 'confluence',
}

// MARK: Config Metadata
export interface ConfigDetails {
    configType: ConfigType;
    name: string;
    description: string;
    isInput: boolean;
    isOutput: boolean;
}

// Metadata objects - using const objects instead of classes
export const GmailConfigMetadata = {
    configType: ConfigType.GMAIL,
    name: 'Gmail',
    description: 'Monitor incoming emails',
    isInput: true,
    isOutput: false,
} as const satisfies ConfigDetails;

export const FigmaConfigMetadata = {
    configType: ConfigType.FIGMA,
    name: 'Figma',
    description: 'Monitor design changes in Figma files',
    isInput: true,
    isOutput: false,
} as const satisfies ConfigDetails;

export const SlackConfigMetadata = {
    configType: ConfigType.SLACK,
    name: 'Slack',
    description: 'Monitor messages in Slack channels or DMs',
    isInput: true,
    isOutput: false,
} as const satisfies ConfigDetails;

export const NotionDatabaseConfigMetadata = {
    configType: ConfigType.NOTION_DATABASE,
    name: 'Notion Database',
    description: 'Update and monitor Notion databases',
    isInput: false,
    isOutput: true,
} as const satisfies ConfigDetails;

export const NotionPageConfigMetadata = {
    configType: ConfigType.NOTION_PAGE,
    name: 'Notion Page',
    description: 'Update and monitor Notion pages',
    isInput: false,
    isOutput: true,
} as const satisfies ConfigDetails;

export const LinearConfigMetadata = {
    configType: ConfigType.LINEAR,
    name: 'Linear',
    description: 'Monitor and update Linear issues',
    isInput: true,
    isOutput: true,
} as const satisfies ConfigDetails;

export const GitHubConfigMetadata = {
    configType: ConfigType.GITHUB,
    name: 'GitHub',
    description: 'Monitor GitHub repository events',
    isInput: true,
    isOutput: false,
} as const satisfies ConfigDetails;

export const JiraConfigMetadata = {
    configType: ConfigType.JIRA,
    name: 'Jira',
    description: 'Monitor and update Jira issues',
    isInput: true,
    isOutput: true,
} as const satisfies ConfigDetails;

export const ConfluenceConfigMetadata = {
    configType: ConfigType.CONFLUENCE,
    name: 'Confluence',
    description: 'Update Confluence pages',
    isInput: false,
    isOutput: true,
} as const satisfies ConfigDetails;

export type ConfigDetailsMap = Record<ConfigType, ConfigDetails>;

export const CONFIG_DETAILS: ConfigDetailsMap = {
    [ConfigType.GMAIL]: GmailConfigMetadata,
    [ConfigType.FIGMA]: FigmaConfigMetadata,
    [ConfigType.SLACK]: SlackConfigMetadata,
    [ConfigType.NOTION_DATABASE]: NotionDatabaseConfigMetadata,
    [ConfigType.NOTION_PAGE]: NotionPageConfigMetadata,
    [ConfigType.LINEAR]: LinearConfigMetadata,
    [ConfigType.GITHUB]: GitHubConfigMetadata,
    [ConfigType.JIRA]: JiraConfigMetadata,
    [ConfigType.CONFLUENCE]: ConfluenceConfigMetadata,
} as const satisfies ConfigDetailsMap;

export interface ConfigInstance {
    integrationId: string;
    integrationType: IntegrationType;
    configType: ConfigType;
    isComplete(): boolean;
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
    ) {
    }

    isComplete(): boolean {
        // Slack is complete if either channelId is set OR listenToUserDms is true
        return !!(this.channelId || this.listenToUserDms);
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
};

export class LinearConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.LINEAR;
    configType: ConfigType = ConfigType.LINEAR;

    constructor(
        public integrationId: string,
        public projectId?: string,
        public projectName?: string,
    ) {
    }

    isComplete(): boolean {
        // Linear only requires integrationId (base check handled in isInputComplete)
        return true;
    }
};

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
};

// To be studied Later!!
type EnsureExhaustiveMetadata<T extends Record<ConfigType, new (...args: any[]) => ConfigInstance>> = T;

export type ConfigMetadataMap = EnsureExhaustiveMetadata<{
    [ConfigType.GMAIL]: typeof GmailConfig;
    [ConfigType.FIGMA]: typeof FigmaConfig;
    [ConfigType.SLACK]: typeof SlackConfig;
    [ConfigType.NOTION_PAGE]: typeof NotionPageConfig;
    [ConfigType.NOTION_DATABASE]: typeof NotionConfig;
    [ConfigType.LINEAR]: typeof LinearConfig;
    [ConfigType.GITHUB]: typeof GitHubConfig;
    [ConfigType.JIRA]: typeof JiraConfig;
    [ConfigType.CONFLUENCE]: typeof ConfluenceConfig;
}>;

export const CONFIG_METADATA: ConfigMetadataMap = {
    [ConfigType.GMAIL]: GmailConfig,
    [ConfigType.FIGMA]: FigmaConfig,
    [ConfigType.SLACK]: SlackConfig,
    [ConfigType.NOTION_PAGE]: NotionPageConfig,
    [ConfigType.NOTION_DATABASE]: NotionConfig,
    [ConfigType.LINEAR]: LinearConfig,
    [ConfigType.GITHUB]: GitHubConfig,
    [ConfigType.JIRA]: JiraConfig,
    [ConfigType.CONFLUENCE]: ConfluenceConfig,
} as const satisfies ConfigMetadataMap;