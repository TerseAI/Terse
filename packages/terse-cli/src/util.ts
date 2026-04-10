import { SerializedEvent, Trigger } from "terse-types"
import { TriggerSchema } from "terse-types"

export function convertSerializedEventToTrigger(serializedEvent: SerializedEvent): Trigger {
    return TriggerSchema.parse(serializedEvent)
}
