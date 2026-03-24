/**
 * SDK codegen barrel file.
 * Re-exports only the subset of shared types that a Python SDK consumer needs.
 * This controls exactly what enters the JSON Schema and therefore the generated Pydantic models.
 */

import type { ToolOutputByName as ToolOutputByNameMap } from "../../shared/types"

// --- types.ts ---
export type {
    Role,
    User,
    UserNoOrganization,
    TriggerPayload,
    SerializedEvent,
    SdkAgentRunEventPayload,
    SdkAgentSkillPayload,
    SdkAgentRunOptionsPayload,
    SdkAgentRunRequestBody,
    SdkAgentRunResponseBody,
    SdkAgentStreamEvent,
    SdkDeployTrigger,
    SdkDeployJob,
    SdkDeployRequestBody,
    SdkDeployResponseBody,
    Agent,
    AgentTrigger,
    AgentOutput,
    AgentPrompt,
    AgentUpdate,
    ApiToken,
    ApiTokenCreateResponse,
    Repository,
    ToolOutputBase,
} from "../../shared/types"
export type AttioListObjectsToolOutput = ToolOutputByNameMap["attio_list_objects"]
export type AttioQueryRecordsToolOutput = ToolOutputByNameMap["attio_query_records"]
export type AttioUpsertRecordToolOutput = ToolOutputByNameMap["attio_upsert_record"]
export type SnowflakeExecuteQueryToolOutput = ToolOutputByNameMap["snowflakeExecuteQuery"]
export type SnowflakeExplainQueryToolOutput = ToolOutputByNameMap["snowflakeExplainQuery"]

// --- Integrations.ts ---
export { IntegrationType } from "../../shared/Integrations"
export type { IntegrationDetails } from "../../shared/Integrations"

// --- Configs.ts ---
export { ConfigType } from "../../shared/Configs"
export type { ConfigDetails, ConfigInstance } from "../../shared/Configs"
export {
    SlackEventType,
    GitHubEventType,
    LinearEventType,
    JiraEventType,
    FigmaEventType,
    GmailEventType,
    WorkOSEventType,
} from "../../shared/Configs"

// --- RunHistoryTypes.ts ---
export { RunHistoryStatus } from "../../shared/RunHistoryTypes"
export type {
    RunHistoryActionType,
    RunHistoryAction,
    RunHistoryRecord,
} from "../../shared/RunHistoryTypes"

// --- ModelEvents.ts ---
export { ChangeEventType, ToolCallExecutionStatus } from "../../shared/ModelEvents"
export type { ModelEvent, ToolCall, TextDelta, RunError } from "../../shared/ModelEvents"

// --- Entities.ts ---
export { EntityType } from "../../shared/Entities"

// --- ApprovalTypes.ts ---
export type {
    ApprovalActionType,
    ApprovalRequestStatus,
    ApprovalRequest,
} from "../../shared/ApprovalTypes"

// --- Notifications.ts ---
export { NotificationDestinationType } from "../../shared/Notifications"
export type { NotificationSettings } from "../../shared/Notifications"

// --- TicketSystem.ts ---
export { TicketSystemType } from "../../shared/TicketSystem"
export type { Ticket, TicketState } from "../../shared/TicketSystem"
