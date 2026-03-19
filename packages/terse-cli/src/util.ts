import { SerializedEvent } from "./shared/types.js"
import { deserializeInputEvent, type InputEvent } from "terse-sdk"

export function convertSerializedEventToInputEvent(serializedEvent: SerializedEvent): InputEvent {
    return deserializeInputEvent(serializedEvent)
}
