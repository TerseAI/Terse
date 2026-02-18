import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { AttioIntegrationManager } from "../../../integrations/AttioIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { createNeedsApprovalFunction, formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const attioUpsertRecordTool = tool({
    name: ToolName.ATTIO_UPSERT_RECORD,
    description: `Create or update (upsert) a record in Attio. Uses a matching attribute to find existing records — if a match is found the record is updated, otherwise a new one is created. Use attio_get_object_schema first to discover available attributes for the object.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Attio workspace to use."),
        objectSlug: z.string().describe("The Attio object type slug (e.g. 'people', 'companies')."),
        matchingAttribute: z.string().describe("The attribute slug to match on for upsert (e.g. 'email_addresses' for people, 'domains' for companies)."),
        values: z
            .string()
            .describe(
                'A JSON string mapping attribute slugs to their values. For multi-value attributes like email_addresses, pass an array of strings. Example: \'{"email_addresses":["test@example.com"],"name":"John"}\'.'
            )
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.ATTIO_UPSERT_RECORD),
    execute: async ({ integrationId, objectSlug, matchingAttribute, values }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("Executing attio_upsert_record tool", { integrationId, objectSlug, matchingAttribute })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new AttioIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error("Failed to get Attio access token. The integration may not be connected.")
        }

        try {
            const parsedValues = JSON.parse(values)
            const response = await fetch(`https://api.attio.com/v2/objects/${encodeURIComponent(objectSlug)}/records?matching_attribute=${encodeURIComponent(matchingAttribute)}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ data: { values: parsedValues } })
            })

            if (!response.ok) {
                const errorText = await response.text()
                logger.error("Attio upsert record failed", { status: response.status, error: errorText })
                throw new Error(`Attio API error (${response.status}): ${errorText}`)
            }

            const data = await response.json()
            const record = data?.data
            const recordId = record?.id?.record_id

            const action = {
                action: "Upserted record",
                integration: IntegrationType.ATTIO,
                target: `${objectSlug}/${recordId || "unknown"}`,
                details: `Upserted ${objectSlug} record via matching attribute "${matchingAttribute}"`,
                type: RunHistoryActionType.create,
                url: recordId ? `https://app.attio.com/objects/${objectSlug}/${recordId}` : undefined
            }

            return { success: true, record, actions: [action] }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error upserting Attio record", { error: errorMessage, integrationId })
            throw new Error(errorMessage)
        }
    },
    errorFunction: formatError
})
