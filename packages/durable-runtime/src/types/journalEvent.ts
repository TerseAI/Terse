import { z } from "zod"

import { RunStartedEventSchema } from "./runStartedEvent.js"

export const JournalEventSchema = z.discriminatedUnion("type", [RunStartedEventSchema])

export type JournalEvent = z.infer<typeof JournalEventSchema>
