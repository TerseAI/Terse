import { serializedEventSchema } from "terse-types"
import type { SerializedEvent } from "terse-types"
import { z } from "zod"

import { CliError } from "./cliError.js"
import { explainTriggerParseFailure } from "./triggerParseDetail.js"

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
        detail: `${EXPECTED_ENVELOPE_HINT}\n\nValidation issues:\n${describeEnvelopeIssues(parsed, result.error)}`
    })
}

function describeEnvelopeIssues(parsed: unknown, error: z.ZodError): string {
    const envelopeIssues = error.issues.filter(issue => issue.path[0] !== "data")
    const dataIssues = error.issues.filter(issue => issue.path[0] === "data")

    const parts: string[] = []
    if (envelopeIssues.length > 0) parts.push(z.prettifyError(new z.ZodError(envelopeIssues)))
    if (dataIssues.length > 0) {
        const data = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>).data : undefined
        parts.push(`In "data":\n${explainTriggerParseFailure(data, new z.ZodError(dataIssues))}`)
    }
    return parts.join("\n")
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
