import { SerializedEvent, Trigger } from "terse-types"
import { triggerEventSchema } from "terse-types"

export function convertSerializedEventToTrigger(serializedEvent: SerializedEvent): Trigger {
    return triggerEventSchema.parse(serializedEvent)
}
