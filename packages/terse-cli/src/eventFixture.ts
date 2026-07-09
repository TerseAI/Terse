import { eventFixtureSchema, hydrateSerializedEvent } from "terse-types"
import type { SerializedEvent } from "terse-types"

import { CliError } from "./cliError.js"
import { explainTriggerParseFailure } from "./triggerParseDetail.js"

export function parseEventFixtureJson(raw: string, sourceLabel: string): SerializedEvent {
    const parsed = parseJson(raw, sourceLabel)
    const result = eventFixtureSchema.safeParse(parsed)
    if (result.success) {
        return hydrateSerializedEvent(result.data)
    }
    throw new CliError("invalid_event_shape", `${sourceLabel} does not match the canonical Trigger schema.`, {
        detail: `${explainTriggerParseFailure(parsed, result.error)}\n\n${EXPECTED_FIXTURE_HINT}`
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
