import type { WaitEventType } from "./waitEventType.js"

export type CreateWaitEventIdParams = {
    readonly type: WaitEventType
    readonly waitId: string
}

export function createWaitEventId({ type, waitId }: CreateWaitEventIdParams): string {
    return `${type}:${waitId}`
}
