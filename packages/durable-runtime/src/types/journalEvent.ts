import { z } from "zod"

import { RunCompletedEventSchema } from "./runCompletedEvent.js"
import { RunStartedEventSchema } from "./runStartedEvent.js"
import { StepCompletedEventSchema } from "./stepCompletedEvent.js"
import { StepFailedEventSchema } from "./stepFailedEvent.js"
import { StepStartedEventSchema } from "./stepStartedEvent.js"

export const JournalEventSchema = z.discriminatedUnion("type", [
    RunStartedEventSchema,
    RunCompletedEventSchema,
    StepStartedEventSchema,
    StepCompletedEventSchema,
    StepFailedEventSchema
])

export type JournalEvent = z.infer<typeof JournalEventSchema>
