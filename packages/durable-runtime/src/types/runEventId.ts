import type { RunEventType } from "./runEventType.js"

export type CreateRunEventIdParams<Type extends RunEventType = RunEventType> = {
    readonly type: Type
}

export function createRunEventId<Type extends RunEventType>({ type }: CreateRunEventIdParams<Type>): Type {
    return type
}
