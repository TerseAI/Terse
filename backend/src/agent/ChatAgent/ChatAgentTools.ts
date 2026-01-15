import { Tool } from "@openai/agents-core";
import { RunContext, tool } from "@openai/agents";
import ChatInterface from "./ChatInterface";
import { z } from "zod";
import { Channel } from "../../shared/types";
import { IntegrationType } from "../../shared/Integrations";
import { ConfigType } from "../../shared/Configs";
import logger from "../../logger";
import { applyChannelForUser } from "../../routes/channels";
import type { ChannelDraft } from "../../routes/channels";
import type { ConfigInstance } from "../../shared/Configs";
import { GithubIntegrationManager } from "../../integrations/GithubIntegration";
import { SlackIntegrationManager } from "../../integrations/SlackIntegration";
import { NotionIntegrationManager } from "../../integrations/NotionIntegration";
import { AtlassianIntegrationManager } from "../../integrations/AtlassianIntegration";
import { LinearIntegrationManager } from "../../integrations/LinearIntegration";
import { PosthogIntegrationManager } from "../../integrations/PosthogIntegration";
import { fetchGithubRepositoriesForIntegration } from "../../routes/github";
import { fetchSlackChannelsForIntegration } from "../../routes/slack";
import { fetchNotionResources } from "../../routes/notion";
import { fetchConfluenceResources } from "../../routes/confluence";
import { fetchJiraResources } from "../../routes/jira";
import { fetchLinearTeams } from "../../routes/linear";
import { fetchPosthogProjects } from "../../routes/posthog";
import { uuidv4 } from "zod/v4";

export type ChatAgentContext = {
    chatInterface: ChatInterface;
    userId: string;
};

