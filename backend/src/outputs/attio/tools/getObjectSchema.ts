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
            const response = await fetch(`https://api.attio.com/v2/objects/${encodeURIComponent(objectSlug)}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })

            if (!response.ok) {
                const errorText = await response.text()
                logger.error("Attio get object schema failed", { status: response.status, error: errorText })
                throw new Error(`Attio API error (${response.status}): ${errorText}`)
            }

            const data = await response.json()
            const objectData = data?.data

            const action = {
                action: "Retrieved object schema",
                integration: IntegrationType.ATTIO,
                target: objectSlug,
                details: `Retrieved schema for ${objectSlug}`,
                type: RunHistoryActionType.read
            }

            return { success: true, object: objectData, actions: [action] }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error getting Attio object schema", { error: errorMessage, integrationId })
            throw new Error(errorMessage)
        }
    },
    errorFunction: formatError
})
