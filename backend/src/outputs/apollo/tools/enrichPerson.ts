import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { enrichApolloPerson } from "../../../integrations/apollo/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"
import { requireApolloApiKey } from "../apolloCredentials"

export const apolloEnrichPersonTool = defineSessionTool({
    name: "apollo_enrich_person",
    execute: async ({ integrationId, revealPersonalEmails, ...matchKeys }, runContext) => {
        if (!runContext?.context) throw new Error("No context provided")
        const apiKey = await requireApolloApiKey(integrationId, runContext.context.user)

        try {
            const person = await enrichApolloPerson(apiKey, { ...matchKeys, revealPersonalEmails: revealPersonalEmails ?? false })
            const target = person?.name || matchKeys.email || matchKeys.name || [matchKeys.firstName, matchKeys.lastName].filter(Boolean).join(" ") || "person"
            return {
                success: true,
                found: person !== null,
                person,
                actions: [
                    {
                        action: "Enriched person via Apollo",
                        integration: IntegrationType.APOLLO,
                        target,
                        details: person ? `Matched ${person.name ?? person.id} (${person.title ?? "unknown title"})` : "No match found",
                        type: RunHistoryActionType.read,
                        isReadOnly: true
                    }
                ]
            }
        } catch (error) {
            logger.error("Apollo person enrichment failed", { error, integrationId })
            throw new Error(error instanceof Error ? error.message : "Failed to enrich person via Apollo")
        }
    }
})
