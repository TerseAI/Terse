import { Prisma } from "@prisma/client"
import { SerializedEvent, serializedEventSchema } from "terse-types"

export function parseSerializedTriggerPayload(payload: Prisma.JsonValue | null): SerializedEvent | null {
    if (payload === null) {
        return null
    }

    const rawPayload = typeof payload === "string" ? JSON.parse(payload) : payload
    return serializedEventSchema.parse(rawPayload)
}
