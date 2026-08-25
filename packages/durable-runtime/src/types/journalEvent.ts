import { z } from "zod"

import { RunStartedEventSchema } from "./runStartedEvent.js"
import { StepStartedEventSchema } from "./stepStartedEvent.js"

export const JournalEventSchema = z.discriminatedUnion("type", [RunStartedEventSchema, StepStartedEventSchema])

export type JournalEvent = z.infer<typeof JournalEventSchema>
