import type {
    automation_attio_configs,
    automation_confluence_configs,
    automation_datadog_configs,
    automation_github_configs,
    automation_gmail_configs,
    automation_jira_configs,
    automation_launchdarkly_configs,
    automation_linear_configs,
    automation_notion_configs,
    automation_posthog_configs,
    automation_slack_configs
} from "@prisma/client"
import { OutputConfigType } from "@prisma/client"

import type { AgentOutputWithConfigs } from "./types/prisma"

const DUMMY_DATE = new Date(0)
const DUMMY_ID = "example"

// ── Output dummy configs ────────────────────────────────────────

type OutputDummyPayload =
    | { config_type: typeof OutputConfigType.SLACK_CHANNEL; slack_config: Pick<automation_slack_configs, "channel_id" | "channel_name" | "user_ids"> }
    | { config_type: typeof OutputConfigType.NOTION; notion_config: Pick<automation_notion_configs, "database_ids" | "database_names" | "page_ids" | "page_names"> }
    | { config_type: typeof OutputConfigType.LINEAR_TICKET; linear_config: Pick<automation_linear_configs, "team_id" | "team_name"> }
    | { config_type: typeof OutputConfigType.JIRA_TICKET; jira_config: Pick<automation_jira_configs, "project_key" | "project_id"> }
    | { config_type: typeof OutputConfigType.CONFLUENCE; confluence_config: Pick<automation_confluence_configs, "space_name" | "space_id" | "page_id" | "page_name"> }
    | { config_type: typeof OutputConfigType.GMAIL; gmail_config: Partial<Pick<automation_gmail_configs, never>> }
    | { config_type: typeof OutputConfigType.GITHUB; github_config: Pick<automation_github_configs, "repository_ids"> }
    | { config_type: typeof OutputConfigType.POSTHOG; posthog_config: Pick<automation_posthog_configs, "project_id" | "project_name"> }
    | { config_type: typeof OutputConfigType.DATADOG; datadog_config: Pick<automation_datadog_configs, "default_indexes"> }
    | { config_type: typeof OutputConfigType.LAUNCHDARKLY; launchdarkly_config: Pick<automation_launchdarkly_configs, "project_key" | "environment_keys"> }
    | { config_type: typeof OutputConfigType.GMAIL_DRAFT; gmail_config: Partial<Pick<automation_gmail_configs, never>> }
    | { config_type: typeof OutputConfigType.TERSE }
    | { config_type: typeof OutputConfigType.ATTIO; attio_config: Pick<automation_attio_configs, "object_slug"> }

