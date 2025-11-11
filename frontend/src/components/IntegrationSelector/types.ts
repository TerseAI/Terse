import { IntegrationInstance } from '@/utility/IntegrationFormatters';
import { Integration } from '../../context/Integrations';
import { NotionConfig, NotionPageConfig, SlackConfig, FigmaConfig, ConfluenceConfig, GmailConfig } from '../../shared/types';

export interface IntegrationSelectorProps {
    integrationType: Integration;
    selectedIntegrationId?: string;
    onSelect: (integrationId: string) => void;
    label?: string;
    // Optional config handlers for integration-specific settings
    gmailConfig?: GmailConfig;
    onGmailConfigChange?: (config: GmailConfig) => void;
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
    integrations: IntegrationInstance[];
    isLoading: boolean;
    isConnecting: boolean;
    onConnect: () => void;
    label?: string;
    variant?: 'card' | 'dialog';
}

