import { expect, test } from "vitest"

import { createRunEventId, RunEventTypeSchema } from "../../src/index.js"

test("creates canonical run event IDs", () => {
    expect(RunEventTypeSchema.options.map(type => createRunEventId({ type }))).toEqual(["run.started", "run.completed"])
})
