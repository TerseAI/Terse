import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { bulkEnrichApolloPeople } from "../../../integrations/apollo/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"
import { requireApolloApiKey } from "../apolloCredentials"

export const apolloBulkEnrichPeopleTool = defineSessionTool({
    name: "apollo_bulk_enrich_people",
    execute: async ({ integrationId, people, revealPersonalEmails }, runContext) => {
        if (!runContext?.context) throw new Error("No context provided")
        if (people.length === 0 || people.length > 10) {
            throw new Error(`apollo_bulk_enrich_people requires 1-10 people per call (got ${people.length}). Split larger lists into batches of 10.`)
        }
        const apiKey = await requireApolloApiKey(integrationId, runContext.context.user)

        try {
            const matches = await bulkEnrichApolloPeople(apiKey, people, revealPersonalEmails ?? false)
            return {
                success: true,
                matches,
                matchedCount: matches.length,
                requestedCount: people.length,
                actions: [
                    {
                        action: "Bulk enriched people via Apollo",
                        integration: IntegrationType.APOLLO,
                        target: `${people.length} people`,
                        details: `Matched ${matches.length} of ${people.length} requested people`,
                        type: RunHistoryActionType.read,
                        isReadOnly: true
                    }
                ]
            }
        } catch (error) {
            logger.error("Apollo bulk person enrichment failed", { error, integrationId, requestedCount: people.length })
            throw new Error(error instanceof Error ? error.message : "Failed to bulk enrich people via Apollo")
        }
    }
})
