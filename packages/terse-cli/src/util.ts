import { SerializedEvent } from "./shared/types.js";
import { InputEvent, IntegrationType } from "terse-sdk";

export function convertSerializedEventToInputEvent(serializedEvent: SerializedEvent): InputEvent {
    return new SerializedEventInputEvent(serializedEvent);
}

export class SerializedEventInputEvent implements InputEvent {
    readonly integrationType: IntegrationType;
    readonly eventType: string;
    readonly formattedContent: string;
    readonly debugLogResult: string;
    
    constructor(serializedEvent: SerializedEvent) {
        this.integrationType = serializedEvent.integrationType;
        this.eventType = (serializedEvent as any).eventType ?? "unknown";
        this.formattedContent = serializedEvent.formattedContent;
        this.debugLogResult = serializedEvent.debugLog;
    }

    formatForAgentRunner(): string {
        return this.formattedContent;
    }

    debugLog(): string {
        return this.debugLogResult;
    }
}