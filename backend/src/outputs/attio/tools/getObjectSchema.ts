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

export const attioGetObjectSchemaTool = tool({
    name: ToolName.ATTIO_GET_OBJECT_SCHEMA,
    description: `Get the schema (attributes and their types) for an Attio object. Use this to discover what fields are available before creating or updating records.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Attio workspace to use."),
        objectSlug: z.string().describe("The Attio object type slug (e.g. 'people', 'companies').")
    }),
    execute: async ({ integrationId, objectSlug }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("Executing attio_get_object_schema tool", { integrationId, objectSlug })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new AttioIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error("Failed to get Attio access token. The integration may not be connected.")
        }

        try {
            const headers = { Authorization: `Bearer ${accessToken}` }
            const slug = encodeURIComponent(objectSlug)

            const [objectResponse, attributesResponse] = await Promise.all([
                fetch(`https://api.attio.com/v2/objects/${slug}`, { method: "GET", headers }),
                fetch(`https://api.attio.com/v2/objects/${slug}/attributes`, { method: "GET", headers })
            ])

            if (!objectResponse.ok) {
                const errorText = await objectResponse.text()
                logger.error("Attio get object schema failed", { status: objectResponse.status, error: errorText })
                throw new Error(`Attio API error (${objectResponse.status}): ${errorText}`)
            }

            const objectData = (await objectResponse.json())?.data
            const attributes = attributesResponse.ok ? (await attributesResponse.json())?.data || [] : []
            const attributeCount = attributes.length

            const action = {
                action: "Retrieved object schema",
                integration: IntegrationType.ATTIO,
                target: objectSlug,
                details: `Retrieved schema for ${objectSlug} with ${attributeCount} attribute(s)`,
                type: RunHistoryActionType.read
            }

            return { success: true, object: objectData, attributes, actions: [action] }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error getting Attio object schema", { error: errorMessage, integrationId })
            throw new Error(errorMessage)
        }
    },
    errorFunction: formatError
})
