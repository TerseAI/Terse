import { createHash } from "node:crypto"
import type { SerializedEvent } from "terse-types"

/**
 * Content-addressed id for a sample event. Stable across refetches as long as
 * the underlying Trigger payload (`event.data`) is identical — we deliberately
 * avoid hashing display strings like `formattedContent` because the server
 * renders relative timestamps that drift between calls.
 */
export function hashEventKey(event: SerializedEvent): string {
    const material = JSON.stringify({
        integrationType: event.integrationType,
        eventType: event.eventType,
        data: event.data
    })
    return createHash("sha256").update(material).digest("hex").slice(0, 12)
}
