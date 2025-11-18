import { IntegrationType } from "@/shared/Integrations"
import { NotionConfig, NotionPageConfig, SlackConfig, FigmaConfig, ConfluenceConfig, GmailConfig, GitHubConfig } from '../../shared/types';

export interface IntegrationSelectorProps {
    integrationType: IntegrationType;
    selectedIntegrationId?: string;
    onSelect: (integrationId: string) => void;
    label?: string;
    // Optional config handlers for integration-specific settings
    gmailConfig?: GmailConfig;
    onGmailConfigChange?: (config: GmailConfig) => void;
    githubConfig?: GitHubConfig;
    onGithubConfigChange?: (config: GitHubConfig) => void;
    notionConfig?: NotionConfig;
    notionPageConfig?: NotionPageConfig;
    onNotionConfigChange?: (config: NotionConfig) => void;
    onNotionPageConfigChange?: (config: NotionPageConfig) => void;
    slackConfig?: SlackConfig;
    onSlackConfigChange?: (config: SlackConfig) => void;
    figmaConfig?: FigmaConfig;
    onFigmaConfigChange?: (config: FigmaConfig) => void;
    confluenceConfig?: ConfluenceConfig;
    onConfluenceConfigChange?: (config: ConfluenceConfig) => void;
}

export interface BaseIntegrationProps {
    selectedIntegrationId?: string;
    onSelect: (integrationId: string) => void;
    isConnecting: boolean;
    onConnect: () => void;
    label?: string;
    variant?: 'card' | 'dialog';
}

