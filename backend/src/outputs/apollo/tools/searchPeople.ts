import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { searchApolloPeople } from "../../../integrations/apollo/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"
import { requireApolloApiKey } from "../apolloCredentials"

export const apolloSearchPeopleTool = defineSessionTool({
    name: "apollo_search_people",
    execute: async ({ integrationId, ...filters }, runContext) => {
        if (!runContext?.context) throw new Error("No context provided")
        const apiKey = await requireApolloApiKey(integrationId, runContext.context.user)

        try {
            const result = await searchApolloPeople(apiKey, filters)
            return {
                success: true,
                people: result.people,
                totalEntries: result.totalEntries,
                page: result.page,
                perPage: result.perPage,
                actions: [
                    {
                        action: "Searched people via Apollo",
                        integration: IntegrationType.APOLLO,
                        target: "Apollo people search",
                        details: `Found ${result.totalEntries} matching people, returned page ${result.page} (${result.people.length} results)`,
                        type: RunHistoryActionType.read,
                        isReadOnly: true
                    }
                ]
            }
        } catch (error) {
            logger.error("Apollo people search failed", { error, integrationId })
            throw new Error(error instanceof Error ? error.message : "Failed to search people via Apollo")
        }
    }
})
