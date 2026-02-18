import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { AttioIntegrationManager } from "../../../integrations/AttioIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const attioQueryRecordsTool = tool({
    name: ToolName.ATTIO_QUERY_RECORDS,
    description: `Query records from an Attio object. Use this to search for existing records before creating or updating them. Supports optional filtering.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Attio workspace to use."),
        objectSlug: z.string().describe("The Attio object type slug (e.g. 'people', 'companies')."),
        filter: z.string().nullable().describe("Optional Attio filter as a JSON string. Pass null for no filtering. See Attio API docs for filter syntax."),
        limit: z.number().nullable().describe("Maximum number of records to return. Pass null to use the default of 20.")
    }),
    execute: async ({ integrationId, objectSlug, filter, limit }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("Executing attio_query_records tool", { integrationId, objectSlug })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new AttioIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error("Failed to get Attio access token. The integration may not be connected.")
        }

        try {
            const body: Record<string, unknown> = { limit: limit ?? 20 }
            if (filter) {
                const parsedFilter = JSON.parse(filter)
                if (parsedFilter && typeof parsedFilter === "object" && Object.keys(parsedFilter).length > 0) {
                    body.filter = parsedFilter
                }
            }

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
                logger.error("Attio query records failed", { status: response.status, error: errorText })
                throw new Error(`Attio API error (${response.status}): ${errorText}`)
            }

            const data = await response.json()
            const records = data?.data || []

            const action = {
                action: "Queried records",
                integration: IntegrationType.ATTIO,
                target: objectSlug,
                details: `Found ${records.length} ${objectSlug} record(s)`,
                type: RunHistoryActionType.read
            }

            return { success: true, records, count: records.length, actions: [action] }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error querying Attio records", { error: errorMessage, integrationId })
            throw new Error(errorMessage)
        }
    },
    errorFunction: formatError
})
