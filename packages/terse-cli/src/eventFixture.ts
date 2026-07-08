import { eventFixtureSchema, hydrateSerializedEvent } from "terse-types"
import type { SerializedEvent } from "terse-types"
import { z } from "zod"

import { CliError } from "./cliError.js"

export function parseEventFixtureJson(raw: string, sourceLabel: string): SerializedEvent {
    const parsed = parseJson(raw, sourceLabel)
    const result = eventFixtureSchema.safeParse(parsed)
    if (result.success) {
        return hydrateSerializedEvent(result.data)
    }
    if (isLegacySerializedEventEnvelope(parsed)) {
        throw new CliError("legacy_event_envelope", `${sourceLabel} uses the old serialized-event envelope, which is no longer accepted.`, {
            detail: LEGACY_ENVELOPE_MIGRATION
        })
    }
    throw new CliError("invalid_event_shape", `${sourceLabel} does not match the canonical Trigger schema.`, {
        detail: `${z.prettifyError(result.error)}\n\n${EXPECTED_FIXTURE_HINT}`
    })
}

function parseJson(raw: string, sourceLabel: string): unknown {
    try {
        return JSON.parse(raw)
    } catch (err) {
        throw new CliError("invalid_event_json", `${sourceLabel} must be valid JSON.`, {
            detail: err instanceof Error ? err.message : String(err)
        })
    }
}

const legacyEnvelopeProbeSchema = z.object({
    data: z.object({ integrationType: z.string() })
})

function isLegacySerializedEventEnvelope(parsed: unknown): boolean {
    return legacyEnvelopeProbeSchema.safeParse(parsed).success
}

const EXPECTED_FIXTURE_HINT = [
    "Expected a flat trigger fixture, e.g. for a webhook:",
    "{",
    '  "integrationType": "webhook",',
    '  "eventType": "webhook",',
    '  "method": "POST",',
    '  "headers": { "content-type": "application/json" },',
    '  "body": { "your": "payload" }',
    "}",
    'Optional top-level "formattedContent" / "debugLog" strings override the derived prompt and log text.',
    "Tip: `terse test show <id> --json` emits ready-to-use fixtures."
].join("\n")

const LEGACY_ENVELOPE_MIGRATION = [
    "Hand-written events are now flat trigger fixtures.",
    'Move the fields inside "data" to the top level and drop "formattedContent", "debugLog", and "display": they are derived automatically.',
    'Keep top-level "formattedContent" or "debugLog" only to deliberately override the derived values.',
    "",
    EXPECTED_FIXTURE_HINT
].join("\n")
