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


export interface ConfigInstance {
    integrationId: string;
    integrationType: IntegrationType;
    configType: ConfigType;
}


export class GmailConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.GMAIL;
    configType: ConfigType = ConfigType.GMAIL;

    constructor(
        public integrationId: string,
    ) {
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
};

export class GitHubConfig implements ConfigInstance {
    integrationType: IntegrationType = IntegrationType.GITHUB;
    configType: ConfigType = ConfigType.GITHUB;

    constructor(
        public integrationId: string,
        public repositoryIds: number[],
    ) {
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