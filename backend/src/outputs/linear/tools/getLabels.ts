import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

import { getLinearAccessTokenForOrganization } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { LinearAdapter } from "../../../ticketing/linear"
import { defineSessionTool } from "../../../tools/toolUtils"
import { extractErrorMessage } from "../../../utility/strings"

export const linearGetLabelsTool = defineSessionTool({
    name: "linear_get_labels",
    description: `List issue labels for the Linear workspace or a specific team. Use to pick labelIds for linear_create_ticket or linear_update_ticket.`,
    execute: async ({ integrationId, teamId }, runContext) => {
        logger.debug("🛠️ Executing linear_get_labels tool", { integrationId, teamId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getLinearAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

        const adapter = new LinearAdapter(accessToken)

        try {
            const labels = await adapter.getLabels(teamId ?? undefined)

            const action = {
                action: "Listed labels",
                integration: IntegrationType.LINEAR,
                target: "Linear workspace",
                details: `Found ${labels.length} label(s)${teamId ? " for team" : ""}`,
                type: RunHistoryActionType.read
            }

            return {
                success: true,
                labels,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error)
            logger.error("❌ Error listing Linear labels", { error: errorMessage, integrationId })
            throw new Error(`${errorMessage}. Check that the access token is valid and has the necessary permissions.`)
        }
    }
})
