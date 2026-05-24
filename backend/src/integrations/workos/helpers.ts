import type { EventName } from "@workos-inc/node"
import { WorkOSEventType } from "terse-types/Configs"

// Compile-time check: every WorkOSEventType must be a valid @workos-inc/node EventName
const _assertValidEventNames: readonly EventName[] = Object.values(WorkOSEventType)
void _assertValidEventNames
