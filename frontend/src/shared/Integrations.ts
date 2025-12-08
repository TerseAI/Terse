// IMPORTANT: CHANGE THIS FOR NEW INTEGRATIONS. SHOULD MATCH PRISMA ENUM
export enum IntegrationType {
    GITHUB = 'github',
    GMAIL = 'gmail',
    LINEAR = 'linear',
    ATLASSIAN = 'atlassian',
    SLACK = 'slack',
    NOTION = 'notion',
    FIGMA = 'figma',
    TERSE = 'terse',
}

// MARK: Integration Metadata
export interface IntegrationDetails {
    type: IntegrationType;
    name: string;
    description: string;
    isInput?: boolean;
    isOutput?: boolean;
}

// Metadata objects - using const objects instead of classes
export const GmailIntegrationMetadata = {
    type: IntegrationType.GMAIL,
    name: 'Gmail',
    description: 'Monitor incoming emails',
    isInput: true,
    isOutput: false,
} as const satisfies IntegrationDetails;

export const NotionIntegrationMetadata = {
    type: IntegrationType.NOTION,
    name: 'Notion',
    description: 'Update living documents',
    isInput: false,
    isOutput: true,
} as const satisfies IntegrationDetails;

export const LinearIntegrationMetadata = {
    type: IntegrationType.LINEAR,
    name: 'Linear',
    description: 'Update tasks in Linear',
    isInput: false,
    isOutput: true,
} as const satisfies IntegrationDetails;

export const SlackIntegrationMetadata = {
    type: IntegrationType.SLACK,
    name: 'Slack',
    description: 'Send and receive messages in Slack',
    isInput: true,
    isOutput: false,
} as const satisfies IntegrationDetails;

export const FigmaIntegrationMetadata = {
    type: IntegrationType.FIGMA,
    name: 'Figma',
    description: 'Update designs in Figma',
    isInput: true,
    isOutput: false,
} as const satisfies IntegrationDetails;

export const AtlassianIntegrationMetadata = {
    type: IntegrationType.ATLASSIAN,
    name: 'Atlassian',
    description: 'Update documents in Atlassian',
    isInput: true,
    isOutput: false,
} as const satisfies IntegrationDetails;

export const GithubIntegrationMetadata = {
    type: IntegrationType.GITHUB,
    name: 'Github',
    description: 'Update repositories in Github',
    isInput: true,
    isOutput: false,
} as const satisfies IntegrationDetails;

export const TerseIntegrationMetadata = {
    type: IntegrationType.TERSE,
    name: 'Terse',
    description: 'Platform tools',
    isInput: false,
    isOutput: false,
} as const satisfies IntegrationDetails;

export type IntegrationMetadataMap = Record<IntegrationType, IntegrationDetails>; // Allow indexing with any IntegrationType

export const INTEGRATION_METADATA: IntegrationMetadataMap = {
    [IntegrationType.GMAIL]: GmailIntegrationMetadata,
    [IntegrationType.NOTION]: NotionIntegrationMetadata,
    [IntegrationType.LINEAR]: LinearIntegrationMetadata,
    [IntegrationType.ATLASSIAN]: AtlassianIntegrationMetadata,
    [IntegrationType.SLACK]: SlackIntegrationMetadata,
    [IntegrationType.GITHUB]: GithubIntegrationMetadata,
    [IntegrationType.FIGMA]: FigmaIntegrationMetadata,
    [IntegrationType.TERSE]: TerseIntegrationMetadata,
} as const satisfies IntegrationMetadataMap;


export interface IntegrationInstance {
    id: string;
 }


export interface SlackInstallationOptions {
    isBotUser: boolean;
}

export type NoInstallationOptions = Record<string, never>;


export type IntegrationInstallationOptions = {
    [IntegrationType.SLACK]: SlackInstallationOptions;
    [IntegrationType.GMAIL]: NoInstallationOptions;
    [IntegrationType.NOTION]: NoInstallationOptions;
    [IntegrationType.LINEAR]: NoInstallationOptions;
    [IntegrationType.ATLASSIAN]: NoInstallationOptions;
    [IntegrationType.GITHUB]: NoInstallationOptions;
    [IntegrationType.FIGMA]: NoInstallationOptions;
    [IntegrationType.TERSE]: NoInstallationOptions;
} 

export type InstallationOptionsFor<T extends IntegrationType> = IntegrationInstallationOptions[T];


export interface SlackIntegration extends IntegrationInstance {
    id: string;
    teamId?: string;
    teamName?: string;
    isBotUser?: boolean;
};

export interface GmailIntegration extends IntegrationInstance {
    id: string;
    email: string; // User's Gmail address
    historyId: string; // For tracking changes since last sync
    watchExpiration: Date; // When the watch needs to be renewed (max 7 days)
};

export interface FigmaIntegration extends IntegrationInstance {
    id: string;
    handle: string;
    figma_user_id: string;
    token_expiry: Date;
};

export interface NotionIntegration extends IntegrationInstance {
    id: string;
    workspaceId?: string;
    workspaceName?: string;
};

export interface AtlassianIntegration extends IntegrationInstance {
    id: string;
    baseUrl: string;
    email: string;
    siteName?: string;
    projectKey?: string;
    projectName?: string;
};

export interface GithubIntegration extends IntegrationInstance {
    id: string;
    installation_id: number;
    account_name?: string | null; // GitHub username or organization name where the app was installed
};

export interface LinearIntegration extends IntegrationInstance {
    id: string;
    workspaceName: string;
};

export interface IntegrationWithStatus {
    integrationType: IntegrationType;
    isActive: boolean;
}