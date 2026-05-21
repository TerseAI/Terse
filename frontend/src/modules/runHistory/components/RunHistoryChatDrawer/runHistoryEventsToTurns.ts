import type { ModelEvent } from "terse-types/ModelEvents"

import { type Turn, applyEvents, filterOutThinkingOnlyTurns } from "@/modules/chat/turnModel"

export function convertRunHistoryEventsToTurns(events: ModelEvent[]): Turn[] {
    return filterOutThinkingOnlyTurns(applyEvents(events, { disableAnimation: true }))
}
