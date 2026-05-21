import { HydratorType } from "terse-types"
import { hydratorTypeEnum } from "terse-types"

import logger from "../common/logger"
import type { IdentifiableRunHistoryRawEvent } from "../hydrators/runHistoryRag/hydrator"
import type { GithubTriggerRuntime } from "../integrations/github/integration"
import type { GmailTriggerRuntime } from "../integrations/gmail/integration"
import type { LinearTriggerRuntime } from "../integrations/linear/integration"
import type { SlackTriggerRuntime } from "../integrations/slack/integration"
import type { WebMonitorTriggerRuntime } from "../integrations/webMonitor/integration"
import type { WorkOSTriggerRuntime } from "../integrations/workos/integration"

function isHydratorType(value: string): value is HydratorType {
    return hydratorTypeEnum.safeParse(value).success
}

function parseHydratorType(value: string): HydratorType | undefined {
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
    run_history_raw_event: IdentifiableRunHistoryRawEvent
    slack_message_event: SlackTriggerRuntime
    github_event: GithubTriggerRuntime
    linear_event: LinearTriggerRuntime
    gmail_event: GmailTriggerRuntime
    workos_event: WorkOSTriggerRuntime
    webmonitor_event: WebMonitorTriggerRuntime
}

export enum RAGNamespace {
    RUN_HISTORY_MEMORY = "run_history_memory"
}

type NamespaceToHydratorTypes = {
    [RAGNamespace.RUN_HISTORY_MEMORY]: "run_history_raw_event"
}

type NamespaceToHydratorType = {
    [N in RAGNamespace]: HydratorTypeMap[NamespaceToHydratorTypes[N]]
}
