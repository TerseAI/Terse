import type { AgentInputItem } from "@openai/agents-core"

import { db } from "../prismaClient"
import { EntityType } from "../shared/Entities"
import { ChangeEventType, type ModelEvent } from "../shared/ModelEvents"

import {
    type ConvertAgentInputItemsToModelEventsOptions,
    type TimestampedAgentInputItem,
    convertAgentInputItemsToModelEvents
} from "./agentInputItemsToModelEvents"

export type GetRunHistoryModelEventsOptions = ConvertAgentInputItemsToModelEventsOptions

/**
 * Loads run_history_raw_events for the run, converts to ModelEvents, and attaches
 * run_history_actions as changed_items on ToolCallComplete events.
 * Use for run history chat API, approval summary, and any flow that needs run history as model events.
 */
export async function getRunHistoryModelEventsWithActions(
    runId: string,
    options?: GetRunHistoryModelEventsOptions
): Promise<ModelEvent[]> {
    const prisma = db()
    const rawEvents = await prisma.run_history_raw_events.findMany({
        where: { run_history_record_id: runId },
        orderBy: [{ sequence_order: "asc" }, { created_at: "asc" }],
        select: { raw_event_json: true, created_at: true }
    })

    const timestampedItems: TimestampedAgentInputItem[] = rawEvents.map(rawEvent => ({
        item: rawEvent.raw_event_json as AgentInputItem,
        createdAt: rawEvent.created_at
    }))

    const modelEvents = await convertAgentInputItemsToModelEvents(timestampedItems, undefined, options)
    return attachRunHistoryChangedItems(runId, modelEvents)
}

async function attachRunHistoryChangedItems(runId: string, modelEvents: ModelEvent[]): Promise<ModelEvent[]> {
    const prisma = db()
    const runActions = await prisma.run_history_actions.findMany({
        where: { run_history_record_id: runId },
        select: { id: true, step_id: true }
    })

    const changedItemsByStepId = new Map<string, { type_name: EntityType; id: string; change_event_type: ChangeEventType }[]>()
    for (const action of runActions) {
        const stepId = action.step_id?.trim()
        if (!stepId) continue
        const items = changedItemsByStepId.get(stepId) ?? []
        items.push({
            type_name: EntityType.RUN_HISTORY_ACTION,
            id: action.id,
            change_event_type: ChangeEventType.ACTION_EXECUTED
        })
        changedItemsByStepId.set(stepId, items)
    }

    return modelEvents.map((event: ModelEvent) => {
        if (event.type === "ToolCallComplete" && event.step_id) {
            const changedItems = changedItemsByStepId.get(event.step_id) ?? []
            return { ...event, changed_items: changedItems }
        }
        return event
    })
}
