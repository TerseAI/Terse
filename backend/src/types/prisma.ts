import { $Enums, Prisma, PrismaClient } from "@prisma/client"
import type {
    automation_inputs,
    automation_notification_settings,
    automation_outputs,
    automation_prompts,
    automations,
    gmail_integrations,
    google_search_console_integrations,
    project_deploys,
    user_notification_destinations,
    user_notification_settings,
    user_slack_integrations
} from "@prisma/client"

export type UserSlackIntegration = user_slack_integrations

// Extended type for UserSlackIntegration with slack_integration included
export type UserSlackIntegrationWithSlack = Prisma.user_slack_integrationsGetPayload<{
    include: {
        slack_integration: true
    }
}>

export type GmailIntegration = gmail_integrations
export type GoogleSearchConsoleIntegration = google_search_console_integrations

export type Agent = automations // Alias for rebranding (formerly Channel)

export type UserNotificationDestination = user_notification_destinations
export type UserNotificationSettings = user_notification_settings
export type AutomationNotificationSettings = automation_notification_settings

export type AgentPrompt = automation_prompts // Alias for rebranding (formerly ChannelPrompt)

export type AgentTrigger = automation_inputs // Alias for rebranding (formerly ChannelInput)

// Extended type for AgentTrigger with all config relations included
type AutomationInputWithConfigs = Prisma.automation_inputsGetPayload<{
    include: {
        slack_config: true
        notion_config: true
        linear_config: true
        github_config: true
        gmail_config: true
        time_trigger_config: true
        workos_config: true
        attio_input_config: true
        webhook_config: true
        webmonitor_config: true
        hey_reach_config: true
    }
}>
export type AgentTriggerWithConfigs = AutomationInputWithConfigs // Alias for rebranding (formerly ChannelInputWithConfigs)

export type AgentOutput = automation_outputs // Alias for rebranding (formerly ChannelOutput)

// Extended type for AgentOutput with all config relations included
type AutomationOutputWithConfigs = Prisma.automation_outputsGetPayload<{
    include: {
        slack_config: true
        notion_config: true
        linear_config: true
        github_config: true
        gmail_config: true
        posthog_config: true
        datadog_config: true
        launchdarkly_config: true
        workos_output_config: true
        attio_config: true
        snowflake_config: true
        resend_config: true
        apollo_config: true
        google_search_console_config: true
        meta_ads_config: true
    }
}>
export type AgentOutputWithConfigs = AutomationOutputWithConfigs // Alias for rebranding (formerly ChannelOutputWithConfigs)

type AutomationWithInputRelations = Prisma.automationsGetPayload<{
    include: {
        inputs: {
            include: {
                slack_config: true
                notion_config: true
                linear_config: true
                github_config: true
                gmail_config: true
                time_trigger_config: true
                workos_config: true
                attio_input_config: true
                webhook_config: true
                webmonitor_config: true
                hey_reach_config: true
            }
        }
    }
}>
export type AgentWithTriggerRelations = AutomationWithInputRelations // Alias for rebranding (formerly ChannelWithInputRelations)

type AutomationWithOutputRelations = Prisma.automationsGetPayload<{
    include: {
        outputs: {
            include: {
                slack_config: true
                notion_config: true
                linear_config: true
                github_config: true
                gmail_config: true
                posthog_config: true
                datadog_config: true
                launchdarkly_config: true
                workos_output_config: true
                attio_config: true
                snowflake_config: true
                resend_config: true
                apollo_config: true
                google_search_console_config: true
                meta_ads_config: true
            }
        }
    }
}>
type AgentWithOutputRelations = AutomationWithOutputRelations // Alias for rebranding (formerly ChannelWithOutputRelations)

type AutomationWithPromptRelations = Prisma.automationsGetPayload<{
    include: {
        prompt: true
        project: true
    }
}>
type AgentWithPromptRelations = AutomationWithPromptRelations // Alias for rebranding (formerly ChannelWithPromptRelations)

type AutomationWithNotificationSettingsRelations = Prisma.automationsGetPayload<{
    include: {
        notification_settings: true
    }
}>
export type AgentWithNotificationSettingsRelations = AutomationWithNotificationSettingsRelations // Alias for rebranding (formerly ChannelWithNotificationSettingsRelations)

type AutomationWithToolApprovalsRelations = Prisma.automationsGetPayload<{
    include: {
        tool_approvals: true
    }
}>

type AgentWithToolApprovalsRelations = AutomationWithToolApprovalsRelations

export type AgentWithRelations = AgentWithTriggerRelations & AgentWithOutputRelations & AgentWithPromptRelations & AgentWithToolApprovalsRelations

// Extract the transaction type from PrismaClient
export type PrismaTransaction = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

// Extended type for RunHistoryRawEvent with runHistory and automation relations included
export type RunHistoryRawEventWithRelations = Prisma.run_history_raw_eventsGetPayload<{
    include: {
        run_history_record: {
            include: {
                automation: true
            }
        }
    }
}>

// Re-export the original types too
export type { project_deploys }
