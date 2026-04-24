import { createHash } from "node:crypto"
import type { SerializedEvent } from "terse-types"

/**
 * Content-addressed id for a sample event. Stable across refetches as long as
 * the underlying Trigger payload (`event.data`) is identical — we deliberately
 * avoid hashing display strings like `formattedContent` because the server
 * renders relative timestamps that drift between calls.
 *
 * For synthetic cron/webhook events the CLI builds in test.ts, the caller is
 * responsible for ensuring each trigger produces a distinct `data` (e.g. by
 * stamping a `_syntheticTriggerIndex`).
 */
export function hashEventKey(event: SerializedEvent): string {
    const material = JSON.stringify({
        integrationType: event.integrationType,
        eventType: event.eventType,
        data: event.data
    })
    return createHash("sha256").update(material).digest("hex").slice(0, 12)
}