export function buildChatAgentTools(chatInterface: ChatInterface): Tool<ChatAgentContext>[] {
    return [
        tool({
            name: 'buildPreview',
            description: 'Build a preview of the draft. Call this before calling applyChannel.',
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

                const draft = toChannelDraft(channel);
                const { id } = await applyChannelForUser(userId, draft);
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
        tool({
            name: 'fetchResourcesForIntegration',
            description: 'Call this when you need to see what configs you have access to. It returns display names and canonical IDs you can use for the Channel object in applyChannel. IMPORTANT: Do not add integrations unless the user explicitly asked for them.',
            parameters: z.object({
                integrationType: z.nativeEnum(IntegrationType).describe('The integration type to fetch resources for'),
                query: z.string().nullable().describe('Optional query to filter resources by name/title'),
            }),
            execute: async ({ integrationType, query }: { integrationType: IntegrationType; query: string | null }, runContext?: RunContext<ChatAgentContext>): Promise<string> => {
                logger.info('Fetching resources for integration type', { integrationType, query });
                const userId = runContext?.context?.userId;
                if (!userId) {
                    throw new Error("User ID is required to fetch resources");
                }
                return await fetchResourcesForIntegrationType(integrationType, userId, query ?? undefined);
            },
        }),
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
    cronExpression: z.string().describe('ALL TIMES ARE IN UTC. The cron expression to schedule the automation. Must be a valid cron expression. Use this format: "minute hour day-of-month month day-of-week"'),
});

const InputConfigSchema = z.discriminatedUnion("configType", [
    GmailConfigSchema,
    FigmaConfigSchema,
    SlackConfigSchema,
    LinearInputConfigSchema,
    GitHubConfigSchema,
    JiraConfigSchema,
    TimeTriggerConfigSchema,
]);

const OutputConfigSchema = z.discriminatedUnion("configType", [
    SlackOutputConfigSchema,
    NotionDatabaseConfigSchema,
    NotionPageConfigSchema,
    LinearOutputConfigSchema,
    JiraConfigSchema,
    ConfluenceConfigSchema,
]);

const KnowledgeBaseConfigSchema = z.discriminatedUnion("configType", [
    GitHubKnowledgeBaseConfigSchema,
    PosthogConfigSchema,
]);

const ChannelInputSchema = z.object({
    config: InputConfigSchema,
});

const ChannelOutputSchema = z.object({
    config: OutputConfigSchema,
});

const ChannelPromptSchema = z.object({
    text: z.string(),
});

const ChannelKnowledgeBaseSchema = z.object({
    config: KnowledgeBaseConfigSchema,
});

const RunHistoryActionTypeSchema = z.enum(["create", "update", "delete", "read"]);

const ChannelNotificationSettingsSchema = z.object({
    enabled: z.boolean(),
    actionTypes: z.array(RunHistoryActionTypeSchema),
});

export const ChannelSchema = z.object({
    name: z.string(),
    isActive: z.boolean(),
    requireApproval: z.boolean(),
    prompt: ChannelPromptSchema,
    inputs: z.array(ChannelInputSchema),
    output: ChannelOutputSchema,
    knowledgeBases: z.array(ChannelKnowledgeBaseSchema).nullable(),
    notificationSettings: ChannelNotificationSettingsSchema.nullable(),
    updatedAt: z.string().nullable(),
});

type ChannelSchemaInput = z.infer<typeof ChannelSchema>;

function toConfigInstance<T extends Record<string, any>>(config: T): T & ConfigInstance {
    return {
        ...config,
        isComplete: () => true,
        formatForAgent: () => '',
    } as T & ConfigInstance;
}

function toChannelDraft(channel: ChannelSchemaInput): ChannelDraft {
    return {
        ...channel,
        inputs: channel.inputs.map((input) => ({
            id: uuidv4().toString(),
            ...input,
            config: toConfigInstance(input.config),
        })),
        output: {
            id: uuidv4().toString(),
            ...channel.output,
            config: toConfigInstance(channel.output.config),
        },
        knowledgeBases: channel.knowledgeBases?.map((kb) => ({
            id: uuidv4().toString(),
            ...kb,
            config: toConfigInstance(kb.config),
        })) ?? undefined,
        notificationSettings: channel.notificationSettings ?? undefined,
        updatedAt: channel.updatedAt ?? undefined,
    };
}

async function fetchResourcesForIntegrationType(
    integrationType: IntegrationType,
    userId: string,
    query?: string
): Promise<string> {
    const normalizedQuery = query?.trim().toLowerCase();
    const matchesQuery = (value: string | undefined | null): boolean => {
        if (!normalizedQuery) {
            return true;
        }
        if (!value) {
            return false;
        }
        return value.toLowerCase().includes(normalizedQuery);
    };
    switch (integrationType) {
        case IntegrationType.GITHUB: {
            const manager = new GithubIntegrationManager();
            const integrations = await manager.getInstancesForUser(userId);
            const resources = await Promise.all(integrations.map(async (integration) => {
                const installationId = integration.installation_id ?? Number(integration.id);
                if (!installationId) {
                    return { integration, repositories: [] };
                }
                const response = await fetchGithubRepositoriesForIntegration(
                    userId,
                    String(installationId)
                );
                const repositories = normalizedQuery
                    ? response.repositories.filter(repo => matchesQuery(`${repo.owner}/${repo.name}`) || matchesQuery(repo.name))
                    : response.repositories;
                return { integration, repositories };
            }));
            return JSON.stringify({ integrations, resources });
        }
        case IntegrationType.SLACK: {
            const manager = new SlackIntegrationManager();
            const integrations = await manager.getInstancesForUser(userId);
            const resources = await Promise.all(integrations.map(async (integration) => {
                const response = await fetchSlackChannelsForIntegration(userId, integration.id);
                const channels = normalizedQuery
                    ? response.channels.filter(channel => matchesQuery(channel.name))
                    : response.channels;
                return { integration, channels };
            }));
            return JSON.stringify({ integrations, resources });
        }
        case IntegrationType.NOTION: {
            const manager = new NotionIntegrationManager();
            const integrations = await manager.getInstancesForUser(userId);
            const resources = await Promise.all(integrations.map(async (integration) => {
                const response = await fetchNotionResources(userId, integration.id, query ?? "");
                return { integration, resources: response.resources };
            }));
            return JSON.stringify({ integrations, resources });
        }
        case IntegrationType.ATLASSIAN: {
            const manager = new AtlassianIntegrationManager();
            const integrations = await manager.getInstancesForUser(userId);
            const jira = await Promise.all(integrations.map(async (integration) => {
                const response = await fetchJiraResources(userId, integration.id);
                const projects = response.resources?.projects ?? [];
                const filteredProjects = normalizedQuery
                    ? projects.filter((project: { name?: string; key?: string }) =>
                        matchesQuery(project.name) || matchesQuery(project.key))
                    : projects;
                return { integration, resources: { ...response.resources, projects: filteredProjects } };
            }));
            const confluence = await Promise.all(integrations.map(async (integration) => {
                const response = await fetchConfluenceResources(userId, integration.id, query ?? "");
                return { integration, resources: response };
            }));
            return JSON.stringify({ integrations, jira, confluence });
        }
        case IntegrationType.LINEAR: {
            const manager = new LinearIntegrationManager();
            const integrations = await manager.getInstancesForUser(userId);
            const resources = await Promise.all(integrations.map(async (integration) => {
                const response = await fetchLinearTeams(userId, integration.id);
                const teams = normalizedQuery
                    ? response.filter(team => matchesQuery(team.name) || matchesQuery(team.key))
                    : response;
                return { integration, teams };
            }));
            return JSON.stringify({ integrations, resources });
        }
        case IntegrationType.POSTHOG: {
            const manager = new PosthogIntegrationManager();
            const integrations = await manager.getInstancesForUser(userId);
            const resources = await Promise.all(integrations.map(async (integration) => {
                const response = await fetchPosthogProjects(userId, integration.id, query ?? "");
                return { integration, projects: response.projects ?? response };
            }));
            return JSON.stringify({ integrations, resources });
        }
        case IntegrationType.GMAIL:
        case IntegrationType.FIGMA:
        case IntegrationType.CRON_JOB:
        case IntegrationType.TERSE:
        default:
            return JSON.stringify("This is a system integration. No config is needed.");
    }
}