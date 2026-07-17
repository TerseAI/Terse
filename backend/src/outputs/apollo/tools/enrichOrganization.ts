import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { enrichApolloOrganization } from "../../../integrations/apollo/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"
import { requireApolloApiKey } from "../apolloCredentials"

export const apolloEnrichOrganizationTool = defineSessionTool({
    name: "apollo_enrich_organization",
    execute: async ({ integrationId, domain }, runContext) => {
        if (!runContext?.context) throw new Error("No context provided")
        const apiKey = await requireApolloApiKey(integrationId, runContext.context.user)

        try {
            const organization = await enrichApolloOrganization(apiKey, domain)
            return {
                success: true,
                found: organization !== null,
                organization,
                actions: [
                    {
                        action: "Enriched company via Apollo",
                        integration: IntegrationType.APOLLO,
                        target: domain,
                        details: organization ? `Matched ${organization.name ?? domain} (${organization.industry ?? "unknown industry"})` : "No match found",
                        type: RunHistoryActionType.read,
                        isReadOnly: true
                    }
                ]
            }
        } catch (error) {
            logger.error("Apollo organization enrichment failed", { error, integrationId, domain })
            throw new Error(error instanceof Error ? error.message : "Failed to enrich organization via Apollo")
        }
    }
})
