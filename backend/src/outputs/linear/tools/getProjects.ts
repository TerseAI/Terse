import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, LinearOutputConfig } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { getLinearAccessTokenForOrganization } from "../../../integrations/linear/integration"
import { LinearAdapter } from "../../../ticketing/linear"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

import { validateLinearOptionalTeam } from "./getStates"

export const linearGetProjectsTool = defineSessionTool({
    name: "linear_get_projects",
    description: `List projects for the Linear workspace or a specific team. Use to pick projectId when creating or updating issues.`,
    execute: async ({ integrationId, teamId }, runContext) => {
        logger.debug("🛠️ Executing linear_get_projects tool", { integrationId, teamId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getLinearAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

        const adapter = new LinearAdapter(accessToken)

        try {
            const projects = await adapter.getProjects(teamId ?? undefined)

            const action = {
                action: "Listed projects",
                integration: IntegrationType.LINEAR,
                target: "Linear workspace",
                details: `Found ${projects.length} project(s)${teamId ? " for team" : ""}`,
                type: RunHistoryActionType.read
            }

            return {
                success: true,
                projects,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error)
            logger.error("❌ Error listing Linear projects", { error: errorMessage, integrationId })
            throw new Error(`${errorMessage}. Check that the access token is valid and has the necessary permissions.`)
        }
    }
})

export const validateLinearGetProjects: ToolACLValidator<"linear_get_projects", LinearOutputConfig> = ({ args, configs }) => validateLinearOptionalTeam(args.integrationId, args.teamId, configs)
