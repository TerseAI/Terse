import { $Enums, Prisma, PrismaClient } from "@prisma/client"
import type {
    approval_slack_messages,
    automation_inputs,
    automation_linear_configs,
    automation_notification_settings,
    automation_notion_configs,
    automation_outputs,
    automation_prompts,
    automations,
    gmail_integrations,
    identifiable_refs,
    linear_integrations,
    notion_integrations,
    output_change_attributions,
    project_deploys,
    projects,
    run_history_raw_events,
    slack_integrations,
    user_notification_destinations,
    user_notification_settings,
    user_slack_integrations,
    users
} from "@prisma/client"

// PascalCase aliases
export type User = users

type Project = projects

type LinearIntegration = linear_integrations

type SlackIntegration = slack_integrations

export type UserSlackIntegration = user_slack_integrations

// Extended type for UserSlackIntegration with user relation included
export type UserSlackIntegrationWithUser = Prisma.user_slack_integrationsGetPayload<{
    include: {
        user: true
        slack_integration: true
    }
}>

export type GmailIntegration = gmail_integrations

// Keep old names for database compatibility, but export as Agent types
type Automation = automations
export type Agent = automations // Alias for rebranding (formerly Channel)

export type UserNotificationDestination = user_notification_destinations
export type UserNotificationSettings = user_notification_settings
export type AutomationNotificationSettings = automation_notification_settings

type AutomationPrompt = automation_prompts
export type AgentPrompt = automation_prompts // Alias for rebranding (formerly ChannelPrompt)

type AutomationInput = automation_inputs
export type AgentTrigger = automation_inputs // Alias for rebranding (formerly ChannelInput)

type ApprovalSlackMessage = approval_slack_messages

type AgentNotificationSettings = automation_notification_settings

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
        webhook_config: true
        webmonitor_config: true
    }
}>
export type AgentTriggerWithConfigs = AutomationInputWithConfigs // Alias for rebranding (formerly ChannelInputWithConfigs)

type AutomationOutput = automation_outputs
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
    }
}>
export type AgentOutputWithConfigs = AutomationOutputWithConfigs // Alias for rebranding (formerly ChannelOutputWithConfigs)

type NotionIntegration = notion_integrations

type AutomationNotionConfig = automation_notion_configs
type AgentNotionConfig = automation_notion_configs // Alias for rebranding (formerly ChannelNotionConfig)

type AutomationLinearConfig = automation_linear_configs
type AgentLinearConfig = automation_linear_configs // Alias for rebranding (formerly ChannelLinearConfig)

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
                webhook_config: true
                webmonitor_config: true
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
export type AgentWithPromptRelations = AutomationWithPromptRelations // Alias for rebranding (formerly ChannelWithPromptRelations)

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

type AutomationWithRelations = AutomationWithInputRelations & AutomationWithOutputRelations & AutomationWithPromptRelations & Partial<AutomationWithToolApprovalsRelations>
export type AgentWithRelations = AgentWithTriggerRelations & AgentWithOutputRelations & AgentWithPromptRelations & AgentWithToolApprovalsRelations

export type SDKAgent = Omit<AgentWithRelations, "project"> & {
    project: Project
}

export function isSDKAgent(agent: AgentWithRelations): agent is SDKAgent {
    return agent.source === "SDK" && agent.project !== null
}

// Extract the transaction type from PrismaClient
export type PrismaTransaction = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

type RunHistoryRawEvent = run_history_raw_events

type OutputChangeAttribution = output_change_attributions
type IdentifiableRef = identifiable_refs

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

// Re-export enum types
type RunHistoryActionType = $Enums.RunHistoryActionType

// Re-export the original types too
export type { project_deploys }
