import { type InputEvent, deserializeInputEvent } from "terse-sdk"
import { SerializedEvent } from "terse-types"

export function convertSerializedEventToInputEvent(serializedEvent: SerializedEvent): InputEvent {
    return deserializeInputEvent(serializedEvent)
}
