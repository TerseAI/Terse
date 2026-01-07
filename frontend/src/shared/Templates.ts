import { ConfigType } from './Configs';
import { IntegrationType } from './Integrations';
import {
    GmailConfig,
    FigmaConfig,
    SlackConfig,
    NotionConfig,
    NotionPageConfig,
    LinearInputConfig,
    LinearOutputConfig,
    GitHubConfig,
    JiraConfig,
    ConfluenceConfig,
    PosthogConfig,
} from './Configs';

// Utility type to convert a Config class to its template form
// - Removes methods (isComplete, formatForAgent)
// - Makes integrationId optional
// - Keeps configType and integrationType required (discriminators)
// - Makes all other properties optional
type ConfigToTemplate<T extends { configType: ConfigType; integrationType: IntegrationType; integrationId: string }> = 
    Pick<T, 'configType' | 'integrationType'> &  // Keep discriminators required
    { integrationId?: T['integrationId'] } &     // Make integrationId optional
    Partial<Omit<T, 'configType' | 'integrationType' | 'integrationId' | 'isComplete' | 'formatForAgent'>>;  // Make rest optional

// Derive template types from Config classes
export type GmailConfigTemplate = ConfigToTemplate<GmailConfig>;
export type FigmaConfigTemplate = ConfigToTemplate<FigmaConfig>;
export type SlackConfigTemplate = ConfigToTemplate<SlackConfig>;
export type NotionDatabaseConfigTemplate = ConfigToTemplate<NotionConfig>;
export type NotionPageConfigTemplate = ConfigToTemplate<NotionPageConfig>;
export type LinearInputConfigTemplate = ConfigToTemplate<LinearInputConfig>;
export type LinearOutputConfigTemplate = ConfigToTemplate<LinearOutputConfig>;
export type GitHubConfigTemplate = ConfigToTemplate<GitHubConfig>;
export type JiraConfigTemplate = ConfigToTemplate<JiraConfig>;
export type ConfluenceConfigTemplate = ConfigToTemplate<ConfluenceConfig>;
export type PosthogConfigTemplate = ConfigToTemplate<PosthogConfig>;

// Union of all config templates
export type ConfigTemplate =
    | GmailConfigTemplate
    | FigmaConfigTemplate
    | SlackConfigTemplate
    | NotionDatabaseConfigTemplate
    | NotionPageConfigTemplate
    | LinearInputConfigTemplate
    | LinearOutputConfigTemplate
    | GitHubConfigTemplate
    | JiraConfigTemplate
    | ConfluenceConfigTemplate
    | PosthogConfigTemplate;

// Channel prompt template (matches ChannelPrompt from types.ts)
export interface ChannelPromptTemplate {
    text: string;
}

// Channel notification settings template (matches ChannelNotificationSettings structure)
export interface ChannelNotificationSettingsTemplate {
    enabled: boolean;
    actionTypes: Array<'create' | 'update' | 'delete' | 'read'>;
}

// Channel input template (based on TransientChannelInput structure, but for templates)
export interface ChannelInputTemplate {
    id?: string; // Optional in templates
    config: ConfigTemplate; // Required in templates (unlike TransientChannelInput where it's optional)
}

// Channel output template (based on TransientChannelOutput structure, but for templates)
export interface ChannelOutputTemplate {
    id?: string; // Optional in templates
    config: ConfigTemplate; // Required in templates (unlike TransientChannelOutput where it's optional)
}

// Channel knowledge base template (based on TransientKnowledgeBase structure, but for templates)
export interface ChannelKnowledgeBaseTemplate {
    id?: string; // Optional in templates
    config: ConfigTemplate; // Required in templates (unlike TransientKnowledgeBase where it's optional)
}

// Main Channel template (based on ChannelSetupTabProps structure)
export interface ChannelTemplate {
    name: string;
    description?: string; // Description of what this template does
    prompt: ChannelPromptTemplate;
    inputs: ChannelInputTemplate[]; // At least one required
    output: ChannelOutputTemplate;
    knowledgeBases?: ChannelKnowledgeBaseTemplate[];
    requireApproval?: boolean; // Defaults to false
    isActive?: boolean; // Defaults to true
    notificationSettings?: ChannelNotificationSettingsTemplate;
}

// Array of channel templates
export type ChannelTemplates = ChannelTemplate[];
