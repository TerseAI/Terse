import { integrationTypeEnum, manualSampleTriggerSchema, resolveTriggerSchema } from "terse-types"
import { z } from "zod"

/**
 * TriggerSchema is a union, so a failed parse collapses to "Invalid input" with no
 * field detail. Re-parse against the single member schema selected by the
 * candidate's integrationType to surface field-level issues.
 */
export function explainTriggerParseFailure(candidate: unknown, fallbackError: z.ZodError): string {
    if (typeof candidate !== "object" || candidate === null) {
        return z.prettifyError(fallbackError)
    }

    const record = candidate as Record<string, unknown>
    const integrationType = integrationTypeEnum.safeParse(record.integrationType)
    if (!integrationType.success) {
        return `Unknown integrationType ${JSON.stringify(record.integrationType)}. Valid values: ${integrationTypeEnum.options.join(", ")}.`
    }

    if (record.eventType === "manual_sample") {
        return prettifyMemberError(manualSampleTriggerSchema, candidate, fallbackError)
    }

    const memberSchema = resolveTriggerSchema(integrationType.data)
    if (!memberSchema) {
        return `integrationType "${integrationType.data}" has no trigger events, so it cannot appear in an event fixture.`
    }

    return prettifyMemberError(memberSchema, candidate, fallbackError)
}

function prettifyMemberError(schema: z.ZodType, candidate: unknown, fallbackError: z.ZodError): string {
    const result = schema.safeParse(candidate)
    return result.success ? z.prettifyError(fallbackError) : z.prettifyError(result.error)
}