export function buildDummyOutputConfig(integration_id: string, payload: OutputDummyPayload): AgentOutputWithConfigs {
    const base: Omit<
        AgentOutputWithConfigs,
        | "slack_config"
        | "notion_config"
        | "linear_config"
        | "jira_config"
        | "confluence_config"
        | "github_config"
        | "gmail_config"
        | "posthog_config"
        | "datadog_config"
        | "launchdarkly_config"
        | "figma_config"
        | "attio_config"
    > = {
        id: DUMMY_ID,
        automation_id: DUMMY_ID,
        integration_id,
        read_only: false,
        config_type: payload.config_type,
        created_at: DUMMY_DATE,
        updated_at: DUMMY_DATE
    }

    const nullConfigs = {
        slack_config: null as AgentOutputWithConfigs["slack_config"],
        notion_config: null as AgentOutputWithConfigs["notion_config"],
        linear_config: null as AgentOutputWithConfigs["linear_config"],
        jira_config: null as AgentOutputWithConfigs["jira_config"],
        confluence_config: null as AgentOutputWithConfigs["confluence_config"],
        github_config: null as AgentOutputWithConfigs["github_config"],
        gmail_config: null as AgentOutputWithConfigs["gmail_config"],
        posthog_config: null as AgentOutputWithConfigs["posthog_config"],
        datadog_config: null as AgentOutputWithConfigs["datadog_config"],
        launchdarkly_config: null as AgentOutputWithConfigs["launchdarkly_config"],
        figma_config: null as AgentOutputWithConfigs["figma_config"],
        attio_config: null as AgentOutputWithConfigs["attio_config"]
    }

    switch (payload.config_type) {
        case OutputConfigType.SLACK_CHANNEL:
            return {
                ...base,
                ...nullConfigs,
                slack_config: {
                    id: DUMMY_ID,
                    automation_input_id: null,
                    automation_output_id: DUMMY_ID,
                    listen_to_user_dms: false,
                    created_at: DUMMY_DATE,
                    updated_at: DUMMY_DATE,
                    ...payload.slack_config
                }
            }
        case OutputConfigType.NOTION:
            return {
                ...base,
                ...nullConfigs,
                notion_config: {
                    id: DUMMY_ID,
                    automation_input_id: null,
                    automation_output_id: DUMMY_ID,
                    created_at: DUMMY_DATE,
                    updated_at: DUMMY_DATE,
                    ...payload.notion_config
                }
            }
        case OutputConfigType.LINEAR_TICKET:
            return {
                ...base,
                ...nullConfigs,
                linear_config: {
                    id: DUMMY_ID,
                    automation_input_id: null,
                    automation_output_id: DUMMY_ID,
                    project_id: null,
                    project_name: null,
                    created_at: DUMMY_DATE,
                    updated_at: DUMMY_DATE,
                    ...payload.linear_config
                }
            }
        case OutputConfigType.JIRA_TICKET:
            return {
                ...base,
                ...nullConfigs,
                jira_config: {
                    id: DUMMY_ID,
                    automation_input_id: null,
                    automation_output_id: DUMMY_ID,
                    created_at: DUMMY_DATE,
                    updated_at: DUMMY_DATE,
                    ...payload.jira_config
                }
            }
        case OutputConfigType.CONFLUENCE:
            return {
                ...base,
                ...nullConfigs,
                confluence_config: {
                    id: DUMMY_ID,
                    automation_input_id: null,
                    automation_output_id: DUMMY_ID,
                    created_at: DUMMY_DATE,
                    updated_at: DUMMY_DATE,
                    ...payload.confluence_config
                }
            }
        case OutputConfigType.GMAIL:
            return {
                ...base,
                ...nullConfigs,
                gmail_config: {
                    id: DUMMY_ID,
                    automation_input_id: null,
                    automation_output_id: DUMMY_ID,
                    created_at: DUMMY_DATE,
                    updated_at: DUMMY_DATE
                }
            }
        case OutputConfigType.GITHUB:
            return {
                ...base,
                ...nullConfigs,
                github_config: {
                    id: DUMMY_ID,
                    automation_input_id: null,
                    automation_output_id: DUMMY_ID,
                    repository_ids: payload.github_config.repository_ids
                }
            }
        case OutputConfigType.GMAIL_DRAFT:
            return {
                ...base,
                ...nullConfigs,
                gmail_config: {
                    id: DUMMY_ID,
                    automation_input_id: null,
                    automation_output_id: DUMMY_ID,
                    created_at: DUMMY_DATE,
                    updated_at: DUMMY_DATE
                }
            }
        case OutputConfigType.POSTHOG:
            return {
                ...base,
                ...nullConfigs,
                posthog_config: {
                    id: DUMMY_ID,
                    automation_knowledge_base_id: null,
                    automation_output_id: DUMMY_ID,
                    project_id: payload.posthog_config.project_id,
                    project_name: payload.posthog_config.project_name
                }
            }
        case OutputConfigType.DATADOG:
            return {
                ...base,
                ...nullConfigs,
                datadog_config: {
                    id: DUMMY_ID,
                    automation_knowledge_base_id: null,
                    automation_output_id: DUMMY_ID,
                    default_indexes: payload.datadog_config.default_indexes
                }
            }
        case OutputConfigType.LAUNCHDARKLY:
            return {
                ...base,
                ...nullConfigs,
                launchdarkly_config: {
                    id: DUMMY_ID,
                    automation_knowledge_base_id: null,
                    automation_output_id: DUMMY_ID,
                    project_key: payload.launchdarkly_config.project_key,
                    environment_keys: payload.launchdarkly_config.environment_keys
                }
            }
        case OutputConfigType.TERSE:
            return { ...base, ...nullConfigs }
        case OutputConfigType.ATTIO:
            return {
                ...base,
                ...nullConfigs,
                attio_config: {
                    id: DUMMY_ID,
                    automation_input_id: null,
                    automation_output_id: DUMMY_ID,
                    created_at: DUMMY_DATE,
                    updated_at: DUMMY_DATE,
                    ...payload.attio_config
                }
            }
        default: {
            const _exhaustive: never = payload
            throw new Error("Unhandled output config_type")
        }
    }
}
