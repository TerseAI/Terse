import { IntegrationType } from "./shared/Integrations"
import type { InputEvent } from "./types"

export class MockInputEvent implements InputEvent {
    readonly integrationType = IntegrationType.TERSE

    formatForAgentRunner(): string {
        return "Manual trigger from terse run"
    }

    debugLog(): string {
        return "[MockInputEvent] Manual trigger via CLI"
    }
}
