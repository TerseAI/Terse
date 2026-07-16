import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { listApolloJobPostings } from "../../../integrations/apollo/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"
import { requireApolloApiKey } from "../apolloCredentials"

export const apolloListJobPostingsTool = defineSessionTool({
    name: "apollo_list_job_postings",
    execute: async ({ integrationId, organizationId, page, perPage }, runContext) => {
        if (!runContext?.context) throw new Error("No context provided")
        const apiKey = await requireApolloApiKey(integrationId, runContext.context.user)

        try {
            const result = await listApolloJobPostings(apiKey, organizationId, { page, perPage })
            return {
                success: true,
                postings: result.postings,
                totalPostings: result.totalPostings,
                page: result.page,
                perPage: result.perPage,
                actions: [
                    {
                        action: "Listed job postings via Apollo",
                        integration: IntegrationType.APOLLO,
                        target: `Apollo organization ${organizationId}`,
                        details: `Found ${result.totalPostings} job postings, returned page ${result.page} (${result.postings.length} results)`,
                        type: RunHistoryActionType.read,
                        isReadOnly: true
                    }
                ]
            }
        } catch (error) {
            logger.error("Apollo job postings lookup failed", { error, integrationId, organizationId })
            throw new Error(error instanceof Error ? error.message : "Failed to list job postings via Apollo")
        }
    }
})
