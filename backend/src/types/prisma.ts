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
  automation_notification_settings
  automation_linear_configs,
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
  };
}>;
export type ChannelInputWithConfigs = AutomationInputWithConfigs; // Alias for rebranding

export type AutomationOutput = automation_outputs;
export type ChannelOutput = automation_outputs; // Alias for rebranding

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
      }
    };
  }
}>;
export type ChannelWithInputRelations = AutomationWithInputRelations; // Alias for rebranding

export type AutomationWithOutputRelations = Prisma.automationsGetPayload<{
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
export type ChannelWithOutputRelations = AutomationWithOutputRelations; // Alias for rebranding

export type AutomationWithPromptRelations = Prisma.automationsGetPayload<{
  include: {
    prompt: true;
  }
}>;
export type ChannelWithPromptRelations = AutomationWithPromptRelations; // Alias for rebranding

export type AutomationWithRelations = AutomationWithInputRelations & AutomationWithOutputRelations & AutomationWithPromptRelations;
export type ChannelWithRelations = ChannelWithInputRelations & ChannelWithOutputRelations & ChannelWithPromptRelations; // Alias for rebranding

// Extract the transaction type from PrismaClient
export type PrismaTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

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
  user_notification_destinations
  automation_linear_configs
}; 