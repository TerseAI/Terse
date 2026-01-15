import { Tool } from "@openai/agents-core";
import { RunContext, tool } from "@openai/agents";
import ChatInterface from "./ChatInterface";
import { z } from "zod";
import { Channel } from "../../shared/types";
import { IntegrationType } from "../../shared/Integrations";
import { ConfigType } from "../../shared/Configs";
import logger from "../../logger";
import { applyChannelForUser } from "../../routes/channels";

export type ChatAgentContext = {
    chatInterface: ChatInterface;
    userId: string;
};

export function buildChatAgentTools(chatInterface: ChatInterface): Tool<ChatAgentContext>[] {
    return [
        tool({
            name: 'buildPreview',
            description: 'Build a preview of the draft',
            parameters: z.object({
                draft: z.string().describe('The draft to build a preview of'),
            }),
            execute: async ({ draft }: { draft: string }, runContext?: RunContext<ChatAgentContext>): Promise<string> => {
                return await chatInterface.buildPreview(parseChannel(draft));
            },
        }),
        tool({
            name: 'applyChannel',
            description: 'Once you have all the information you need, you can use this tool to persist and apply the automation.',
            parameters: z.object({
                channel: ChannelSchema,
            }),
            execute: async ({ channel }, runContext?: RunContext<ChatAgentContext>): Promise<string> => {
                logger.info('Slack chat interface applyChannel', { channel });
                const userId = runContext?.context?.userId;
                if (!userId) {
                    throw new Error("User ID is required to apply channel");
                }

                const { id: _id, ...draft } = channel;
                const { id } = await applyChannelForUser(userId, draft as unknown as Omit<Channel, "id">);
                return `Channel applied successfully (${id})`;
            },
        }),
        tool({
            name: 'promptForIntegration',
            description: 'Prompt for an integration',
            parameters: z.object({
                integration: z.nativeEnum(IntegrationType).describe('The integration to prompt for'),
            }),
            execute: async ({ integration }: { integration: IntegrationType }, runContext?: RunContext<ChatAgentContext>): Promise<string> => {
                return await chatInterface.promptForIntegration(integration);
            },
        }),
        // tool({
        //     name: 'promptForConfig',
        //     description: 'Prompt for a config',
        //     parameters: z.object({
        //         config: z.string().describe('The config to prompt for'),
        //     }),
        //     execute: async ({ config }: { config: string }, runContext?: RunContext<void>): Promise<string> => {
        //         return await chatInterface.promptForConfig(parseConfig(config));
        //     },
        // }),
    ];
}

function parseChannel(draft: string): Channel {
    return JSON.parse(draft) as Channel;
}

function parseConfig(config: string): ConfigType {
    return config as ConfigType;
}

const BaseConfigSchema = z.object({
    integrationId: z.string(),
    configType: z.nativeEnum(ConfigType),
    integrationType: z.nativeEnum(IntegrationType),
});

const GmailConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GMAIL),
    integrationType: z.literal(IntegrationType.GMAIL),
});

const FigmaConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.FIGMA),
    integrationType: z.literal(IntegrationType.FIGMA),
    fileKey: z.string(),
    fileName: z.string().nullable(),
    teamId: z.string(),
});

const SlackConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK),
    integrationType: z.literal(IntegrationType.SLACK),
    channelId: z.string().nullable(),
    channelName: z.string().nullable(),
    listenToUserDms: z.boolean().nullable(),
    userIds: z.array(z.string()).nullable(),
});

const SlackOutputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.SLACK_OUTPUT),
    integrationType: z.literal(IntegrationType.SLACK),
    channelId: z.string().nullable(),
    channelName: z.string().nullable(),
});

const NotionDatabaseConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.NOTION_DATABASE),
    integrationType: z.literal(IntegrationType.NOTION),
    databaseId: z.string().nullable(),
    databaseName: z.string().nullable(),
});

const NotionPageConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.NOTION_PAGE),
    integrationType: z.literal(IntegrationType.NOTION),
    pageId: z.string().nullable(),
    pageName: z.string().nullable(),
});

const LinearInputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_INPUT),
    integrationType: z.literal(IntegrationType.LINEAR),
    projectId: z.string().nullable(),
    projectName: z.string().nullable(),
});

const LinearOutputConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.LINEAR_OUTPUT),
    integrationType: z.literal(IntegrationType.LINEAR),
    teamId: z.string().nullable(),
    teamName: z.string().nullable(),
});

const GitHubConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GITHUB),
    integrationType: z.literal(IntegrationType.GITHUB),
    repositoryIds: z.array(z.number()),
});

const GitHubKnowledgeBaseConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.GITHUB_KB),
    integrationType: z.literal(IntegrationType.GITHUB),
    repositoryIds: z.array(z.number()),
    repositoryNames: z.array(z.string()),
});

const JiraConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.JIRA),
    integrationType: z.literal(IntegrationType.ATLASSIAN),
    projectKey: z.string().nullable(),
    projectId: z.string().nullable(),
});

const ConfluenceConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.CONFLUENCE),
    integrationType: z.literal(IntegrationType.ATLASSIAN),
    spaceName: z.string(),
    spaceId: z.string(),
    pageId: z.string(),
    pageName: z.string(),
});

const PosthogConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.POSTHOG),
    integrationType: z.literal(IntegrationType.POSTHOG),
    projectId: z.string(),
    projectName: z.string().nullable(),
    canReadLogs: z.boolean().nullable(),
    canReadSessionRecordings: z.boolean().nullable(),
});

const TimeTriggerConfigSchema = BaseConfigSchema.extend({
    configType: z.literal(ConfigType.TIME_TRIGGER),
    integrationType: z.literal(IntegrationType.CRON_JOB),
    integrationId: z.literal("system"),
    cronExpression: z.string(),
});

const ConfigInstanceSchema = z.discriminatedUnion("configType", [
    GmailConfigSchema,
    FigmaConfigSchema,
    SlackConfigSchema,
    SlackOutputConfigSchema,
    NotionDatabaseConfigSchema,
    NotionPageConfigSchema,
    LinearInputConfigSchema,
    LinearOutputConfigSchema,
    GitHubConfigSchema,
    GitHubKnowledgeBaseConfigSchema,
    JiraConfigSchema,
    ConfluenceConfigSchema,
    PosthogConfigSchema,
    TimeTriggerConfigSchema,
]);

const ChannelInputSchema = z.object({
    id: z.string(),
    config: ConfigInstanceSchema,
});

const ChannelOutputSchema = z.object({
    id: z.string(),
    config: ConfigInstanceSchema,
});

const ChannelPromptSchema = z.object({
    text: z.string(),
});

const ChannelKnowledgeBaseSchema = z.object({
    id: z.string(),
    config: ConfigInstanceSchema,
});

const RunHistoryActionTypeSchema = z.enum(["create", "update", "delete", "read"]);

const ChannelNotificationSettingsSchema = z.object({
    enabled: z.boolean(),
    actionTypes: z.array(RunHistoryActionTypeSchema),
});

export const ChannelSchema = z.object({
    id: z.string(),
    name: z.string(),
    isActive: z.boolean(),
    requireApproval: z.boolean(),
    prompt: ChannelPromptSchema,
    inputs: z.array(ChannelInputSchema),
    output: ChannelOutputSchema,
    knowledgeBases: z.array(ChannelKnowledgeBaseSchema).optional(),
    notificationSettings: ChannelNotificationSettingsSchema.optional(),
    updatedAt: z.string().optional(),
});