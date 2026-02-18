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

export const attioListObjectsTool = tool({
    name: ToolName.ATTIO_LIST_OBJECTS,
    description: `List all available objects in the Attio workspace. Use this to discover what object types (e.g. people, companies, deals) are available.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Attio workspace to use.")
    }),
    execute: async ({ integrationId }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("Executing attio_list_objects tool", { integrationId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new AttioIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            return { success: false, error: "Failed to get Attio access token. The integration may not be connected." }
        }

        try {
            const response = await fetch("https://api.attio.com/v2/objects", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })

            if (!response.ok) {
                const errorText = await response.text()
                logger.error("Attio list objects failed", { status: response.status, error: errorText })
                return { success: false, error: `Attio API error (${response.status}): ${errorText}` }
            }

            const data = await response.json()
            const objects = data?.data || []

            const action = {
                action: "Listed objects",
                integration: IntegrationType.ATTIO,
                target: "Attio workspace",
                details: `Found ${objects.length} object type(s)`,
                type: RunHistoryActionType.read
            }

            return { success: true, objects, count: objects.length, actions: [action] }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error listing Attio objects", { error: errorMessage, integrationId })
            return { success: false, error: errorMessage }
        }
    },
    errorFunction: formatError
})
