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

test("accepts a step started event with JSON input", () => {
    const stepId = "step_01M0T693606YR9RF1E6NAZG7K0"
    const event = {
        eventId: `step.started:${stepId}`,
        type: "step.started",
        stepId,
        name: "create-greeting",
        startedAt: "2026-08-24T15:30:00.000Z",
        input: {
            person: "Ada"
        }
    }

    expect(JournalEventSchema.parse(event)).toEqual(event)
})
