import ms from "ms"
import type { StringValue } from "ms"

import { waitFor } from "./waitFor.js"

export async function sleep(duration: StringValue): Promise<void> {
    const durationMilliseconds = ms(duration)

    if (!Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0) {
        throw new RangeError(`Sleep duration must be greater than zero, received "${duration}"`)
    }

    const request = {
        type: "timer",
        wakeAt: new Date(Date.now() + durationMilliseconds).toISOString()
    } as const

    await waitFor({ request })
}
