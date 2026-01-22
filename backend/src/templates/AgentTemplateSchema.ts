import { z } from 'zod';
import { ConfigType } from '../shared/Configs';
import { IntegrationType } from '../shared/Integrations';

// Base config schema - all configs have integrationId and configType
const BaseConfigSchema = z.object({
    integrationId: z.string().optional(), // Optional in templates, will be filled when creating agent
    configType: z.nativeEnum(ConfigType),
    integrationType: z.nativeEnum(IntegrationType),
});

// Gmail config schema
const GmailConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GMAIL),
    integrationType: z.literal(IntegrationType.GMAIL),
});

// Figma config schema
const FigmaConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.FIGMA),
    integrationType: z.literal(IntegrationType.FIGMA),
    fileKey: z.string().optional(),
    fileName: z.string().optional(),
    teamId: z.string().optional(),
});

// Slack config schema
const SlackConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK),
    integrationType: z.literal(IntegrationType.SLACK),
    channelId: z.string().optional(),
    channelName: z.string().optional(),
    listenToUserDms: z.boolean().optional(),
    userIds: z.array(z.string()).optional(),
});

// Notion Database config schema
const NotionDatabaseConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.NOTION_DATABASE),
    integrationType: z.literal(IntegrationType.NOTION),
    databaseId: z.string().optional(),
    databaseName: z.string().optional(),
});

// Notion Page config schema
const NotionPageConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.NOTION_PAGE),
    integrationType: z.literal(IntegrationType.NOTION),
    pageId: z.string().optional(),
    pageName: z.string().optional(),
});

// Linear Trigger config schema
const LinearTriggerConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_INPUT),
    integrationType: z.literal(IntegrationType.LINEAR),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
});

// Linear Output config schema
const LinearOutputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_OUTPUT),
    integrationType: z.literal(IntegrationType.LINEAR),
    teamId: z.string().optional(),
    teamName: z.string().optional(),
});

// GitHub config schema
const GitHubConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GITHUB),
    integrationType: z.literal(IntegrationType.GITHUB),
    repositoryIds: z.array(z.number()).optional(),
});

// Jira config schema
const JiraConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.JIRA),
    integrationType: z.literal(IntegrationType.ATLASSIAN),
    projectKey: z.string().optional(),
    projectId: z.string().optional(),
});

// Confluence config schema
const ConfluenceConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.CONFLUENCE),
    integrationType: z.literal(IntegrationType.ATLASSIAN),
    spaceName: z.string().optional(),
    spaceId: z.string().optional(),
    pageId: z.string().optional(),
    pageName: z.string().optional(),
});

// Posthog config schema
const PosthogConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.POSTHOG),
    integrationType: z.literal(IntegrationType.POSTHOG),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
    canReadLogs: z.boolean().optional(),
    canReadSessionRecordings: z.boolean().optional(),
});

// Union of all config schemas
export const ConfigTemplateSchema = z.discriminatedUnion('configType', [
    GmailConfigSchema,
    FigmaConfigSchema,
    SlackConfigSchema,
    NotionDatabaseConfigSchema,
    NotionPageConfigSchema,
    LinearTriggerConfigSchema,
    LinearOutputConfigSchema,
    GitHubConfigSchema,
    JiraConfigSchema,
    ConfluenceConfigSchema,
    PosthogConfigSchema,
]);

// Agent prompt schema
const AgentPromptSchema = z.object({
    text: z.string(),
});

// Agent notification settings schema
const AgentNotificationSettingsSchema = z.object({
    enabled: z.boolean(),
    actionTypes: z.array(z.enum(['create', 'update', 'delete', 'read'] as const)),
}).optional();

// Agent trigger template schema
const AgentTriggerTemplateSchema = z.object({
    id: z.string().optional(), // Optional in templates
    config: ConfigTemplateSchema,
});

// Agent output template schema
const AgentOutputTemplateSchema = z.object({
    id: z.string().optional(), // Optional in templates
    config: ConfigTemplateSchema,
});

// Agent knowledge base template schema
const AgentKnowledgeBaseTemplateSchema = z.object({
    id: z.string().optional(), // Optional in templates
    config: ConfigTemplateSchema,
});

// Main Agent template schema
export const AgentTemplateSchema = z.object({
    name: z.string(),
    description: z.string().optional(), // Description of what this template does
    prompt: AgentPromptSchema,
    triggers: z.array(AgentTriggerTemplateSchema).min(1),
    output: AgentOutputTemplateSchema,
    knowledgeBases: z.array(AgentKnowledgeBaseTemplateSchema).optional(),
    requireApproval: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    notificationSettings: AgentNotificationSettingsSchema,
});

// Schema for the templates.json file (array of templates)
export const AgentTemplatesSchema = z.array(AgentTemplateSchema);

// Type exports
export type AgentTemplate = z.infer<typeof AgentTemplateSchema>;
export type ConfigTemplate = z.infer<typeof ConfigTemplateSchema>;
export type AgentTemplates = z.infer<typeof AgentTemplatesSchema>;
