import { RunContext } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"
import type { AttioAttribute, AttioRecord } from "terse-types"
import { ToolName } from "terse-types"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { AttioIntegrationManager } from "../../../integrations/AttioIntegration"
import logger from "../../../logger"
import { SessionToolOptions, createNeedsApprovalFunction, formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

const attioScalarValue = z.union([z.string(), z.number(), z.boolean(), z.null()])
const attioStructuredValue = z.object({}).catchall(z.union([attioScalarValue, z.array(attioScalarValue)]))
const attioRecordValue = z.union([attioScalarValue, attioStructuredValue, z.array(z.union([attioScalarValue, attioStructuredValue]))])

const attioUpsertRecordParams = z.object({
    integrationId: z.string().describe("The integration ID of the Attio workspace to use."),
    objectSlug: z.string().describe("The Attio object type slug (e.g. 'people', 'companies')."),
    matchingAttribute: z.string().describe("The attribute slug to match on for upsert (e.g. 'email_addresses' for people, 'domains' for companies)."),
    records: z
        .string()
        .describe(
            'A JSON string representing a list of Attio records to upsert. Each record should map attribute slugs to their values. For multi-value attributes like email_addresses, pass an array of strings. Example: \'[{"email_addresses":["test@example.com"],"name":"John"}]\'.'
        )
})

export const attioUpsertRecordTool: SessionToolOptions<typeof attioUpsertRecordParams, typeof ToolName.ATTIO_UPSERT_RECORD> = {
    name: ToolName.ATTIO_UPSERT_RECORD,
    description: `Create or update (upsert) one or more records in Attio. Uses a matching attribute to find existing records — if a match is found the record is updated, otherwise a new one is created. Use attio_list_objects first to discover available attributes for the object.`,
    parameters: attioUpsertRecordParams,
    execute: async ({ integrationId, objectSlug, matchingAttribute, records }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("Executing attio_upsert_record tool", { integrationId, objectSlug, matchingAttribute, recordCount: records.length })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new AttioIntegrationManager()
        const orgIntegrations = await manager.getInstancesForOrganization(runContext.context.user.organizationId)
        if (!orgIntegrations.some(i => i.id === integrationId)) {
            throw new Error("Attio integration not found or not authorized for this organization.")
        }

        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error("Failed to get Attio access token. The integration may not be connected.")
        }

        try {
            const parsedRecords = z.array(z.record(z.string(), attioRecordValue)).min(1).parse(JSON.parse(records))

            logger.debug("Executing attio_upsert_record tool", { integrationId, objectSlug, matchingAttribute, recordCount: parsedRecords.length })

            const successfulRecords: AttioRecord[] = []
            const actions = []
            const errors: Array<{ index: number; message: string }> = []

            for (const [index, recordValues] of parsedRecords.entries()) {
                const response = await fetch(`https://api.attio.com/v2/objects/${encodeURIComponent(objectSlug)}/records?matching_attribute=${encodeURIComponent(matchingAttribute)}`, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ data: { values: recordValues } })
                })

                if (!response.ok) {
                    const rawErrorText = await response.text()
                    const errorMessage = await normalizeAttioErrorMessage(rawErrorText, response.status, accessToken, objectSlug)
                    logger.error("Attio upsert record failed", {
                        status: response.status,
                        error: rawErrorText,
                        normalizedError: errorMessage,
                        integrationId,
                        objectSlug,
                        matchingAttribute,
                        recordIndex: index
                    })
                    errors.push({ index, message: errorMessage })
                    continue
                }

                const data = (await response.json()) as { data?: AttioRecord }
                const record = data?.data
                const recordId = record?.id?.record_id

                if (record) {
                    successfulRecords.push(record)
                }

                actions.push({
                    action: "Upserted record",
                    integration: IntegrationType.ATTIO,
                    target: `${objectSlug}/${recordId || "unknown"}`,
                    details: `Upserted ${objectSlug} record via matching attribute "${matchingAttribute}"`,
                    type: RunHistoryActionType.create,
                    url: record?.web_url || (recordId ? `https://app.attio.com/objects/${objectSlug}/${recordId}` : undefined)
                })
            }

            const successCount = successfulRecords.length
            const failureCount = errors.length
            const partial = successCount > 0 && failureCount > 0

            return {
                success: successCount > 0 || failureCount === 0,
                records: successfulRecords,
                count: successCount,
                requestedCount: parsedRecords.length,
                successCount,
                failureCount,
                partial,
                errors,
                actions
            }
        } catch (error: unknown) {
            logger.error("Error upserting Attio record", { error: error instanceof Error ? error.message : error, integrationId })
            throw error instanceof Error ? error : new Error(String(error))
        }
    }
}

