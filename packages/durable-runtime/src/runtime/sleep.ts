import ms from "ms"
import type { StringValue } from "ms"

import { TimerHook } from "./timerHook.js"
import { waitFor } from "./waitFor.js"

export async function sleep(duration: StringValue): Promise<void> {
    const durationMilliseconds = ms(duration)

    if (!Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0) {
        throw new RangeError(`Sleep duration must be greater than zero, received "${duration}"`)
    }

    await waitFor(TimerHook, {
        wakeAt: new Date(Date.now() + durationMilliseconds).toISOString()
    })
}
