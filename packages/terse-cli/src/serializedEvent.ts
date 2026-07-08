import { serializedEventSchema } from "terse-types"
import type { SerializedEvent } from "terse-types"
import { z } from "zod"

import { CliError } from "./cliError.js"

export function parseSerializedEventJson(raw: string, flagLabel: string): SerializedEvent {
    return validateSerializedEvent(parseJson(raw, flagLabel))
}

function parseJson(raw: string, flagLabel: string): unknown {
    try {
        return JSON.parse(raw)
    } catch (err) {
        throw new CliError("invalid_event_json", `${flagLabel} must be valid JSON.`, {
            detail: err instanceof Error ? err.message : String(err)
        })
    }
}

function validateSerializedEvent(parsed: unknown): SerializedEvent {
    const result = serializedEventSchema.safeParse(parsed)
    if (result.success) return result.data
    throw new CliError("invalid_event_shape", "Event JSON does not match the canonical Trigger schema.", {
        detail: `${EXPECTED_ENVELOPE_HINT}\n\nValidation issues:\n${z.prettifyError(result.error)}`
    })
}

const EXPECTED_ENVELOPE_HINT = `Expected envelope (webhook example):
{
  "integrationType": "webhook",
  "eventType": "webhook",
  "formattedContent": "<any string>",
  "debugLog": "<any string>",
  "data": {
    "integrationType": "webhook",
    "eventType": "webhook",
    "body": <your provider payload>,
    "headers": { "content-type": "application/json" },
    "method": "POST"
  }
}
Tip: \`terse test show <id> --json\` prints a valid event.`
