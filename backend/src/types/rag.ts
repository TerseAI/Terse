import type { JiraEvent } from "../integrations/AtlassianIntegration"
import type { FigmaCommentEvent } from "../integrations/FigmaIntegration"
import type { GithubEvent } from "../integrations/GithubIntegration"
import type { GmailEvent } from "../integrations/GmailIntegration"
import type { LinearEvent } from "../integrations/LinearIntegration"
import type { SlackEvent } from "../integrations/SlackIntegration"
import logger from "../logger"
import type { IdentifiableRunHistoryRawEvent } from "../rag/runHistoryRag/hydrator"

export enum HydratorType {
    RUN_HISTORY_RAW_EVENT = "run_history_raw_event",
    SLACK_MESSAGE_EVENT = "slack_message_event",
    GITHUB_EVENT = "github_event",
    LINEAR_EVENT = "linear_event",
    GMAIL_EVENT = "gmail_event",
    FIGMA_COMMENT_EVENT = "figma_comment_event",
    JIRA_EVENT = "jira_event"
}

const HYDRATOR_TYPE_VALUES = new Set(Object.values(HydratorType))

export function isHydratorType(value: string): value is HydratorType {
    return HYDRATOR_TYPE_VALUES.has(value as HydratorType)
}

export function parseHydratorType(value: string): HydratorType | undefined {
    return isHydratorType(value) ? value : undefined
}

export function requireHydratorType(value: string): HydratorType {
    if (!isHydratorType(value)) {
        logger.error(`Unknown HydratorType: ${value}`)
        throw new Error(`Unknown HydratorType: ${value}`)
    }
    return value
}

export type HydratorTypeMap = {
    [HydratorType.RUN_HISTORY_RAW_EVENT]: IdentifiableRunHistoryRawEvent
    [HydratorType.SLACK_MESSAGE_EVENT]: SlackEvent
    [HydratorType.GITHUB_EVENT]: GithubEvent
    [HydratorType.LINEAR_EVENT]: LinearEvent
    [HydratorType.GMAIL_EVENT]: GmailEvent
    [HydratorType.FIGMA_COMMENT_EVENT]: FigmaCommentEvent
    [HydratorType.JIRA_EVENT]: JiraEvent
}

export enum RAGNamespace {
    RUN_HISTORY_MEMORY = "run_history_memory"
}

export type NamespaceToHydratorTypes = {
    [RAGNamespace.RUN_HISTORY_MEMORY]: HydratorType.RUN_HISTORY_RAW_EVENT
}

export type NamespaceToHydratorType = {
    [N in RAGNamespace]: HydratorTypeMap[NamespaceToHydratorTypes[N]]
}
