import { RunContext, tool } from "@openai/agents";
import { Tool } from "@openai/agents-core";
import { z } from "zod";
import { uuidv4 } from "zod/v4";
import { AtlassianIntegrationManager } from "../../integrations/AtlassianIntegration";
import { GithubIntegrationManager } from "../../integrations/GithubIntegration";
import { LaunchDarklyIntegrationManager } from "../../integrations/LaunchDarklyIntegration";
import { LinearIntegrationManager } from "../../integrations/LinearIntegration";
import { NotionIntegrationManager } from "../../integrations/NotionIntegration";
import { PosthogIntegrationManager } from "../../integrations/PosthogIntegration";
import { SlackIntegrationManager } from "../../integrations/SlackIntegration";
import logger from "../../logger";
import type { AgentDraft } from "../../routes/agents";
import { applyAgentForUser, updateAgentForUser } from "../../routes/agents";
import { fetchConfluenceResources } from "../../routes/confluence";
import { fetchGithubRepositoriesForIntegration } from "../../routes/github";
import { fetchJiraResources } from "../../routes/jira";
import {
  fetchLaunchDarklyEnvironments,
  fetchLaunchDarklyProjects,
} from "../../routes/launchdarkly";
import { fetchLinearTeams } from "../../routes/linear";
import { fetchNotionResources } from "../../routes/notion";
import { fetchPosthogProjects } from "../../routes/posthog";
import { fetchSlackChannelsForIntegration } from "../../routes/slack";
import type { ConfigInstance } from "../../shared/Configs";
import { ConfigType } from "../../shared/Configs";
import { FrontendRoutes } from "../../shared/FrontendRoutes";
import { IntegrationType } from "../../shared/Integrations";
import ChatInterface from "./ChatInterface";

export type ChatAgentContext = {
  chatInterface: ChatInterface;
  userId: string;
  organizationId: string;
};

const frontendUrl = process.env.FRONTEND_URL;

export function buildChatAgentTools(
  chatInterface: ChatInterface,
): Tool<ChatAgentContext>[] {
  return [
    tool({
      name: "applyAgent",
      description:
        "Once you have all the information you need, you can use this tool to persist and apply the automation. You can use this to create and update agents. If you are creating, just leave the id empty.",
      parameters: z.object({
        agent: AgentSchema,
        id: z
          .string()
          .nullable()
          .describe(
            "The ID of the agent to update. If not provided, a new agent will be created.",
          ),
      }),
      execute: async (
        { agent, id },
        runContext?: RunContext<ChatAgentContext>,
      ): Promise<string> => {
        logger.info("Slack chat interface applyAgent", { agent, id });
        const userId = runContext?.context?.userId;
        const organizationId = runContext?.context?.organizationId;
        if (!userId || !organizationId) {
          throw new Error("User ID and organization ID are required to apply agent");
        }

        try {
          const draft = toAgentDraft(agent);
          const result = id
            ? await updateAgentForUser(userId, organizationId, id, draft)
            : await applyAgentForUser(userId, organizationId, draft);
          await chatInterface.buildButton(
            "View Automation",
            `${frontendUrl}${FrontendRoutes.AGENTS.DETAIL(result.id)}`,
          );
          return `Agent applied successfully (${result.id})`;
        } catch (error) {
          logger.error("applyAgent failed", { error, userId, agent });
          throw error;
        }
      },
    }),
    tool({
      name: "promptForIntegration",
      description:
        "Prompt for an integration. You can also call this if the user needs to re-configure an integration. Ex: Add repos to github or more pages to Notion.",
      parameters: z.object({
        integration: z
          .nativeEnum(IntegrationType)
          .describe("The integration to prompt for"),
      }),
      execute: async (
        { integration }: { integration: IntegrationType },
        runContext?: RunContext<ChatAgentContext>,
      ): Promise<string> => {
        return await chatInterface.promptForIntegration(integration);
      },
    }),
    tool({
      name: "fetchResourcesForIntegration",
      description:
        "Call this when you need to see what configs you have access to. It returns display names and canonical IDs you can use for the Agent object in applyAgent. IMPORTANT: Do not add integrations unless the user explicitly asked for them.",
      parameters: z.object({
        integrationType: z
          .nativeEnum(IntegrationType)
          .describe("The integration type to fetch resources for"),
        query: z
          .string()
          .nullable()
          .describe("Optional query to filter resources by name/title"),
      }),
      execute: async (
        {
          integrationType,
          query,
        }: { integrationType: IntegrationType; query: string | null },
        runContext?: RunContext<ChatAgentContext>,
      ): Promise<string> => {
        logger.info("Fetching resources for integration type", {
          integrationType,
          query,
        });
        const userId = runContext?.context?.userId;
        const organizationId = runContext?.context?.organizationId;
        if (!userId || !organizationId) {
          throw new Error(
            "User ID and organization ID are required to fetch resources",
          );
        }
        return await fetchResourcesForIntegrationType(
          integrationType,
          userId,
          organizationId,
          query ?? undefined,
        );
      },
    }),
  ];
}

