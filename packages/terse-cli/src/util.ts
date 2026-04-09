import { SerializedEvent, TriggerEvent } from "terse-types"
import { triggerEventSchema } from "terse-types"

export function convertSerializedEventToTriggerEvent(serializedEvent: SerializedEvent): TriggerEvent {
    return triggerEventSchema.parse(serializedEvent)
}
