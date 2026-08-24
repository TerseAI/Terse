import { expect, test } from "vitest"

import { JournalEventSchema } from "../../src/types/journalEvent.js"

test("accepts a run started event", () => {
    const event = {
        eventId: "run.started",
        type: "run.started",
        workflowName: "daily-report",
        startedAt: "2026-08-24T15:30:00.000Z",
        input: {}
    }

    expect(JournalEventSchema.parse(event)).toEqual(event)
})