const NonEmptyString = z.string().min(1);

const BaseConfigSchema = z
  .object({
    integrationId: NonEmptyString.describe(
      'Integration instance ID. Use the ID from the user’s connected integrations. Use "system" only for TIME_TRIGGER configs.',
    ),
    configType: z
      .nativeEnum(ConfigType)
      .describe("The config type for this input/output/knowledge base."),
    integrationType: z
      .nativeEnum(IntegrationType)
      .describe("The integration provider type (must match configType)."),
  })
  .strict();

const GmailConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.GMAIL),
  integrationType: z.literal(IntegrationType.GMAIL),
});

const FigmaConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.FIGMA),
  integrationType: z.literal(IntegrationType.FIGMA),
  fileKey: NonEmptyString,
  fileName: z.string().nullable(),
  teamId: NonEmptyString,
});

const SlackConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.SLACK),
  integrationType: z.literal(IntegrationType.SLACK),
  channelId: NonEmptyString.nullable(),
  channelName: NonEmptyString.nullable(),
  listenToUserDms: z.boolean().nullable(),
  userIds: z.array(NonEmptyString).nullable(),
});

const SlackOutputConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.SLACK_OUTPUT),
  integrationType: z.literal(IntegrationType.SLACK),
  channelId: NonEmptyString.nullable(),
  channelName: NonEmptyString.nullable(),
});

const NotionDatabaseConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.NOTION_DATABASE),
  integrationType: z.literal(IntegrationType.NOTION),
  databaseId: NonEmptyString.nullable(),
  databaseName: z.string().nullable(),
});

const NotionPageConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.NOTION_PAGE),
  integrationType: z.literal(IntegrationType.NOTION),
  pageId: NonEmptyString.nullable(),
  pageName: z.string().nullable(),
});

const LinearInputConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.LINEAR_INPUT),
  integrationType: z.literal(IntegrationType.LINEAR),
  projectId: NonEmptyString.nullable(),
  projectName: z.string().nullable(),
});

const LinearOutputConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.LINEAR_OUTPUT),
  integrationType: z.literal(IntegrationType.LINEAR),
  teamId: NonEmptyString.nullable(),
  teamName: z.string().nullable(),
});

const GitHubConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.GITHUB),
  integrationType: z.literal(IntegrationType.GITHUB),
  repositoryIds: z.array(z.number()).min(1),
});

const GitHubKnowledgeBaseConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.GITHUB_KB),
  integrationType: z.literal(IntegrationType.GITHUB),
  repositoryIds: z.array(z.number()).min(1),
  repositoryNames: z.array(NonEmptyString).min(1),
});

const JiraConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.JIRA),
  integrationType: z.literal(IntegrationType.ATLASSIAN),
  projectKey: NonEmptyString.nullable(),
  projectId: NonEmptyString.nullable(),
});

const ConfluenceConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.CONFLUENCE),
  integrationType: z.literal(IntegrationType.ATLASSIAN),
  spaceName: NonEmptyString,
  spaceId: NonEmptyString,
  pageId: NonEmptyString,
  pageName: NonEmptyString,
});

const PosthogConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.POSTHOG),
  integrationType: z.literal(IntegrationType.POSTHOG),
  projectId: NonEmptyString,
  projectName: z.string().nullable(),
  canReadLogs: z.boolean().nullable(),
  canReadSessionRecordings: z.boolean().nullable(),
});

const LaunchDarklyConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.LAUNCHDARKLY),
  integrationType: z.literal(IntegrationType.LAUNCHDARKLY),
  projectKey: NonEmptyString,
  environmentKeys: z.array(NonEmptyString).min(1),
});

const TimeTriggerConfigSchema = BaseConfigSchema.extend({
  configType: z.literal(ConfigType.TIME_TRIGGER),
  integrationType: z.literal(IntegrationType.CRON_JOB),
  integrationId: z.literal("system"),
  cronExpression: z
    .string()
    .describe(
      'ALL TIMES ARE IN UTC. The cron expression to schedule the automation. Must be a valid cron expression. Use this format: "minute hour day-of-month month day-of-week"',
    ),
});

function enforceNonSystemIntegrationId(
  config: { configType: ConfigType; integrationId?: string },
  ctx: z.RefinementCtx,
): void {
  if (
    config.configType !== ConfigType.TIME_TRIGGER &&
    config.integrationId === "system"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'integrationId must not be "system" unless configType is TIME_TRIGGER.',
    });
  }
}