type AttioApiError = {
    code?: string
    message?: string
}

function parseAttioError(rawErrorText: string): AttioApiError | null {
    try {
        const firstParse = JSON.parse(rawErrorText) as string | AttioApiError
        return typeof firstParse === "string" ? (JSON.parse(firstParse) as AttioApiError) : firstParse
    } catch {
        return null
    }
}

function getMissingAttributeId(parsedError: AttioApiError): string | undefined {
    if (parsedError.code !== "missing_value") return undefined
    return parsedError.message?.match(/attribute with ID "([^"]+)"/)?.[1]
}

async function fetchAttioAttributes(accessToken: string, objectSlug: string): Promise<AttioAttribute[] | null> {
    const response = await fetch(`https://api.attio.com/v2/objects/${encodeURIComponent(objectSlug)}/attributes`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })

    if (!response.ok) return null

    const data = (await response.json()) as { data?: AttioAttribute[] }
    return data.data || []
}

function getAttributeId(attribute: AttioAttribute): string | undefined {
    const rawId = attribute.id
    if (typeof rawId === "string") return rawId
    if (!rawId || typeof rawId !== "object") return undefined
    return typeof (rawId as Record<string, unknown>).attribute_id === "string" ? ((rawId as Record<string, unknown>).attribute_id as string) : undefined
}

function formatRequiredFields(attributes: AttioAttribute[]): string[] {
    return attributes
        .filter(attribute => attribute.is_required && attribute.api_slug)
        .map(attribute => (attribute.title ? `${attribute.title} (${attribute.api_slug})` : (attribute.api_slug as string)))
}

function findAttributeById(attributes: AttioAttribute[], attributeId: string): AttioAttribute | undefined {
    return attributes.find(attribute => getAttributeId(attribute) === attributeId)
}

function buildMissingFieldMessage(objectSlug: string, attributes: AttioAttribute[], missingAttributeId: string): string {
    const requiredFields = formatRequiredFields(attributes)
    const missingAttribute = findAttributeById(attributes, missingAttributeId)

    if (missingAttribute?.api_slug) {
        const fieldLabel = missingAttribute.title ? `${missingAttribute.title} (${missingAttribute.api_slug})` : missingAttribute.api_slug
        return requiredFields.length > 0
            ? `Attio requires "${fieldLabel}" before this record can be created. Required fields for ${objectSlug}: ${requiredFields.join(", ")}.`
            : `Attio requires "${fieldLabel}" before this record can be created.`
    }

    return requiredFields.length > 0
        ? `Attio is missing a required field for "${objectSlug}". Required fields: ${requiredFields.join(", ")}.`
        : `Attio is missing a required field for "${objectSlug}".`
}

async function normalizeAttioErrorMessage(rawErrorText: string, status: number, accessToken: string, objectSlug: string): Promise<string> {
    const parsedError = parseAttioError(rawErrorText)
    if (!parsedError) {
        return rawErrorText.trim() || `Attio request failed (${status}).`
    }

    const fallbackMessage = parsedError.message || `Attio request failed (${status}).`
    const missingAttributeId = getMissingAttributeId(parsedError)
    if (!missingAttributeId) return fallbackMessage

    const attributes = await fetchAttioAttributes(accessToken, objectSlug)
    if (!attributes) {
        return `Attio is missing a required field for "${objectSlug}".`
    }

    return buildMissingFieldMessage(objectSlug, attributes, missingAttributeId)
}
