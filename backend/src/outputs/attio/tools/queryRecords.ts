import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { AttioIntegrationManager } from "../../../integrations/AttioIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import type { AttioRecord, ToolOutputByName } from "../../../shared/types"
import { ToolName } from "../../../tools/ToolNames"
import { toolOutput } from "../../../tools/toolOutput"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

const attioQueryRecordsParams = z.object({
    integrationId: z.string().describe("The integration ID of the Attio workspace to use."),
    objectSlug: z.string().describe("The Attio object type slug (e.g. 'people', 'companies')."),
    filter: z
        .string()
        .nullable()
        .describe('Optional Attio filter as a JSON string. Pass null for no filtering. Use shorthand (e.g. \'{"email_addresses":"test@example.com"}\') or verbose syntax with operators.'),
    limit: z.number().nullable().describe("Maximum number of records to return. Pass null to use the default of 20.")
})

export const attioQueryRecordsTool = tool<typeof attioQueryRecordsParams, SessionWithTracking<Session>, ToolOutputByName["attio_query_records"]>({
    name: ToolName.ATTIO_QUERY_RECORDS,
    description: `Query records from an Attio object. Use this to search for existing records before creating or updating them. Supports optional filtering.

Filter syntax uses shorthand or verbose form:
- Shorthand: {"email_addresses": "test@example.com"} (implicit $eq on email_address property)
- Verbose: {"email_addresses": {"email_address": {"$eq": "test@example.com"}}}
- Text fields: {"name": {"first_name": {"$eq": "John"}}} or shorthand {"name": "John Smith"}
- Domains: {"domains": "example.com"} or {"domains": {"domain": {"$contains": "example"}}}
- Operators: $eq, $contains, $starts_with, $ends_with
- Combine with $and/$or: {"$and": [{"name": "John"}, {"email_addresses": "john@example.com"}]}`,
    parameters: attioQueryRecordsParams,
    execute: async ({ integrationId, objectSlug, filter, limit }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("Executing attio_query_records tool", { integrationId, objectSlug, limit: limit ?? 20, rawFilter: filter ?? null })

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
            const body: Record<string, unknown> = { limit: limit ?? 20 }
            if (filter) {
                let parsedFilter: unknown
                try {
                    parsedFilter = JSON.parse(filter)
                } catch (parseError) {
                    logger.error("Failed to parse Attio query filter", {
                        integrationId,
                        objectSlug,
                        rawFilter: filter,
                        error: parseError instanceof Error ? parseError.message : parseError
                    })
                    throw parseError
                }

                logger.debug("Parsed Attio query filter", {
                    integrationId,
                    objectSlug,
                    rawFilter: filter,
                    parsedFilter
                })

                if (parsedFilter && typeof parsedFilter === "object" && Object.keys(parsedFilter).length > 0) {
                    body.filter = parsedFilter
                }
            }

            logger.debug("Sending Attio query records request", {
                integrationId,
                objectSlug,
                requestBody: body
            })

            const response = await fetch(`https://api.attio.com/v2/objects/${encodeURIComponent(objectSlug)}/records/query`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            })

            if (!response.ok) {
                const errorText = await response.text()
                logger.error("Attio query records failed", {
                    integrationId,
                    objectSlug,
                    status: response.status,
                    requestBody: body,
                    error: errorText
                })
                throw new Error(`Attio API error (${response.status}): ${errorText}`)
            }

            const data = (await response.json()) as { data?: AttioRecord[] }
            const records = data?.data || []

            logger.debug("Attio query records succeeded", {
                integrationId,
                objectSlug,
                requestBody: body,
                recordCount: records.length
            })

            const action = {
                action: "Queried records",
                integration: IntegrationType.ATTIO,
                target: objectSlug,
                details: `Found ${records.length} ${objectSlug} record(s)`,
                type: RunHistoryActionType.read
            }

            return toolOutput("attio_query_records", { success: true, records, count: records.length, actions: [action] })
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error querying Attio records", { error: errorMessage, integrationId })
            throw new Error(errorMessage)
        }
    },
    errorFunction: formatError
})