const InputConfigSchema = z
  .discriminatedUnion("configType", [
    GmailConfigSchema,
    FigmaConfigSchema,
    SlackConfigSchema,
    LinearInputConfigSchema,
    GitHubConfigSchema,
    JiraConfigSchema,
    TimeTriggerConfigSchema,
  ])
  .superRefine((value, ctx) => {
    enforceNonSystemIntegrationId(value, ctx);
    if (value.configType === ConfigType.SLACK) {
      const hasChannel =
        typeof value.channelId === "string" &&
        value.channelId.trim().length > 0;
      const listensToDms = value.listenToUserDms === true;
      if (!hasChannel && !listensToDms) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Slack input requires a channelId or listenToUserDms=true.",
        });
      }
    }
  });

const OutputConfigSchema = z
  .discriminatedUnion("configType", [
    SlackOutputConfigSchema,
    NotionDatabaseConfigSchema,
    NotionPageConfigSchema,
    LinearOutputConfigSchema,
    JiraConfigSchema,
    ConfluenceConfigSchema,
  ])
  .superRefine((value, ctx) => {
    enforceNonSystemIntegrationId(value, ctx);
  });

const KnowledgeBaseConfigSchema = z
  .discriminatedUnion("configType", [
    GitHubKnowledgeBaseConfigSchema,
    PosthogConfigSchema,
    LaunchDarklyConfigSchema,
  ])
  .superRefine((value, ctx) => {
    enforceNonSystemIntegrationId(value, ctx);
  });

const AgentTriggerSchema = z
  .object({
    config: InputConfigSchema,
  })
  .strict();

const AgentOutputSchema = z
  .object({
    config: OutputConfigSchema,
  })
  .strict();

const AgentPromptSchema = z
  .object({
    text: NonEmptyString,
  })
  .strict();

const AgentKnowledgeBaseSchema = z
  .object({
    config: KnowledgeBaseConfigSchema,
  })
  .strict();

const RunHistoryActionTypeSchema = z.enum([
  "create",
  "update",
  "delete",
  "read",
]);

const AgentNotificationSettingsSchema = z
  .object({
    enabled: z.boolean(),
    actionTypes: z.array(RunHistoryActionTypeSchema),
  })
  .strict();

export const AgentSchema = z
  .object({
    name: NonEmptyString,
    isActive: z.boolean(),
    requireApproval: z.boolean(),
    prompt: AgentPromptSchema,
    triggers: z.array(AgentTriggerSchema).min(1),
    outputs: z.array(AgentOutputSchema).min(1),
    knowledgeBases: z.array(AgentKnowledgeBaseSchema).nullable(),
    notificationSettings: AgentNotificationSettingsSchema.nullable(),
    toolApprovals: z.array(z.string()).nullable(),
    updatedAt: z.string().nullable(),
  })
  .strict();

type AgentSchemaInput = z.infer<typeof AgentSchema>;

function toConfigInstance<T extends Record<string, any>>(
  config: T,
): T & ConfigInstance {
  return {
    ...config,
    isComplete: () => true,
    formatForAgent: () => "",
  } as T & ConfigInstance;
}

function normalizeConfig<T extends Record<string, any>>(config: T): T {
  if (config.configType === ConfigType.TIME_TRIGGER) {
    return {
      ...config,
      integrationId: "system",
      integrationType: IntegrationType.CRON_JOB,
      configType: ConfigType.TIME_TRIGGER,
    } as T;
  }
  return config;
}

function toAgentDraft(agent: AgentSchemaInput): AgentDraft {
  return {
    ...agent,
    triggers: agent.triggers.map((trigger) => ({
      id: uuidv4().toString(),
      ...trigger,
      config: toConfigInstance(normalizeConfig(trigger.config)),
    })),
    outputs: agent.outputs.map((output) => ({
      id: uuidv4().toString(),
      ...output,
      config: toConfigInstance(normalizeConfig(output.config)),
    })),
    knowledgeBases:
      agent.knowledgeBases?.map((kb) => ({
        id: uuidv4().toString(),
        ...kb,
        config: toConfigInstance(normalizeConfig(kb.config)),
      })) ?? undefined,
    notificationSettings: agent.notificationSettings ?? undefined,
    toolApprovals: agent.toolApprovals ?? undefined,
    updatedAt: agent.updatedAt ?? undefined,
  };
}

