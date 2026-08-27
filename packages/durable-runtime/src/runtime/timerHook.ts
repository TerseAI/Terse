import { z } from "zod"

import { defineHook } from "./defineHook.js"

export const TimerHook = defineHook({
    name: "timer",
    request: z
        .object({
            wakeAt: z.iso.datetime()
        })
        .strict(),
    resolution: z.object({}).strict()
})
