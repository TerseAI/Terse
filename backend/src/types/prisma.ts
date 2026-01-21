import {
  users,
  github_repositories,
  linear_api_keys,
  linear_integrations,
  jira_api_keys,
  atlassian_integrations,
  slack_integrations,
  user_slack_integrations,
  user_github_repositories,
  activity_events,
  ticket_activity_events,
  sub_activity_events,
  sub_activity_commit_associations,
  gmail_integrations,
  automations,
  automation_prompts,
  automation_inputs,
  automation_outputs,
  notion_integrations,
  Prisma,
  automation_notion_configs,
  automation_notion_page_configs,
  automation_confluence_configs,
  PrismaClient,
  user_notification_destinations,
  automation_notification_settings,
  automation_linear_configs,
  directive_records,
  run_history_raw_events,
  approval_slack_messages,
  $Enums,
  output_change_attributions,
  identifiable_refs,
  automation_knowledge_bases,
  automation_jira_configs,
} from '@prisma/client';


// PascalCase aliases
export type User = users;

export type GithubRepository = github_repositories;

export type LinearApiKey = linear_api_keys;

export type LinearIntegration = linear_integrations;

export type JiraApiKey = jira_api_keys;

export type AtlassianIntegration = atlassian_integrations;

export type SlackIntegration = slack_integrations;

export type UserSlackIntegration = user_slack_integrations;

// Extended type for UserSlackIntegration with user relation included
export type UserSlackIntegrationWithUser = Prisma.user_slack_integrationsGetPayload<{
  include: {
    user: true;
    slack_integration: true;
  };
}>;

export type UserGithubRepository = user_github_repositories;

export type ActivityEvent = activity_events;

export type TicketActivityEvent = ticket_activity_events;

export type SubActivityEvent = sub_activity_events;

export type SubActivityCommitAssociation = sub_activity_commit_associations;

export type GmailIntegration = gmail_integrations;

export type Agent = automations;

export type UserNotificationDestination = user_notification_destinations;
export type AgentNotificationSettings = automation_notification_settings;

export type AgentPrompt = automation_prompts;

export type AgentInput = automation_inputs;

export type DirectiveRecord = directive_records;

export type ApprovalSlackMessage = approval_slack_messages;

// Extended type for AgentInput with all config relations included
export type AgentInputWithConfigs = Prisma.automation_inputsGetPayload<{
  include: {
    slack_config: true;
    notion_config: true;
    notion_page_config: true;
    linear_config: true;
    jira_config: true;
    confluence_config: true;
    github_config: true;
    gmail_config: true;
    figma_config: true;
    time_trigger_config: true;
  };
}>;

export type AgentOutput = automation_outputs;

export type AgentKnowledgeBase = automation_knowledge_bases;

// Extended type for AgentKnowledgeBase with all config relations included
export type AgentKnowledgeBaseWithConfigs = Prisma.automation_knowledge_basesGetPayload<{
  include: {
    posthog_config: true;
    github_kb_config: true;
    launchdarkly_config: true;
    datadog_config: true;
  };
}>;

// Extended type for AgentOutput with all config relations included
export type AgentOutputWithConfigs = Prisma.automation_outputsGetPayload<{
  include: {
    slack_config: true;
    notion_config: true;
    notion_page_config: true;
    linear_config: true;
    jira_config: true;
    confluence_config: true;
    github_config: true;
    gmail_config: true;
    figma_config: true;
  };
}>;

export type NotionIntegration = notion_integrations;

export type AgentNotionConfig = automation_notion_configs;

export type AgentNotionPageConfig = automation_notion_page_configs;

export type AgentConfluenceConfig = automation_confluence_configs;

export type AgentLinearConfig = automation_linear_configs;

export type AgentJiraConfig = automation_jira_configs;

export type AgentWithInputRelations = Prisma.automationsGetPayload<{
  include: {
    inputs: { 
      include: {
        slack_config: true;
        notion_config: true;
        notion_page_config: true;
        linear_config: true;
        jira_config: true;
        confluence_config: true;
        github_config: true;
        gmail_config: true;
        figma_config: true;
        time_trigger_config: true;
      }
    };
  }
}>;

export type AgentWithOutputRelations = Prisma.automationsGetPayload<{
  include: {
    output: {
      include: {
        slack_config: true;
        notion_config: true;
        notion_page_config: true;
        linear_config: true;
        jira_config: true;
        confluence_config: true;
        github_config: true;
        gmail_config: true;
        figma_config: true;
      }
    };
  }
}>;

export type AgentWithPromptRelations = Prisma.automationsGetPayload<{
  include: {
    prompt: true;
  }
}>;

export type AgentWithNotificationSettingsRelations = Prisma.automationsGetPayload<{
  include: {
    notification_settings: true;
  }
}>;

export type AgentWithKnowledgeBaseRelations = Prisma.automationsGetPayload<{
  include: {
    knowledge_bases: {
      include: {
        posthog_config: true;
        github_kb_config: true;
      };
    };
  };
}>;

export type AgentWithRelations = AgentWithInputRelations & AgentWithOutputRelations & AgentWithPromptRelations & Partial<AgentWithKnowledgeBaseRelations>;

// Extract the transaction type from PrismaClient
export type PrismaTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];


export type RunHistoryRawEvent = run_history_raw_events;

export type OutputChangeAttribution = output_change_attributions;
export type IdentifiableRef = identifiable_refs;


// Extended type for RunHistoryRawEvent with runHistory and automation relations included
export type RunHistoryRawEventWithRelations = Prisma.run_history_raw_eventsGetPayload<{
  include: {
    run_history_record: {
      include: {
        automation: true;
      };
    };
  };
}>;

// Re-export enum types
export type RunHistoryActionType = $Enums.RunHistoryActionType;

// Re-export the original types too
export {
  users,
  github_repositories,
  linear_api_keys,
  linear_integrations,
  jira_api_keys,
  atlassian_integrations,
  slack_integrations,
  user_slack_integrations,
  user_github_repositories,
  activity_events,
  ticket_activity_events,
  sub_activity_events,
  sub_activity_commit_associations,
  gmail_integrations,
  automations,
  automation_prompts, 
  automation_notification_settings,
  automation_inputs,
  automation_outputs,
  notion_integrations,
  automation_notion_configs,
  automation_notion_page_configs,
  automation_confluence_configs,
  user_notification_destinations,
  automation_linear_configs,
  approval_slack_messages,
  output_change_attributions,
  identifiable_refs,
}; 