async function fetchResourcesForIntegrationType(
  integrationType: IntegrationType,
  userId: string,
  organizationId: string,
  query?: string,
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
      const integrations = await manager.getInstancesForOrganization(
        organizationId,
      );
      const resources = await Promise.all(
        integrations.map(async (integration) => {
          const installationId =
            integration.installation_id ?? Number(integration.id);
          if (!installationId) {
            return { integration, repositories: [] };
          }
          const response = await fetchGithubRepositoriesForIntegration(
            organizationId,
            String(installationId),
          );
          const repositories = normalizedQuery
            ? response.repositories.filter(
                (repo) =>
                  matchesQuery(`${repo.owner}/${repo.name}`) ||
                  matchesQuery(repo.name),
              )
            : response.repositories;
          return { integration, repositories };
        }),
      );
      return JSON.stringify({ integrations, resources });
    }
    case IntegrationType.SLACK: {
      const manager = new SlackIntegrationManager();
      const integrations = await manager.getInstancesForOrganization(
        organizationId,
      );
      const resources = await Promise.all(
        integrations.map(async (integration) => {
          const response = await fetchSlackChannelsForIntegration(
            userId,
            organizationId,
            integration.id,
          );
          const channels = normalizedQuery
            ? response.channels.filter((channel) => matchesQuery(channel.name))
            : response.channels;
          return { integration, channels };
        }),
      );
      return JSON.stringify({ integrations, resources });
    }
    case IntegrationType.NOTION: {
      const manager = new NotionIntegrationManager();
      const integrations = await manager.getInstancesForOrganization(
        organizationId,
      );
      const resources = await Promise.all(
        integrations.map(async (integration) => {
          const response = await fetchNotionResources(
            organizationId,
            integration.id,
            query ?? "",
          );
          return { integration, resources: response.resources };
        }),
      );
      return JSON.stringify({ integrations, resources });
    }
    case IntegrationType.ATLASSIAN: {
      const manager = new AtlassianIntegrationManager();
      const integrations = await manager.getInstancesForOrganization(
        organizationId,
      );
      const jira = await Promise.all(
        integrations.map(async (integration) => {
          const response = await fetchJiraResources(organizationId, integration.id);
          const projects = response.resources?.projects ?? [];
          const filteredProjects = normalizedQuery
            ? projects.filter(
                (project: { name?: string; key?: string }) =>
                  matchesQuery(project.name) || matchesQuery(project.key),
              )
            : projects;
          return {
            integration,
            resources: { ...response.resources, projects: filteredProjects },
          };
        }),
      );
      const confluence = await Promise.all(
        integrations.map(async (integration) => {
          const response = await fetchConfluenceResources(
            organizationId,
            integration.id,
            query ?? "",
          );
          return { integration, resources: response };
        }),
      );
      return JSON.stringify({ integrations, jira, confluence });
    }
    case IntegrationType.LINEAR: {
      const manager = new LinearIntegrationManager();
      const integrations = await manager.getInstancesForOrganization(
        organizationId,
      );
      const resources = await Promise.all(
        integrations.map(async (integration) => {
          const response = await fetchLinearTeams(organizationId, integration.id);
          const teams = normalizedQuery
            ? response.filter(
                (team) => matchesQuery(team.name) || matchesQuery(team.key),
              )
            : response;
          return { integration, teams };
        }),
      );
      return JSON.stringify({ integrations, resources });
    }
    case IntegrationType.POSTHOG: {
      const manager = new PosthogIntegrationManager();
      const integrations = await manager.getInstancesForOrganization(
        organizationId,
      );
      const resources = await Promise.all(
        integrations.map(async (integration) => {
          const response = await fetchPosthogProjects(
            organizationId,
            integration.id,
            query ?? "",
          );
          return { integration, projects: response.projects ?? response };
        }),
      );
      return JSON.stringify({ integrations, resources });
    }
    case IntegrationType.LAUNCHDARKLY: {
      const manager = new LaunchDarklyIntegrationManager();
      const integrations = await manager.getInstancesForOrganization(
        organizationId,
      );
      const resources = await Promise.all(
        integrations.map(async (integration) => {
          const projectsResponse = await fetchLaunchDarklyProjects(
            organizationId,
            integration.id,
            query ?? "",
          );
          const projectsWithEnvironments = await Promise.all(
            projectsResponse.projects.map(async (project) => {
              const envsResponse = await fetchLaunchDarklyEnvironments(
                organizationId,
                integration.id,
                project.key,
              );
              return { ...project, environments: envsResponse.environments };
            }),
          );
          return { integration, projects: projectsWithEnvironments };
        }),
      );
      return JSON.stringify({ integrations, resources });
    }
    case IntegrationType.GMAIL:
    case IntegrationType.FIGMA:
    case IntegrationType.CRON_JOB:
    case IntegrationType.TERSE:
    case IntegrationType.DATADOG:
      return JSON.stringify(
        "This is a system integration. No config is needed.",
      );
    default: {
      const _exhaustive: never = integrationType;
      throw new Error(`Unhandled integration type: ${_exhaustive}`);
    }
  }
}
