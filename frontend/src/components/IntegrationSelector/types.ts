import { Integration } from '../../context/Integrations';
import { NotionConfig, NotionPageConfig, SlackConfig, FigmaConfig } from '../../shared/types';

export interface IntegrationSelectorProps {
    integrationType: Integration;
    selectedIntegrationId?: string;
    onSelect: (integrationId: string) => void;
    label?: string;
    // Optional config handlers for integration-specific settings
    notionConfig?: NotionConfig;
    notionPageConfig?: NotionPageConfig;
    onNotionConfigChange?: (config: NotionConfig) => void;
    onNotionPageConfigChange?: (config: NotionPageConfig) => void;
    slackConfig?: SlackConfig;
    onSlackConfigChange?: (config: SlackConfig) => void;
    figmaConfig?: FigmaConfig;
    onFigmaConfigChange?: (config: FigmaConfig) => void;
}

export interface BaseIntegrationProps {
    selectedIntegrationId?: string;
    onSelect: (integrationId: string) => void;
    integrations: any[];
    isLoading: boolean;
    isConnecting: boolean;
    onConnect: () => void;
    label?: string;
}

