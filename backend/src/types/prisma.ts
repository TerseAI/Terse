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

// Keep old names for database compatibility, but export as Channel types
export type Automation = automations;
export type Channel = automations; // Alias for rebranding

export type UserNotificationDestination = user_notification_destinations;
export type AutomationNotificationSettings = automation_notification_settings;

export type AutomationPrompt = automation_prompts;
export type ChannelPrompt = automation_prompts; // Alias for rebranding

export type AutomationInput = automation_inputs;
export type ChannelInput = automation_inputs; // Alias for rebranding

export type DirectiveRecord = directive_records;

export type ApprovalSlackMessage = approval_slack_messages;

export type ChannelNotificationSettings = automation_notification_settings;

// Extended type for ChannelInput with all config relations included
export type AutomationInputWithConfigs = Prisma.automation_inputsGetPayload<{
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
export type ChannelInputWithConfigs = AutomationInputWithConfigs; // Alias for rebranding

export type AutomationOutput = automation_outputs;
export type ChannelOutput = automation_outputs; // Alias for rebranding

export type ChannelKnowledgeBase = automation_knowledge_bases;

// Extended type for ChannelKnowledgeBase with all config relations included
export type ChannelKnowledgeBaseWithConfigs = Prisma.automation_knowledge_basesGetPayload<{
  include: {
    posthog_config: true;
    github_kb_config: true;
    launchdarkly_config: true;
    datadog_config: true;
  };
}>;


// Extended type for ChannelOutput with all config relations included
export type AutomationOutputWithConfigs = Prisma.automation_outputsGetPayload<{
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
export type ChannelOutputWithConfigs = AutomationOutputWithConfigs; // Alias for rebranding

export type NotionIntegration = notion_integrations;

export type AutomationNotionConfig = automation_notion_configs;
export type ChannelNotionConfig = automation_notion_configs; // Alias for rebranding

export type AutomationNotionPageConfig = automation_notion_page_configs;
export type ChannelNotionPageConfig = automation_notion_page_configs; // Alias for rebranding

export type AutomationConfluenceConfig = automation_confluence_configs;
export type ChannelConfluenceConfig = automation_confluence_configs; // Alias for rebranding

export type AutomationLinearConfig = automation_linear_configs;
export type ChannelLinearConfig = automation_linear_configs; // Alias for rebranding

export type ChannelJiraConfig = automation_jira_configs;

export type AutomationWithInputRelations = Prisma.automationsGetPayload<{
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
export type ChannelWithInputRelations = AutomationWithInputRelations; // Alias for rebranding

export type AutomationWithOutputRelations = Prisma.automationsGetPayload<{
  include: {
    outputs: {
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
export type ChannelWithOutputRelations = AutomationWithOutputRelations; // Alias for rebranding

export type AutomationWithPromptRelations = Prisma.automationsGetPayload<{
  include: {
    prompt: true;
  }
}>;
export type ChannelWithPromptRelations = AutomationWithPromptRelations; // Alias for rebranding

export type AutomationWithNotificationSettingsRelations = Prisma.automationsGetPayload<{
  include: {
    notification_settings: true;
  }
}>;
export type ChannelWithNotificationSettingsRelations = AutomationWithNotificationSettingsRelations; // Alias for rebranding

export type AutomationWithKnowledgeBaseRelations = Prisma.automationsGetPayload<{
  include: {
    knowledge_bases: {
      include: {
        posthog_config: true;
        github_kb_config: true;
      };
    };
  };
}>;
export type ChannelWithKnowledgeBaseRelations = AutomationWithKnowledgeBaseRelations;

export type AutomationWithRelations = AutomationWithInputRelations & AutomationWithOutputRelations & AutomationWithPromptRelations & Partial<AutomationWithKnowledgeBaseRelations>;
export type ChannelWithRelations = ChannelWithInputRelations & ChannelWithOutputRelations & ChannelWithPromptRelations & Partial<ChannelWithKnowledgeBaseRelations>;

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