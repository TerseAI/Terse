import { expect, test } from "vitest"

import { createStepEventId, StepEventTypeSchema } from "../../src/index.js"

test("creates canonical step event IDs", () => {
    const stepId = "step_01M0T693606YR9RF1E6NAZG7K0"

    expect(StepEventTypeSchema.options.map(type => createStepEventId({ type, stepId }))).toEqual([
        `step.started:${stepId}`,
        `step.completed:${stepId}`,
        `step.failed:${stepId}`
    ])
})
